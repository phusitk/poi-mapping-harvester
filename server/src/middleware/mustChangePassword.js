'use strict'

// ---------------------------------------------------------------------------
// Routes that a must_change_password user is allowed to reach.
// Logout actions are included so a user is never trapped without an exit.
// POST /auth/change-password is the form submission; GET /change-password
// is the form itself. Both must be open.
// ---------------------------------------------------------------------------
const ALLOWED_PATHS = new Set([
  '/change-password',       // GET  — render the form
  '/auth/change-password',  // POST — handle the form submission
  '/auth/logout',           // POST — always allow exit
])

/**
 * mustChangePassword
 *
 * Applied after requireAuth on every protected route.
 * If the session user still has must_change_password = true, they are
 * restricted to the change-password flow and logout.
 *
 * All other destinations redirect to /change-password with an info flash.
 * API clients receive 403 JSON so they can handle the state programmatically.
 */
function mustChangePassword(req, res, next) {
  // requireAuth runs first — req.user is guaranteed to exist here.
  if (!req.user.must_change_password) {
    return next()
  }

  // Allow the permitted paths through unconditionally.
  if (ALLOWED_PATHS.has(req.path)) {
    return next()
  }

  // Block everything else.
  if (req.accepts('html')) {
    // Only set the flash if it isn't already queued (avoids duplicate banners
    // on rapid successive requests before the redirect resolves).
    if (!req.session.flash) {
      req.session.flash = {
        type   : 'info',
        message: 'You must change your password before continuing.',
      }
    }
    return res.redirect('/change-password')
  }

  return res.status(403).json({
    error             : 'Password change required.',
    must_change_password: true,
  })
}

module.exports = mustChangePassword
