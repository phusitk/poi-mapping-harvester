'use strict'

/**
 * guestOnly
 *
 * Applied to the GET /login route only.
 * Redirects already-authenticated users away from the login page so they
 * don't see a redundant form after a browser back-navigation.
 *
 * Redirect priority:
 *   1. req.session.returnTo  — the URL they were trying to reach before
 *      being sent to /login (set by requireAuth).
 *   2. /dashboard            — sensible default.
 *
 * must_change_password users are redirected to /change-password instead of
 * /dashboard so they cannot bypass the forced-change flow via back-navigation.
 */
function guestOnly(req, res, next) {
  if (!req.session?.user) {
    return next()
  }

  // Consume returnTo so it doesn't persist across future logouts.
  const destination = req.session.returnTo ?? null
  delete req.session.returnTo

  // Guard against open-redirect: only honour same-origin relative paths.
  if (destination && destination.startsWith('/') && !destination.startsWith('//')) {
    return res.redirect(destination)
  }

  return res.redirect('/dashboard')
}

module.exports = guestOnly
