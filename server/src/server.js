'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

// ---------------------------------------------------------------------------
// Validate required env vars before anything else loads.
// Fail fast — a missing SESSION_SECRET in production is a hard error.
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ['SESSION_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
const missing = REQUIRED_ENV.filter((key) => !process.env[key])
if (missing.length) {
  console.error(`[server] Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

if (process.env.NODE_ENV === 'production' && process.env.SESSION_SECRET.length < 64) {
  console.error('[server] SESSION_SECRET must be at least 64 characters in production.')
  process.exit(1)
}

const app  = require('./app')
const PORT = parseInt(process.env.PORT || '4000', 10)

const server = app.listen(PORT, () => {
  console.log(`[server] POI auth server running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`)
})

// ---------------------------------------------------------------------------
// Graceful shutdown
// Stops accepting new connections; waits for in-flight requests to finish.
// ---------------------------------------------------------------------------
function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down gracefully`)
  server.close(() => {
    console.log('[server] HTTP server closed')
    process.exit(0)
  })

  // Force exit after 10 s if connections are still open.
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err)
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason)
  shutdown('unhandledRejection')
})
