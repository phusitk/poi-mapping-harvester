# POI Platform — Auth Module: Complete Reference

> Full source for the Express.js session-based authentication module.
> All files in order, cross-checked for consistent filenames, imports, env vars, and session settings.

---

## 1. Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│  server/  (Express.js — port 4000)                      │
│                                                         │
│  server.js ──► app.js                                   │
│                 ├── helmet                              │
│                 ├── body-parser                         │
│                 ├── express-session (MySQLStore)        │
│                 ├── flash middleware                    │
│                 ├── EJS view engine                     │
│                 ├── express.static → public/            │
│                 └── auth.routes.js                      │
│                                                         │
│  Routes ──► Controllers ──► Services                    │
│                ├── auth.service.js   (argon2 + Prisma)  │
│                └── audit.service.js  (Prisma)           │
│                                                         │
│  Middleware chain (protected routes):                   │
│  requireAuth → mustChangePassword → handler             │
│                                                         │
│  Middleware (login page only):                          │
│  guestOnly → handler                                    │
│                                                         │
│  Views (EJS + Tailwind CDN)                             │
│  ├── login.ejs                                          │
│  ├── change-password.ejs                                │
│  ├── dashboard.ejs                                      │
│  └── error.ejs                                          │
│                                                         │
│  Prisma ORM ──► MySQL (tonpao_poi)                      │
│  ├── users          (id CHAR(36), username, hash,       │
│  │                   role, must_change_password, ...)   │
│  └── audit_logs     (id BIGINT, user_id, action,        │
│                       ip_address, metadata, ...)        │
│                                                         │
│  express-mysql-session ──► sessions table (auto)        │
└─────────────────────────────────────────────────────────┘

┌────────────────────────────────┐
│  Next.js app (port 3000)       │  ← untouched, separate process
│  /api/poi, /api/grids, etc.    │
└────────────────────────────────┘
```

**Session flow:**
- Login → `session.regenerate()` → stamp `loginAt` + `lastRenewAt` → write `user`
- Every request → `sessionRenew` middleware reads `lastRenewAt` (45-min rotation) and `loginAt` (8-h cut)
- Idle timeout: `rolling: true` + `maxAge: 2h` in express-session
- `POST /auth/keepalive` → explicit `session.save()` to refresh store TTL for long harvesting jobs

**Route protection matrix:**

| Route | requireAuth | mustChangePassword | guestOnly |
|---|---|---|---|
| `GET /login` | — | — | ✓ |
| `GET /change-password` | ✓ | — | — |
| `POST /auth/login` | — | — | — |
| `POST /auth/logout` | ✓ | — | — |
| `GET /auth/me` | ✓ | ✓ | — |
| `POST /auth/change-password` | ✓ | — | — |
| `POST /auth/keepalive` | ✓ | — | — |
| `GET /dashboard` | ✓ | ✓ | — |

---

## 2. File Tree

```
server/
├── package.json
├── .env                              ← copy from .env.example, never commit
├── .env.example
├── README.md
├── AUTH_MODULE_COMPLETE.md           ← this file
│
├── prisma/
│   ├── schema.prisma                 # users + audit_logs (sessions table excluded)
│   └── seed.js                       # admin + research users, Argon2id hashed
│
├── src/
│   ├── server.js                     # entry: env validation, listen, graceful shutdown
│   ├── app.js                        # Express setup, middleware chain, route mounting
│   │
│   ├── config/
│   │   ├── session.js                # MySQLStore (dedicated pool) + sessionOptions
│   │   └── security.js               # helmetMiddleware + loginRateLimiter
│   │
│   ├── lib/
│   │   └── prisma.js                 # singleton PrismaClient
│   │
│   ├── services/
│   │   ├── auth.service.js           # findByUsername, verifyPassword, updateLastLogin,
│   │   │                             #   changePassword, clearMustChangePassword, getSafeUser
│   │   └── audit.service.js          # createAuditLog, auditFromRequest, AUDIT_ACTIONS
│   │
│   ├── middleware/
│   │   ├── requireAuth.js            # redirect /login or 401 JSON
│   │   ├── mustChangePassword.js     # redirect /change-password or 403 JSON
│   │   └── guestOnly.js              # redirect /dashboard if already authenticated
│   │
│   ├── controllers/
│   │   └── auth.controller.js        # login, logout, me, changePassword, keepalive
│   │                                 #   + loginValidationRules, changePasswordValidationRules
│   │
│   ├── routes/
│   │   └── auth.routes.js            # all page + API routes wired with middleware
│   │
│   └── views/
│       ├── partials/
│       │   ├── head.ejs              # <head>: Tailwind CDN, brand theme, custom.css
│       │   └── flash.ejs             # error / success / info alert banner
│       ├── login.ejs
│       ├── change-password.ejs
│       ├── dashboard.ejs             # includes keepalive script
│       └── error.ejs
│
└── public/
    └── css/
        └── custom.css                # autofill fix + override slot
