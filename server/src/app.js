'use strict'

const path    = require('path')
const express = require('express')
const session = require('express-session')

const { sessionOptions }               = require('./config/session')
const { helmetMiddleware, loginRateLimiter } = require('./config/security')

const app = express()

// ---------------------------------------------------------------------------
// Trust proxy
// Set TRUST_PROXY=1 when running behind nginx so req.ip returns the real
// client IP (used by rate-limiter and audit logs) and secure cookies work.
// ---------------------------------------------------------------------------
const trustProxy = parseInt(process.env.TRUST_PROXY || '0', 10)
if (trustProxy > 0) app.set('trust proxy', trustProxy)

// ---------------------------------------------------------------------------
// Security headers (helmet)
// Must be early — before any response is sent.
// ---------------------------------------------------------------------------
app.use(helmetMiddleware)

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.urlencoded({ extended: false }))   // HTML form submissions
app.use(express.json())                             // keepalive + API calls

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
app.use(session(sessionOptions))

// ---------------------------------------------------------------------------
// Flash messages
// Lightweight session-based flash — no extra package needed.
//
// Usage in a controller (write):
//   req.session.flash = { type: 'error', message: 'Invalid credentials.' }
//   return res.redirect('/login')
//
// Usage in a view (read via res.locals):
//   <% if (flash) { %> ... <% } %>
// ---------------------------------------------------------------------------
app.use((req, res, _next) => {
  res.locals.flash = req.session.flash ?? null
  delete req.session.flash
  _next()
})

// ---------------------------------------------------------------------------
// View engine — EJS
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// ---------------------------------------------------------------------------
// Static assets
// public/css  — place any custom CSS overrides here
// public/js   — place any client-side JS here
// Tailwind itself is loaded via CDN in the base layout.
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')))

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const authRoutes = require('./routes/auth.routes')

app.use('/', authRoutes)

const dashboardRoutes = require('./routes/dashboard.routes')
app.use('/dashboard', dashboardRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).render('error', { title: 'Not Found', message: 'Page not found.', flash: null })
})

// ---------------------------------------------------------------------------
// Global error handler
// Express requires 4-param signature to recognise this as an error handler.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const isDev = process.env.NODE_ENV !== 'production'
  console.error('[app] unhandled error:', err)
  res.status(err.status || 500).render('error', {
    title  : 'Server Error',
    message: isDev ? err.message : 'An unexpected error occurred.',
    flash  : null,
  })
})

// Export app (not server) so server.js owns the listen() call.
// This keeps the module testable without binding a port.
module.exports = app
