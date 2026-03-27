'use strict'

const { body, validationResult } = require('express-validator')
const authService                = require('../services/auth.service')
const { auditFromRequest, AUDIT_ACTIONS } = require('../services/audit.service')

// ---------------------------------------------------------------------------
// Input validation rule sets
// Defined here and exported so the router can compose them with the handler.
// ---------------------------------------------------------------------------

const loginValidationRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isLength({ max: 50 }).withMessage('Username too long.'),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ max: 200 }).withMessage('Password too long.'),
]

const changePasswordValidationRules = [
  body('current_password')
    .notEmpty().withMessage('Current password is required.'),
  body('new_password')
    .notEmpty().withMessage('New password is required.')
    .isLength({ min: 12, max: 200 }).withMessage('Password must be 12–200 characters.'),
  body('confirm_password')
    .notEmpty().withMessage('Please confirm your new password.'),
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Promisify session.regenerate so we can await it without callback nesting.
 * Express-session does not return a Promise natively.
 */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  })
}

/**
 * Promisify session.destroy.
 */
function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()))
  })
}

/**
 * Collect the first validation error per field into a single string.
 * Returns null if no errors.
 */
function firstValidationError(req) {
  const errors = validationResult(req)
  if (errors.isEmpty()) return null
  return errors.array({ onlyFirstError: true })[0].msg
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

async function login(req, res) {
  // 1. Input validation (express-validator rules run before this handler).
  const validationError = firstValidationError(req)
  if (validationError) {
    req.session.flash = { type: 'error', message: validationError }
    return res.redirect('/login')
  }

  const { username, password } = req.body

  // 2. Look up user. Always attempt password verification even for unknown
  //    usernames to prevent timing-based user enumeration.
  const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$dummysaltdummysalt$dummyhashvaluedummyhashvaluedummyh'

  const user = await authService.findByUsername(username)

  const hashToVerify  = user ? user.password_hash : DUMMY_HASH
  const passwordValid = await authService.verifyPassword(password, hashToVerify)

  // 3. Reject if user not found, inactive, or password wrong.
  //    All three cases return the same generic message — no enumeration.
  if (!user || !user.is_active || !passwordValid) {
    await auditFromRequest(
      req,
      AUDIT_ACTIONS.LOGIN_FAILED,
      user?.id    ?? null,
      username    ?? null,
      { reason: !user ? 'unknown_user' : !user.is_active ? 'inactive_account' : 'bad_password' },
    )

    req.session.flash = { type: 'error', message: 'Invalid username or password.' }
    return res.redirect('/login')
  }

  // 4. Session fixation protection — regenerate before writing any user data.
  try {
    await regenerateSession(req)
  } catch (err) {
    console.error('[auth] session.regenerate failed:', err)
    return res.status(500).render('error', {
      title  : 'Server Error',
      message: 'Could not establish a session. Please try again.',
      flash  : null,
    })
  }

  // 5. Stamp last_login_at and populate session.
  await authService.updateLastLogin(user.id)

  const safeUser = authService.getSafeUser(user)

  req.session.user        = safeUser
  req.session.loginAt     = Date.now()          // absolute timeout anchor
  req.session.lastRenewAt = Date.now()          // 45-min ID-rotation anchor

  // 6. Audit success.
  await auditFromRequest(req, AUDIT_ACTIONS.LOGIN_SUCCESS, user.id, user.username)

  return res.redirect('/dashboard')
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

async function logout(req, res) {
  const user = req.session.user ?? null

  // Audit before destroying — session data is gone after destroy().
  if (user) {
    await auditFromRequest(req, AUDIT_ACTIONS.LOGOUT, user.id, user.username)
  }

  try {
    await destroySession(req)
  } catch (err) {
    console.error('[auth] session.destroy failed:', err)
    // Still clear the cookie and redirect — a failed destroy is non-fatal.
  }

  // Clear the session cookie on the client regardless of store outcome.
  const cookieName = req.app.get('sessionCookieName') ?? 'poi.sid'
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    path    : '/',
  })

  return res.redirect('/login')
}

// ---------------------------------------------------------------------------
// GET /auth/me
// Returns session user as JSON — useful for client-side state hydration.
// ---------------------------------------------------------------------------

function me(req, res) {
  // requireAuth middleware guarantees req.session.user exists by this point.
  return res.json({ user: req.session.user })
}

// ---------------------------------------------------------------------------
// POST /auth/change-password
// ---------------------------------------------------------------------------

async function changePassword(req, res) {
  // 1. Validation.
  const validationError = firstValidationError(req)
  if (validationError) {
    req.session.flash = { type: 'error', message: validationError }
    return res.redirect('/change-password')
  }

  const { current_password, new_password, confirm_password } = req.body
  const sessionUser = req.session.user

  // 2. Re-fetch from DB to get the live password_hash.
  //    Session may be stale if another request changed it.
  const user = await authService.findByUsername(sessionUser.username)
  if (!user || !user.is_active) {
    req.session.flash = { type: 'error', message: 'Account not found or inactive.' }
    return res.redirect('/change-password')
  }

  // 3. Delegate all business rules to the service.
  try {
    await authService.changePassword(
      user.id,
      user.password_hash,
      current_password,
      new_password,
      confirm_password,
    )
  } catch (err) {
    // err.message is intentionally safe to surface (set in service layer).
    req.session.flash = { type: 'error', message: err.message }
    return res.redirect('/change-password')
  }

  // 4. Audit.
  await auditFromRequest(req, AUDIT_ACTIONS.CHANGE_PASSWORD, user.id, user.username)

  // 5. Sync session — clear the flag so the middleware stops redirecting.
  req.session.user = {
    ...req.session.user,
    must_change_password: false,
  }

  req.session.flash = { type: 'success', message: 'Password changed successfully.' }
  return res.redirect('/dashboard')
}

// ---------------------------------------------------------------------------
// POST /auth/keepalive
// Resets the idle timer for long-running POI harvesting sessions.
// Does NOT reset the absolute 8-hour timeout (enforced in sessionRenew.js).
// ---------------------------------------------------------------------------

function keepalive(req, res) {
  // express-session rolling:true already touches the cookie on every response,
  // but an explicit save() here guarantees the store TTL is also refreshed
  // even if the session data hasn't changed.
  req.session.save((err) => {
    if (err) {
      console.error('[auth] keepalive session.save failed:', err)
      return res.status(500).json({ error: 'Could not refresh session.' })
    }

    return res.json({
      ok        : true,
      expiresIn : req.session.cookie.maxAge ?? null,   // ms remaining on cookie
    })
  })
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Validation rule arrays — consumed by the router before the handler.
  loginValidationRules,
  changePasswordValidationRules,

  // Handlers.
  login,
  logout,
  me,
  changePassword,
  keepalive,
}