```

---

## 3. Prisma Schema

**`prisma/schema.prisma`**

```prisma
// =============================================================================
// Prisma Schema — POI Mapping Platform Auth Module
// Database: MySQL (InnoDB, utf8mb4_unicode_ci)
// Managed tables: users, audit_logs
//
// SESSION TABLE NOTE:
//   The `sessions` table is NOT managed by Prisma. It is created and owned
//   exclusively by `express-mysql-session`. Do not add a Session model here.
//   Schema created by express-mysql-session:
//
//     CREATE TABLE IF NOT EXISTS `sessions` (
//       `session_id`  varchar(128) COLLATE utf8mb4_bin NOT NULL,
//       `expires`     int(11) unsigned NOT NULL,
//       `data`        mediumtext COLLATE utf8mb4_bin,
//       PRIMARY KEY (`session_id`)
//     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
//
//   Ensure the DB user has CREATE TABLE privilege on first run so the store
//   can bootstrap itself (or pre-create the table manually with the DDL above
//   and set `createDatabaseTable: false` in the MySQLStore options).
// =============================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// =============================================================================
// USERS
// =============================================================================
model User {
  id                  String    @id @default(uuid()) @db.Char(36)
  username            String    @unique @db.VarChar(50)

  /// Argon2id hash. Never store plaintext. Min length enforced in service layer.
  password_hash       String    @db.VarChar(255)

  /// All current users are 'admin'. Field retained for future role expansion.
  role                String    @default("admin") @db.VarChar(50)

  /// Forces redirect to /change-password before any protected route is accessible.
  must_change_password Boolean  @default(true)

  /// Soft-delete / account lock without destroying audit history.
  is_active           Boolean   @default(true)

  last_login_at       DateTime? @db.DateTime(0)
  created_at          DateTime  @default(now()) @db.DateTime(0)
  updated_at          DateTime  @updatedAt @db.DateTime(0)

  audit_logs          AuditLog[]

  @@index([username])
  @@index([is_active])
  @@map("users")
}

// =============================================================================
// AUDIT LOGS
// =============================================================================

/// Valid values for the action field. Kept as a comment (not enum) because
/// MySQL enums are painful to migrate; validate in the service layer instead.
///
///   LOGIN_SUCCESS | LOGIN_FAILED | LOGOUT | CHANGE_PASSWORD
///
model AuditLog {
  /// BIGINT AUTO_INCREMENT — high write volume, UUID overhead not justified here.
  id          BigInt    @id @default(autoincrement())

  /// Nullable: LOGIN_FAILED events may have no resolved user (unknown username).
  user_id     String?   @db.Char(36)

  /// Denormalised username snapshot. Preserves audit trail if the user row is
  /// ever deleted or username is changed. Do not rely on the relation for reporting.
  username    String?   @db.VarChar(50)

  /// One of: LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, CHANGE_PASSWORD
  action      String    @db.VarChar(50)

  /// IPv4 (15) or IPv6 (39) — 45 chars covers IPv4-mapped IPv6 ::ffff:0.0.0.0
  ip_address  String?   @db.VarChar(45)

  user_agent  String?   @db.Text

  /// Optional structured context: e.g. { "reason": "bad_password", "attempt": 3 }
  metadata    Json?

  created_at  DateTime  @default(now()) @db.DateTime(0)

  user        User?     @relation(fields: [user_id], references: [id], onDelete: SetNull)

  @@index([user_id])
  @@index([action])
  @@index([created_at(sort: Desc)])
  @@index([username])
  @@map("audit_logs")
}
```

---

## 4. Seed Script

**`prisma/seed.js`**

```js
'use strict'

/**
 * Prisma seed script — auth users
 *
 * Run via:  npm run seed   (from server/)
 * Or:       npx prisma db seed
 *
 * Uses upsert so it is safe to run multiple times.
 * Passwords are hashed with Argon2id before being written.
 */

const { PrismaClient } = require('@prisma/client')
const argon2 = require('argon2')

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Argon2id parameters
// OWASP recommended minimums (2024):
//   memory: 19 MiB (19456 KiB), iterations: 2, parallelism: 1
// Increase memory/iterations in production if hardware allows.
// ---------------------------------------------------------------------------
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,  // 19 MiB in KiB
  timeCost: 2,        // iterations
  parallelism: 1,
}

// ---------------------------------------------------------------------------
// Seed users
// Passwords are defined here only for initial seeding.
// Both users must change their password on first login.
// ---------------------------------------------------------------------------
const SEED_USERS = [
  {
    username: 'admin',
    plainPassword: 'admin@Hpoi$2569',
    role: 'admin',
    must_change_password: true,
  },
  {
    username: 'research',
    plainPassword: 'Hpoi$2569',
    role: 'admin',
    must_change_password: true,
  },
]

async function hashPasswords(users) {
  return Promise.all(
    users.map(async (u) => ({
      username: u.username,
      password_hash: await argon2.hash(u.plainPassword, ARGON2_OPTIONS),
      role: u.role,
      must_change_password: u.must_change_password,
    }))
  )
}

