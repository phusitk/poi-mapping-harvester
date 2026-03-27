'use strict'

/**
 * requireAuth
 *
 * Gate for every protected route.
 * Rejects unauthenticated requests before any route handler runs.
 *
 * Behaviour:
 *   - No session user  → redirect to /login (HTML) or 401 JSON (API)
 *   - Session present  → attach req.user shorthand and call next()
 *
 * Note: must_change_password enforcement is handled by a separate
 * middleware (mustChangePassword.js) so concerns stay independent.
 */
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    // Preserve the originally requested URL so login can redirect back.
    // Only worth preserving for GET requests — POSTs have no meaningful
    // replay destination after a redirect-to-login round-trip.
    if (req.method === 'GET') {
      req.session.returnTo = req.originalUrl
    }

    if (req.accepts('html')) {
      return res.redirect('/login')
    }

    return res.status(401).json({ error: 'Authentication required.' })
  }

  // Convenience shorthand — avoids `req.session.user` boilerplate in handlers.
  req.user = req.session.user

  return next()
}

module.exports = requireAuth
