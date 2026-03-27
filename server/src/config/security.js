'use strict'

const helmet    = require('helmet')
const rateLimit = require('express-rate-limit')

// ---------------------------------------------------------------------------
// Helmet — HTTP security headers
// CSP allows Tailwind CDN (used in EJS views).
// ---------------------------------------------------------------------------
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc    : ["'self'"],
      scriptSrc     : ["'self'", 'https://cdn.tailwindcss.com'],
      styleSrc      : ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      imgSrc        : ["'self'", 'data:'],
      connectSrc    : ["'self'"],
      fontSrc       : ["'self'"],
      objectSrc     : ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // Keep disabled — needed later when map tile iframes are embedded.
  crossOriginEmbedderPolicy: false,
})

// ---------------------------------------------------------------------------
// Login rate limiter — applied only to POST /auth/login
// 10 attempts per 15-minute window per IP.
// Failed / non-2xx responses count against the limit; successes do not.
// ---------------------------------------------------------------------------
const loginRateLimiter = rateLimit({
  windowMs              : 15 * 60 * 1000,   // 15 minutes
  max                   : 10,
  standardHeaders       : true,             // RateLimit-* headers (RFC 6585)
  legacyHeaders         : false,            // disable X-RateLimit-* headers
  skipSuccessfulRequests: true,             // only count failed attempts

  // HTML clients get a flash + redirect; JSON clients get 429 + body.
  handler: (req, res, _next, options) => {
    if (req.accepts('html')) {
      req.session.flash = {
        type   : 'error',
        message: 'Too many login attempts. Please wait 15 minutes and try again.',
      }
      return res.redirect('/login')
    }
    res.status(429).json({ error: options.message })
  },

  message: 'Too many login attempts. Please wait 15 minutes and try again.',
})

module.exports = { helmetMiddleware, loginRateLimiter }