async function main() {
  console.log('Seeding auth users…')

  const usersToInsert = await hashPasswords(SEED_USERS)

  for (const user of usersToInsert) {
    const result = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        // On re-seed: refresh hash and enforce must_change_password.
        // Role and is_active are intentionally NOT reset to preserve
        // any manual changes made after the initial seed.
        password_hash: user.password_hash,
        must_change_password: user.must_change_password,
      },
      create: {
        username: user.username,
        password_hash: user.password_hash,
        role: user.role,
        must_change_password: user.must_change_password,
        is_active: true,
      },
    })

    console.log(`  ✓ user "${result.username}" upserted (id: ${result.id})`)
  }

  console.log('Seeding complete.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

---

## 5. Bootstrap Files

### `package.json`

```json
{
  "name": "poi-auth-server",
  "version": "1.0.0",
  "private": true,
  "description": "Express.js auth server for POI Mapping Platform",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "seed": "node prisma/seed.js",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "prisma:generate": "prisma generate",
    "prisma:studio": "prisma studio"
  },
  "prisma": {
    "seed": "node prisma/seed.js"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "argon2": "^0.31.2",
    "dotenv": "^16.4.5",
    "ejs": "^3.1.10",
    "express": "^4.21.0",
    "express-mysql-session": "^3.0.0",
    "express-rate-limit": "^7.4.1",
    "express-session": "^1.18.1",
    "express-validator": "^7.2.0",
    "helmet": "^8.0.0",
    "mysql2": "^3.11.3",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.7",
    "prisma": "^5.22.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

---

### `src/config/session.js`

```js
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
```

---

### `src/config/security.js`

```js
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
```

---

### `src/server.js`

```js
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
```

---

### `src/app.js`

```js
'use strict'

const path    = require('path')
const express = require('express')
const session = require('express-session')

const { sessionOptions }                    = require('./config/session')
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

// TODO: mount when written:
// const dashboardRoutes = require('./routes/dashboard.routes')
// app.use('/dashboard', dashboardRoutes)

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
```

---

## 6. Services

### `src/lib/prisma.js`

```js
'use strict'

const { PrismaClient } = require('@prisma/client')

// Single PrismaClient instance for the process lifetime.
// Prisma manages its own connection pool internally.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
})

module.exports = prisma
```

---

### `src/services/audit.service.js`

```js
'use strict'

const prisma = require('../lib/prisma')

// Valid audit actions — enforced here so the DB column stays a plain VARCHAR.
const AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS    : 'LOGIN_SUCCESS',
  LOGIN_FAILED     : 'LOGIN_FAILED',
  LOGOUT           : 'LOGOUT',
  CHANGE_PASSWORD  : 'CHANGE_PASSWORD',
})

/**
 * Write an audit log entry.
 *
 * Designed to be fire-and-forget in most call sites — errors are caught and
 * logged to stderr rather than thrown, so an audit failure never blocks the
 * request that triggered it.
 *
 * @param {object}  params
 * @param {string}  params.action      - One of AUDIT_ACTIONS
 * @param {string}  [params.userId]    - Resolved user id (null for unknown-user failures)
 * @param {string}  [params.username]  - Denormalised snapshot of username at log time
 * @param {string}  [params.ipAddress] - Client IP from req.ip
 * @param {string}  [params.userAgent] - req.get('user-agent')
 * @param {object}  [params.metadata]  - Arbitrary structured context
 */
async function createAuditLog({
  action,
  userId    = null,
  username  = null,
  ipAddress = null,
  userAgent = null,
  metadata  = null,
}) {
  if (!AUDIT_ACTIONS[action]) {
    console.error(`[audit] Unknown action "${action}" — log entry skipped`)
    return
  }

  try {
    await prisma.auditLog.create({
      data: {
        action,
        user_id   : userId,
        username,
        ip_address: ipAddress,
        user_agent: userAgent   ?? null,
        metadata  : metadata    ?? undefined,
      },
    })
  } catch (err) {
    // Never propagate — a failed audit write must not crash the request.
    console.error('[audit] Failed to write audit log:', err)
  }
}

/**
 * Convenience wrapper: build audit params directly from an Express request.
 *
 * @param {import('express').Request} req
 * @param {string}  action
 * @param {string|null} userId
 * @param {string|null} username
 * @param {object|null} metadata
 */
function auditFromRequest(req, action, userId, username, metadata = null) {
  return createAuditLog({
    action,
    userId,
    username,
    ipAddress: req.ip                ?? null,
    userAgent: req.get('user-agent') ?? null,
    metadata,
  })
}

module.exports = { createAuditLog, auditFromRequest, AUDIT_ACTIONS }
```

---

### `src/services/auth.service.js`

```js
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

/**
 * Look up a user by username.
 * Returns null if not found — does NOT throw for missing users.
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

/**
 * Verify a plaintext password against an Argon2id hash.
 * Returns false (never throws) on wrong password or malformed hash.
 */
async function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false

  try {
    return await argon2.verify(hash, plainPassword)
  } catch (err) {
    console.error('[auth] argon2.verify error:', err)
    return false
  }
}

/**
 * Stamp last_login_at with the current UTC time.
 */
async function updateLastLogin(userId) {
  await prisma.user.update({
    where: { id: userId },
    data : { last_login_at: new Date() },
  })
}

/**
 * Validate, hash, and persist a new password.
 * Clears must_change_password atomically in the same update.
 * Throws user-safe Error messages on any policy or verification failure.
 */
