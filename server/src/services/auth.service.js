'use strict'

const argon2 = require('argon2')
const prisma  = require('../lib/prisma')

// ---------------------------------------------------------------------------
// Argon2id parameters — must match seed.js exactly.
// OWASP 2024 minimums: memoryCost 19 MiB, timeCost 2, parallelism 1.
// ---------------------------------------------------------------------------
const ARGON2_OPTIONS = Object.freeze({
  type        : argon2.argon2id,
  memoryCost  : 19456,   // KiB  → 19 MiB
  timeCost    : 2,
  parallelism : 1,
})

// Password policy enforced on change-password only.
// Login accepts whatever is stored (supports legacy hashes during migration).
const PASSWORD_MIN_LENGTH = 12
const PASSWORD_POLICY     = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{12,}$/

// ---------------------------------------------------------------------------
// findByUsername
// ---------------------------------------------------------------------------

/**
 * Look up a user by username.
 * Returns null if not found — does NOT throw for missing users.
 *
 * @param   {string} username
 * @returns {Promise<import('@prisma/client').User | null>}
 */
async function findByUsername(username) {
  if (!username || typeof username !== 'string') return null

  return prisma.user.findUnique({
    where : { username: username.trim().toLowerCase() },
    select: {
      id                  : true,
      username            : true,
      password_hash       : true,
      role                : true,
      must_change_password: true,
      is_active           : true,
      last_login_at       : true,
    },
  })
}

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

/**
 * Verify a plaintext password against an Argon2id hash.
 *
 * Uses a constant-time comparison internally (argon2.verify does this).
 * Never throws for a wrong password — returns false instead.
 *
 * @param   {string} plainPassword  - Submitted plaintext value
 * @param   {string} hash           - Stored Argon2id hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false

  try {
    return await argon2.verify(hash, plainPassword)
  } catch (err) {
    // argon2.verify throws for malformed hashes — treat as verification failure.
    console.error('[auth] argon2.verify error:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// updateLastLogin
// ---------------------------------------------------------------------------

/**
 * Stamp last_login_at with the current UTC time.
 * Called after a successful login, before session data is written.
 *
 * @param   {string} userId
 * @returns {Promise<void>}
 */
async function updateLastLogin(userId) {
  await prisma.user.update({
    where: { id: userId },
    data : { last_login_at: new Date() },
  })
}

// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------

/**
 * Validate, hash, and persist a new password for a user.
 * Also clears must_change_password in the same atomic update.
 *
 * Throws a descriptive Error (message safe to surface to the user) on:
 *   - policy violations
 *   - new password == current password
 *   - current password verification failure
 *
 * @param {string} userId
 * @param {string} currentPasswordHash  - Stored hash (from findByUsername)
 * @param {string} currentPlain         - User-submitted current password
 * @param {string} newPlain             - User-submitted new password
 * @param {string} confirmPlain         - Must equal newPlain
 * @returns {Promise<void>}
 */
async function changePassword(userId, currentPasswordHash, currentPlain, newPlain, confirmPlain) {

  // 1. Confirm fields match before doing any crypto work.
  if (newPlain !== confirmPlain) {
    throw new Error('New password and confirmation do not match.')
  }

  // 2. Policy check.
  if (!newPlain || newPlain.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (!PASSWORD_POLICY.test(newPlain)) {
    throw new Error(
      'Password must contain uppercase, lowercase, a number, and a special character.',
    )
  }

  // 3. Verify the current password before allowing a change.
  const currentValid = await verifyPassword(currentPlain, currentPasswordHash)
  if (!currentValid) {
    throw new Error('Current password is incorrect.')
  }

  // 4. Reject reuse of the current password.
  const reused = await argon2.verify(currentPasswordHash, newPlain)
  if (reused) {
    throw new Error('New password must be different from the current password.')
  }

  // 5. Hash and persist.
  const newHash = await argon2.hash(newPlain, ARGON2_OPTIONS)

  await prisma.user.update({
    where: { id: userId },
    data : {
      password_hash       : newHash,
      must_change_password: false,     // cleared atomically with the hash update
    },
  })
}

// ---------------------------------------------------------------------------
// clearMustChangePassword
// ---------------------------------------------------------------------------

/**
 * Mark must_change_password = false without changing the password.
 * Not exposed to users — reserved for admin tooling / future use.
 *
 * @param   {string} userId
 * @returns {Promise<void>}
 */
async function clearMustChangePassword(userId) {
  await prisma.user.update({
    where: { id: userId },
    data : { must_change_password: false },
  })
}

// ---------------------------------------------------------------------------
// getSafeUser
// ---------------------------------------------------------------------------

/**
 * Return a plain object safe to store in session or send as JSON.
 * Strips password_hash and any other sensitive fields.
 *
 * @param   {import('@prisma/client').User} user
 * @returns {{ id: string, username: string, role: string, must_change_password: boolean }}
 */
function getSafeUser(user) {
  return {
    id                  : user.id,
    username            : user.username,
    role                : user.role,
    must_change_password: user.must_change_password,
  }
}

module.exports = {
  findByUsername,
  verifyPassword,
  updateLastLogin,
  changePassword,
  clearMustChangePassword,
  getSafeUser,
}
