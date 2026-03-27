'use strict'

const session    = require('express-session')
const MySQLStore = require('express-mysql-session')(session)
const mysql      = require('mysql2/promise')

// ---------------------------------------------------------------------------
// Dedicated pool for the session store.
// Kept separate from Prisma's internal connection pool so session I/O never
// competes with application queries.
// ---------------------------------------------------------------------------
const sessionPool = mysql.createPool({
  host              : process.env.DB_HOST,
  port              : parseInt(process.env.DB_PORT || '3306', 10),
  user              : process.env.DB_USER,
  password          : process.env.DB_PASSWORD,
  database          : process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit   : 5,
  queueLimit        : 0,
})

const store = new MySQLStore(
  {
    // Let the store bootstrap its own `sessions` table on first run.
    // Set to false and pre-create the table manually for locked-down prod DBs.
    createDatabaseTable    : true,

    // Purge expired sessions every 15 minutes.
    clearExpired           : true,
    checkExpirationInterval: 15 * 60 * 1000,

    // TTL stored in the `expires` column (seconds). Matches cookie maxAge.
    // express-mysql-session uses seconds here, not milliseconds.
    expiration             : 2 * 60 * 60,   // 2 hours
  },
  sessionPool,
)

store.on('error', (err) => {
  console.error('[session-store] MySQL store error:', err)
})

// ---------------------------------------------------------------------------
// 2-hour idle timeout.  rolling:true resets the cookie maxAge on every
// response, implementing idle-timeout semantics.
// The absolute 8-hour timeout and 45-minute ID regeneration are enforced
// separately in middleware/sessionRenew.js.
// ---------------------------------------------------------------------------
const IDLE_MS = 2 * 60 * 60 * 1000   // 2 h

const sessionOptions = {
  secret           : process.env.SESSION_SECRET,
  name             : 'poi.sid',            // don't expose the default 'connect.sid'
  store,
  resave           : false,
  saveUninitialized: false,
  rolling          : true,                 // idle-timeout: reset maxAge on every response
  cookie: {
    httpOnly : true,
    sameSite : 'lax',
    path     : '/',
    secure   : process.env.NODE_ENV === 'production',
    maxAge   : IDLE_MS,
  },
}

module.exports = { sessionOptions, sessionPool }