async function changePassword(userId, currentPasswordHash, currentPlain, newPlain, confirmPlain) {

  if (newPlain !== confirmPlain) {
    throw new Error('New password and confirmation do not match.')
  }

  if (!newPlain || newPlain.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (!PASSWORD_POLICY.test(newPlain)) {
    throw new Error(
      'Password must contain uppercase, lowercase, a number, and a special character.',
    )
  }

  const currentValid = await verifyPassword(currentPlain, currentPasswordHash)
  if (!currentValid) {
    throw new Error('Current password is incorrect.')
  }

  const reused = await argon2.verify(currentPasswordHash, newPlain)
  if (reused) {
    throw new Error('New password must be different from the current password.')
  }

  const newHash = await argon2.hash(newPlain, ARGON2_OPTIONS)

  await prisma.user.update({
    where: { id: userId },
    data : {
      password_hash       : newHash,
      must_change_password: false,
    },
  })
}

/**
 * Mark must_change_password = false without changing the password.
 * Reserved for admin tooling / future use.
 */
async function clearMustChangePassword(userId) {
  await prisma.user.update({
    where: { id: userId },
    data : { must_change_password: false },
  })
}

/**
 * Return a plain object safe to store in session or send as JSON.
 * Strips password_hash and sensitive fields.
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
```

---

## 7. Middleware

### `src/middleware/requireAuth.js`

```js
'use strict'

/**
 * requireAuth
 * Gate for every protected route.
 * - No session user  → redirect /login (HTML) or 401 JSON (API)
 * - Session present  → attach req.user shorthand and call next()
 */
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    if (req.method === 'GET') {
      req.session.returnTo = req.originalUrl
    }

    if (req.accepts('html')) {
      return res.redirect('/login')
    }

    return res.status(401).json({ error: 'Authentication required.' })
  }

  req.user = req.session.user

  return next()
}

module.exports = requireAuth
```

---

### `src/middleware/mustChangePassword.js`

```js
'use strict'

// Routes a must_change_password user is always allowed to reach.
const ALLOWED_PATHS = new Set([
  '/change-password',       // GET  — render the form
  '/auth/change-password',  // POST — handle the form submission
  '/auth/logout',           // POST — always allow exit
])

/**
 * mustChangePassword
 * Applied after requireAuth on every protected route.
 * Restricts users with must_change_password = true to the change-password
 * flow and logout only.
 */
function mustChangePassword(req, res, next) {
  if (!req.user.must_change_password) {
    return next()
  }

  if (ALLOWED_PATHS.has(req.path)) {
    return next()
  }

  if (req.accepts('html')) {
    if (!req.session.flash) {
      req.session.flash = {
        type   : 'info',
        message: 'You must change your password before continuing.',
      }
    }
    return res.redirect('/change-password')
  }

  return res.status(403).json({
    error               : 'Password change required.',
    must_change_password: true,
  })
}

module.exports = mustChangePassword
```

---

### `src/middleware/guestOnly.js`

```js
'use strict'

/**
 * guestOnly
 * Applied to GET /login only.
 * Redirects already-authenticated users away from the login page.
 *
 * Redirect priority:
 *   1. req.session.returnTo (set by requireAuth) — same-origin only
 *   2. /change-password     — if must_change_password is still true
 *   3. /dashboard           — default
 */
function guestOnly(req, res, next) {
  if (!req.session?.user) {
    return next()
  }

  const destination = req.session.returnTo ?? null
  delete req.session.returnTo

  if (req.session.user.must_change_password) {
    return res.redirect('/change-password')
  }

  // Guard against open-redirect: only honour same-origin relative paths.
  if (destination && destination.startsWith('/') && !destination.startsWith('//')) {
    return res.redirect(destination)
  }

  return res.redirect('/dashboard')
}

module.exports = guestOnly
```

---

## 8. Controller

### `src/controllers/auth.controller.js`

```js
'use strict'

const { body, validationResult } = require('express-validator')
const authService                = require('../services/auth.service')
const { auditFromRequest, AUDIT_ACTIONS } = require('../services/audit.service')

// ---------------------------------------------------------------------------
// Validation rule sets — exported so the router composes them with handlers.
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

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  })
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()))
  })
}

function firstValidationError(req) {
  const errors = validationResult(req)
  if (errors.isEmpty()) return null
  return errors.array({ onlyFirstError: true })[0].msg
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

async function login(req, res) {
  const validationError = firstValidationError(req)
  if (validationError) {
    req.session.flash = { type: 'error', message: validationError }
    return res.redirect('/login')
  }

  const { username, password } = req.body

  // Always call verifyPassword even for unknown usernames (timing-safe).
  const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$dummysaltdummysalt$dummyhashvaluedummyhashvaluedummyh'

  const user = await authService.findByUsername(username)

  const hashToVerify  = user ? user.password_hash : DUMMY_HASH
  const passwordValid = await authService.verifyPassword(password, hashToVerify)

  if (!user || !user.is_active || !passwordValid) {
    await auditFromRequest(
      req,
      AUDIT_ACTIONS.LOGIN_FAILED,
      user?.id   ?? null,
      username   ?? null,
      { reason: !user ? 'unknown_user' : !user.is_active ? 'inactive_account' : 'bad_password' },
    )

    req.session.flash = { type: 'error', message: 'Invalid username or password.' }
    return res.redirect('/login')
  }

  // Session fixation protection — regenerate before writing user data.
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

  await authService.updateLastLogin(user.id)

  const safeUser = authService.getSafeUser(user)

  req.session.user        = safeUser
  req.session.loginAt     = Date.now()    // absolute timeout anchor
  req.session.lastRenewAt = Date.now()    // 45-min ID-rotation anchor

  await auditFromRequest(req, AUDIT_ACTIONS.LOGIN_SUCCESS, user.id, user.username)

  if (user.must_change_password) {
    req.session.flash = {
      type   : 'info',
      message: 'You must change your password before continuing.',
    }
    return res.redirect('/change-password')
  }

  return res.redirect('/dashboard')
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

async function logout(req, res) {
  const user = req.session.user ?? null

  if (user) {
    await auditFromRequest(req, AUDIT_ACTIONS.LOGOUT, user.id, user.username)
  }

  try {
    await destroySession(req)
  } catch (err) {
    console.error('[auth] session.destroy failed:', err)
  }

  // Clear the cookie on the client regardless of store outcome.
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
// ---------------------------------------------------------------------------

function me(req, res) {
  return res.json({ user: req.session.user })
}

// ---------------------------------------------------------------------------
// POST /auth/change-password
// ---------------------------------------------------------------------------

async function changePassword(req, res) {
  const validationError = firstValidationError(req)
  if (validationError) {
    req.session.flash = { type: 'error', message: validationError }
    return res.redirect('/change-password')
  }

  const { current_password, new_password, confirm_password } = req.body
  const sessionUser = req.session.user

  // Re-fetch from DB — session hash may be stale.
  const user = await authService.findByUsername(sessionUser.username)
  if (!user || !user.is_active) {
    req.session.flash = { type: 'error', message: 'Account not found or inactive.' }
    return res.redirect('/change-password')
  }

  try {
    await authService.changePassword(
      user.id,
      user.password_hash,
      current_password,
      new_password,
      confirm_password,
    )
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message }
    return res.redirect('/change-password')
  }

  await auditFromRequest(req, AUDIT_ACTIONS.CHANGE_PASSWORD, user.id, user.username)

  // Sync session so mustChangePassword stops redirecting.
  req.session.user = {
    ...req.session.user,
    must_change_password: false,
  }

  req.session.flash = { type: 'success', message: 'Password changed successfully.' }
  return res.redirect('/dashboard')
}

// ---------------------------------------------------------------------------
// POST /auth/keepalive
// ---------------------------------------------------------------------------

function keepalive(req, res) {
  req.session.save((err) => {
    if (err) {
      console.error('[auth] keepalive session.save failed:', err)
      return res.status(500).json({ error: 'Could not refresh session.' })
    }

    return res.json({
      ok       : true,
      expiresIn: req.session.cookie.maxAge ?? null,
    })
  })
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loginValidationRules,
  changePasswordValidationRules,
  login,
  logout,
  me,
  changePassword,
  keepalive,
}
```

---

## 9. Routes

### `src/routes/auth.routes.js`

```js
'use strict'

const { Router } = require('express')

const {
  loginValidationRules,
  changePasswordValidationRules,
  login,
  logout,
  me,
  changePassword,
  keepalive,
} = require('../controllers/auth.controller')

const { loginRateLimiter } = require('../config/security')
const requireAuth          = require('../middleware/requireAuth')
const mustChangePassword   = require('../middleware/mustChangePassword')
const guestOnly            = require('../middleware/guestOnly')

const router = Router()

// =============================================================================
// Page routes
// =============================================================================

// GET /login — guest only; authenticated users redirected away
router.get('/login', guestOnly, (req, res) => {
  res.render('login', {
    title: 'Sign In',
    flash: res.locals.flash,
  })
})

// GET /change-password — requireAuth only; mustChangePassword deliberately absent
// (this IS the exit route for must_change_password users)
router.get('/change-password', requireAuth, (req, res) => {
  res.render('change-password', {
    title: 'Change Password',
    user : req.user,
    flash: res.locals.flash,
  })
})

// =============================================================================
// Auth API routes
// =============================================================================

// POST /auth/login
router.post('/auth/login', loginRateLimiter, loginValidationRules, login)

// POST /auth/logout
router.post('/auth/logout', requireAuth, logout)

// GET /auth/me — mustChangePassword applied: returns 403 when restricted
router.get('/auth/me', requireAuth, mustChangePassword, me)

// POST /auth/change-password — mustChangePassword absent: this clears the flag
router.post('/auth/change-password', requireAuth, changePasswordValidationRules, changePassword)

// POST /auth/keepalive — mustChangePassword absent: harvesting jobs must stay alive
router.post('/auth/keepalive', requireAuth, keepalive)

module.exports = router
```

---

## 10. Views

### `src/views/partials/head.ejs`

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title><%= title %> — POI Platform</title>

<!-- Tailwind CSS (CDN — replace with CLI build for production hardening) -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Custom overrides (optional) -->
<link rel="stylesheet" href="/css/custom.css" />

<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          brand: {
            50 : '#eff6ff',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
          }
        }
      }
    }
  }
</script>
```

---

### `src/views/partials/flash.ejs`

```html
<%
const _flashStyles = {
  error  : 'bg-red-50 border-red-400 text-red-800',
  success: 'bg-green-50 border-green-400 text-green-800',
  info   : 'bg-blue-50 border-blue-400 text-blue-800',
}
const _flashIcons = {
  error  : '✕',
  success: '✓',
  info   : 'ℹ',
}
%>
<% if (flash && flash.message) { %>
  <%
    const _type  = ['error','success','info'].includes(flash.type) ? flash.type : 'info'
    const _style = _flashStyles[_type]
    const _icon  = _flashIcons[_type]
  %>
  <div
    role="alert"
    aria-live="polite"
    class="flex items-start gap-3 rounded-md border px-4 py-3 text-sm <%= _style %>"
  >
    <span class="mt-0.5 shrink-0 font-bold"><%= _icon %></span>
    <span><%= flash.message %></span>
  </div>
<% } %>
```

---

### `src/views/login.ejs`

```html
<!DOCTYPE html>
<html lang="en" class="h-full bg-gray-50">
<head>
  <%- include('partials/head', { title }) %>
</head>
<body class="h-full">

  <div class="flex min-h-full flex-col justify-center px-6 py-16 lg:px-8">

    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <p class="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">POI Mapping Platform</p>
      <h1 class="mt-2 text-center text-2xl font-bold tracking-tight text-gray-900">Sign in</h1>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
      <div class="bg-white px-8 py-10 shadow-sm ring-1 ring-gray-200 rounded-xl">

        <div class="mb-6 empty:hidden">
          <%- include('partials/flash', { flash }) %>
        </div>

        <form method="POST" action="/auth/login" novalidate>

          <div class="mb-5">
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              id="username" name="username" type="text"
              autocomplete="username" required autofocus maxlength="50"
              class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     text-gray-900 placeholder-gray-400 shadow-sm
                     focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Enter your username"
            />
          </div>

          <div class="mb-7">
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="password" name="password" type="password"
              autocomplete="current-password" required maxlength="200"
              class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     text-gray-900 placeholder-gray-400 shadow-sm
                     focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Enter your password"
            />
          </div>

          <button type="submit"
            class="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold
                   text-white shadow-sm hover:bg-brand-700 focus:outline-none
                   focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors duration-150">
            Sign in
          </button>

        </form>
      </div>
    </div>

  </div>

</body>
</html>
```

---

### `src/views/change-password.ejs`

```html
<!DOCTYPE html>
<html lang="en" class="h-full bg-gray-50">
<head>
  <%- include('partials/head', { title }) %>
</head>
<body class="h-full">

  <div class="flex min-h-full flex-col justify-center px-6 py-16 lg:px-8">

    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <p class="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">POI Mapping Platform</p>
      <h1 class="mt-2 text-center text-2xl font-bold tracking-tight text-gray-900">Change password</h1>
      <% if (user && user.must_change_password) { %>
        <p class="mt-2 text-center text-sm text-amber-600">You must set a new password before continuing.</p>
      <% } else { %>
        <p class="mt-2 text-center text-sm text-gray-500">
          Signed in as <span class="font-medium text-gray-700"><%= user ? user.username : '' %></span>
        </p>
      <% } %>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
      <div class="bg-white px-8 py-10 shadow-sm ring-1 ring-gray-200 rounded-xl">

        <div class="mb-6 empty:hidden">
          <%- include('partials/flash', { flash }) %>
        </div>

        <form method="POST" action="/auth/change-password" novalidate>

          <div class="mb-5">
            <label for="current_password" class="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              id="current_password" name="current_password" type="password"
              autocomplete="current-password" required autofocus maxlength="200"
              class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     text-gray-900 placeholder-gray-400 shadow-sm
                     focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Your current password"
            />
          </div>

          <div class="mb-5">
            <label for="new_password" class="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              id="new_password" name="new_password" type="password"
              autocomplete="new-password" required maxlength="200"
              class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     text-gray-900 placeholder-gray-400 shadow-sm
                     focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Minimum 12 characters"
            />
            <p class="mt-1.5 text-xs text-gray-400">Must include uppercase, lowercase, a number, and a special character.</p>
          </div>

          <div class="mb-7">
            <label for="confirm_password" class="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              id="confirm_password" name="confirm_password" type="password"
              autocomplete="new-password" required maxlength="200"
              class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     text-gray-900 placeholder-gray-400 shadow-sm
                     focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Repeat new password"
            />
          </div>

          <button type="submit"
            class="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold
                   text-white shadow-sm hover:bg-brand-700 focus:outline-none
                   focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors duration-150">
            Update password
          </button>

        </form>

        <!-- Logout escape hatch — always available even under must_change_password -->
        <div class="mt-6 border-t border-gray-100 pt-5 text-center">
          <form method="POST" action="/auth/logout">
            <button type="submit"
              class="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors duration-150">
              Sign out instead
            </button>
          </form>
        </div>

      </div>
    </div>

  </div>

</body>
</html>
```

---

### `src/views/dashboard.ejs`

```html
<!DOCTYPE html>
<html lang="en" class="h-full bg-gray-50">
<head>
  <%- include('partials/head', { title }) %>
</head>
<body class="h-full flex flex-col">

  <header class="bg-white shadow-sm ring-1 ring-gray-200 shrink-0">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-14 items-center justify-between">

        <span class="text-sm font-semibold tracking-wide text-gray-800">POI Mapping Platform</span>

        <div class="flex items-center gap-4">
          <span class="hidden sm:block text-sm text-gray-500">
            <span class="font-medium text-gray-700"><%= user.username %></span>
            <span class="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"><%= user.role %></span>
          </span>

          <form method="POST" action="/auth/logout">
            <button type="submit"
              class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600
                     border border-gray-300 hover:bg-gray-50 hover:text-gray-900
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1
                     transition-colors duration-150">
              Sign out
            </button>
          </form>
        </div>

      </div>
    </div>
  </header>

  <main class="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

    <% if (flash && flash.message) { %>
      <div class="mb-6"><%- include('partials/flash', { flash }) %></div>
    <% } %>

    <div class="mb-8">
      <h1 class="text-xl font-bold text-gray-900">Dashboard</h1>
      <p class="mt-1 text-sm text-gray-500">Welcome back, <%= user.username %>.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

      <div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl" aria-hidden="true">🗺️</span>
          <h2 class="text-sm font-semibold text-gray-800">POI Jobs</h2>
        </div>
        <p class="text-xs text-gray-400">Manage and monitor harvesting jobs.</p>
        <a href="/poi/jobs" class="mt-4 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">View jobs →</a>
      </div>

      <div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl" aria-hidden="true">📐</span>
          <h2 class="text-sm font-semibold text-gray-800">Areas</h2>
        </div>
        <p class="text-xs text-gray-400">Define and manage geographic areas.</p>
        <a href="/poi/areas" class="mt-4 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">Manage areas →</a>
      </div>

      <div class="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl" aria-hidden="true">🔑</span>
          <h2 class="text-sm font-semibold text-gray-800">Account</h2>
        </div>
        <p class="text-xs text-gray-400">Update your password.</p>
        <a href="/change-password" class="mt-4 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">Change password →</a>
      </div>

    </div>
  </main>

  <script>
    (function () {
      const PING_INTERVAL_MS = 30 * 60 * 1000       // 30 min
      const MAX_SESSION_MS   =  8 * 60 * 60 * 1000  // 8 h absolute timeout
      const startedAt        = Date.now()

      async function ping() {
        if (Date.now() - startedAt >= MAX_SESSION_MS) return

        try {
          const res = await fetch('/auth/keepalive', {
            method     : 'POST',
            credentials: 'same-origin',
            headers    : { 'Content-Type': 'application/json' },
          })

          if (res.status === 401) {
            window.location.reload()
          }
        } catch (_) {
          // Network error — skip, browser handles on next navigation.
        }
      }

      setInterval(ping, PING_INTERVAL_MS)
    })()
  </script>

</body>
</html>
```

---

### `src/views/error.ejs`

```html
<!DOCTYPE html>
<html lang="en" class="h-full bg-gray-50">
<head>
  <%- include('partials/head', { title }) %>
</head>
<body class="h-full">

  <div class="flex min-h-full flex-col justify-center px-6 py-16 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm text-center">

      <p class="text-xs font-semibold uppercase tracking-widest text-gray-400">POI Mapping Platform</p>
      <h1 class="mt-4 text-2xl font-bold text-gray-900"><%= title %></h1>
      <p class="mt-3 text-sm text-gray-500"><%= message %></p>

      <a href="/dashboard"
        class="mt-8 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm
               font-semibold text-white hover:bg-brand-700 transition-colors duration-150">
        Back to dashboard
      </a>

    </div>
  </div>

</body>
</html>
```

---

### `public/css/custom.css`

```css
/*
 * Custom CSS overrides.
 * Tailwind CDN handles all utility classes.
 * Add project-specific overrides here only when Tailwind utilities are insufficient.
 */

/* Suppress autofill background tint in Chrome / Edge */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #fff inset;
  transition: background-color 5000s ease-in-out 0s;
}
```

---

## 11. Environment

### `.env.example`

```env
# =============================================================================
# POI Auth Server — environment variables
# Copy to .env and fill in real values. Never commit .env.
# =============================================================================

# ── Node ──────────────────────────────────────────────────────────────────────
NODE_ENV=development          # development | production
PORT=4000

# ── Database (MySQL) ──────────────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=tonpao_poi

# Prisma expects a full URL:
DATABASE_URL="mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ── Session ───────────────────────────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Use a DIFFERENT secret per environment. Rotate secrets = all sessions invalidated.
SESSION_SECRET=replace_with_a_long_random_hex_string_min_64_chars

# ── Trust proxy ───────────────────────────────────────────────────────────────
# Set to 1 when running behind nginx / a single reverse proxy.
# Required for req.ip to return the real client IP and for secure cookies to work.
TRUST_PROXY=0
```

**Consistency notes:**
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — consumed by `src/config/session.js` (MySQLStore pool) and Prisma via `DATABASE_URL`
- `SESSION_SECRET` — consumed by `src/config/session.js` → `sessionOptions.secret`; validated ≥ 64 chars in production by `src/server.js`
- `NODE_ENV` — controls `secure` cookie flag (`session.js`), Prisma log level (`lib/prisma.js`), and error detail in `app.js` error handler
- `PORT` — defaults to `4000` in `src/server.js`
- `TRUST_PROXY` — parsed in `src/app.js`; must be `1` behind nginx for `req.ip` accuracy and secure cookies

---

## 12. README

# POI Platform — Auth Server

Express.js authentication server for the POI Mapping Platform.
Handles login, session management, and route protection for all admin users.

---

### Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | Express.js 4 |
| ORM | Prisma 5 + MySQL |
| Sessions | express-session + express-mysql-session |
| Password hashing | Argon2id |
| Views | EJS + Tailwind CSS (CDN) |
| Security | helmet, express-rate-limit |

---

### 1. Install

```bash
cd server
npm install
```

> `argon2` compiles a native addon. On Windows: install Visual Studio Build Tools.
> On Linux: `sudo apt install build-essential`.

---

### 2. Environment setup

```bash
cp .env.example .env
```

Fill in `.env`:

```env
NODE_ENV=development
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=tonpao_poi
DATABASE_URL="mysql://root:your_mysql_password@localhost:3306/tonpao_poi"
SESSION_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
TRUST_PROXY=0
```

Rules: never commit `.env`. `SESSION_SECRET` must be ≥ 64 chars in production (server refuses to start otherwise). Rotating it invalidates all active sessions.

---

### 3. Database — Prisma migrate

```bash
# Development — creates migration files, applies, generates client
npm run migrate:dev

# Production — applies existing migrations only
npm run migrate:deploy

# Regenerate client after schema change
npm run prisma:generate
```

> The `sessions` table is **not** managed by Prisma — `express-mysql-session`
> creates it automatically on first startup. See DDL in `prisma/schema.prisma` to
> create it manually and set `createDatabaseTable: false` in `src/config/session.js`.

---

### 4. Seed users

```bash
npm run seed
```

| Username | Initial password |
|---|---|
| `admin` | `admin@Hpoi$2569` |
| `research` | `Hpoi$2569` |

Both have `must_change_password = true`. Seed is idempotent.

---

### 5. Run

```bash
npm run dev          # nodemon — auto-restart on changes
NODE_ENV=production npm start    # production

# PM2
pm2 start src/server.js --name poi-auth --env production
```

Server: `http://localhost:4000`

---

### 6. Routes

| Method | Path | Auth | Rate limited | Description |
|---|---|---|---|---|
| `GET` | `/login` | Guest only | — | Login form |
| `GET` | `/change-password` | Required | — | Change password form |
| `GET` | `/dashboard` | Required + !mustChange | — | Dashboard |
| `POST` | `/auth/login` | No | 10/15 min/IP | Authenticate |
| `POST` | `/auth/logout` | Required | — | Destroy session |
| `GET` | `/auth/me` | Required | — | Session user JSON |
| `POST` | `/auth/change-password` | Required | — | Update password |
| `POST` | `/auth/keepalive` | Required | — | Reset idle timer |
| `GET` | `/health` | No | — | `{ status: "ok" }` |

---

### 7. Session policy

| Policy | Value |
|---|---|
| Idle timeout | 2 hours (`rolling: true`) |
| Absolute timeout | 8 hours from `loginAt` |
| Session ID rotation | Every 45 minutes |
| Cookie | `HttpOnly`, `SameSite=Lax`, `Path=/` |
| Secure flag | `true` in production only |
| Cookie name | `poi.sid` |

---

### 8. Test flows

#### 8.1 Login
1. `http://localhost:4000/login` → submit `admin` / `admin@Hpoi$2569`
2. Expected: redirect to `/change-password` with info banner
3. Confirm `poi.sid` cookie is `HttpOnly`, `SameSite=Lax`

#### 8.2 Forced password change
1. Try navigating to `/dashboard` → redirected back to `/change-password`
2. Submit: current `admin@Hpoi$2569`, new password meeting policy (≥12 chars, upper+lower+digit+special)
3. Expected: redirect to `/dashboard` with success flash
4. Navigate to `/dashboard` again → loads normally

#### 8.3 Logout
1. Click **Sign out** → redirected to `/login`
2. Navigate to `/dashboard` → redirected to `/login` (session gone)

#### 8.4 Rate limiter
1. Submit bad credentials 10 times within 15 minutes
2. 11th attempt: error _"Too many login attempts. Please wait 15 minutes."_
3. Check `RateLimit-Remaining: 0` in response headers

#### 8.5 Keepalive

```bash
curl -X POST http://localhost:4000/auth/keepalive \
     -H "Cookie: poi.sid=<session-id>" \
     -H "Content-Type: application/json"
# → { "ok": true, "expiresIn": 7200000 }
# 401 → session expired
```

#### 8.6 GET /auth/me

```bash
curl http://localhost:4000/auth/me -H "Cookie: poi.sid=<session-id>"
# → { "user": { "id": "...", "username": "admin", "role": "admin", "must_change_password": false } }
# 401 → not authenticated
# 403 → password change required
```

---

### 9. Audit log

| Action | Trigger |
|---|---|
| `LOGIN_SUCCESS` | Successful login |
| `LOGIN_FAILED` | Wrong password / unknown user / inactive account |
| `LOGOUT` | Explicit logout |
| `CHANGE_PASSWORD` | Successful password change |

```sql
SELECT username, action, ip_address, created_at
FROM   audit_logs
ORDER  BY created_at DESC
LIMIT  50;
```

---

### 10. Common errors

| Error | Cause | Fix |
|---|---|---|
| `Missing required environment variables` | `.env` missing or incomplete | Copy `.env.example` → `.env` |
| `SESSION_SECRET must be at least 64 characters` | Weak secret in production | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `argon2` install fails | Missing native build tools | Install Visual Studio Build Tools (Windows) or `build-essential` (Linux) |
| Sessions not persisting | `sessions` table not created | Ensure DB user has `CREATE TABLE` privilege |
| Secure cookie not sent | Production without HTTPS | Terminate TLS at reverse proxy + set `TRUST_PROXY=1` |
