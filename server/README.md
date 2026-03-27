# POI Platform — Auth Server

Express.js authentication server for the POI Mapping Platform.
Handles login, session management, and route protection for all admin users.

---

## Stack

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

## Project structure

```
server/
├── prisma/
│   ├── schema.prisma        # users + audit_logs models
│   └── seed.js              # seeds admin and research users
├── src/
│   ├── server.js            # entry point — listen + graceful shutdown
│   ├── app.js               # Express app, middleware chain, routes
│   ├── config/
│   │   ├── session.js       # MySQLStore + session options
│   │   └── security.js      # helmet config + login rate limiter
│   ├── controllers/
│   │   └── auth.controller.js
│   ├── services/
│   │   ├── auth.service.js  # findByUsername, verifyPassword, changePassword
│   │   └── audit.service.js # audit log writes
│   ├── middleware/
│   │   ├── requireAuth.js
│   │   ├── mustChangePassword.js
│   │   └── guestOnly.js
│   ├── routes/
│   │   └── auth.routes.js
│   ├── lib/
│   │   └── prisma.js        # singleton PrismaClient
│   └── views/
│       ├── partials/
│       │   ├── head.ejs
│       │   └── flash.ejs
│       ├── login.ejs
│       ├── change-password.ejs
│       ├── dashboard.ejs
│       └── error.ejs
└── public/
    └── css/
        └── custom.css
```

---

## 1. Install

```bash
cd server
npm install
```

> `argon2` compiles a native addon. Node.js build tools (`node-gyp`) are required.
> On Windows: `npm install --global windows-build-tools` or install Visual Studio Build Tools.

---

## 2. Environment setup

```bash
cp .env.example .env
```

Edit `.env` and fill in every value:

```env
NODE_ENV=development
PORT=4000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=tonpao_poi

# Full Prisma connection URL — must match the four DB_ vars above
DATABASE_URL="mysql://root:your_mysql_password@localhost:3306/tonpao_poi"

# Generate a strong secret:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=<64-char-hex-string>

# Set to 1 when running behind nginx / a reverse proxy
TRUST_PROXY=0
```

**Rules:**
- Never commit `.env`
- `SESSION_SECRET` must be ≥ 64 characters in production — the server will refuse to start otherwise
- Use a different `SESSION_SECRET` per environment — rotating it invalidates all active sessions

---

## 3. Database — Prisma migrate

### Development (creates migration files, applies them, generates client)

```bash
npm run migrate:dev
# Prisma will prompt for a migration name, e.g. "init_auth"
```

### Production (applies existing migrations only — no file generation)

```bash
npm run migrate:deploy
```

### Regenerate Prisma client after schema changes

```bash
npm run prisma:generate
```

> The `sessions` table is **not** managed by Prisma. `express-mysql-session`
> creates it automatically on first startup if the DB user has `CREATE TABLE`
> privilege. To create it manually instead, see the DDL comment in
> `prisma/schema.prisma` and set `createDatabaseTable: false` in
> `src/config/session.js`.

---

## 4. Seed users

```bash
npm run seed
```

Creates two admin accounts with `must_change_password = true`:

| Username | Initial password |
|---|---|
| `admin` | `admin@Hpoi$2569` |
| `research` | `Hpoi$2569` |

Seed is **idempotent** — safe to run multiple times. On re-seed the password
hash is refreshed and `must_change_password` is reset to `true`.
`role` and `is_active` are not overwritten on re-seed.

---

## 5. Run

### Development (nodemon — auto-restarts on file changes)

```bash
npm run dev
```

Server starts at `http://localhost:4000`

### Production

```bash
NODE_ENV=production npm start
```

For production deployments, run behind a process manager:

```bash
# PM2 example
pm2 start src/server.js --name poi-auth --env production
pm2 save
```

Set `TRUST_PROXY=1` and `NODE_ENV=production` in your production `.env`.

---

## 6. Routes

### Page routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/login` | Guest only | Login form — redirects away if already authenticated |
| `GET` | `/change-password` | Required | Change password form |
| `GET` | `/dashboard` | Required | Dashboard — blocked if `must_change_password = true` |

### Auth API routes

| Method | Path | Auth | Rate limited | Description |
|---|---|---|---|---|
| `POST` | `/auth/login` | No | Yes — 10/15 min/IP | Authenticate and create session |
| `POST` | `/auth/logout` | Required | No | Destroy session and clear cookie |
| `GET` | `/auth/me` | Required | No | Return `{ user }` as JSON |
| `POST` | `/auth/change-password` | Required | No | Validate and update password |
| `POST` | `/auth/keepalive` | Required | No | Reset idle timer for long sessions |

### Health check

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok" }` — no auth required |

---

## 7. Session policy

| Policy | Value |
|---|---|
| Idle timeout | 2 hours (`rolling: true` resets on every response) |
| Absolute timeout | 8 hours from `loginAt` (enforced in `sessionRenew` middleware) |
| Session ID rotation | Every 45 minutes (enforced in `sessionRenew` middleware) |
| Cookie flags | `HttpOnly`, `SameSite=Lax`, `Path=/` |
| Secure flag | `true` in production only |
| Cookie name | `poi.sid` (not the default `connect.sid`) |

---

## 8. Test flows

### 8.1 Login

1. Open `http://localhost:4000/login`
2. Submit username `admin` / password `admin@Hpoi$2569`
3. **Expected:** redirected to `/change-password` with the info banner
   _"You must set a new password before continuing."_
4. Confirm the `poi.sid` cookie is set — `HttpOnly`, `SameSite=Lax`

---

### 8.2 Forced password change

Continuing from 8.1:

1. Attempt to navigate directly to `/dashboard`
2. **Expected:** redirected back to `/change-password` — `mustChangePassword`
   middleware is blocking all other routes
3. Submit the change-password form:
   - **Current password:** `admin@Hpoi$2569`
   - **New password:** something that satisfies policy
     (≥ 12 chars, uppercase + lowercase + digit + special character)
   - **Confirm:** same value
4. **Expected:** redirected to `/dashboard` with success flash
5. Navigate to `/dashboard` again — **expected:** page loads normally, no redirect

---

### 8.3 Logout

1. From `/dashboard`, click **Sign out**
2. **Expected:** redirected to `/login`
3. Navigate to `/dashboard` directly
4. **Expected:** redirected to `/login` — session is gone

---

### 8.4 Rate limiter

1. Open `/login`
2. Submit bad credentials 10 times within 15 minutes
3. **Expected:** on the 11th attempt the page reloads with the error
   _"Too many login attempts. Please wait 15 minutes and try again."_
4. Check response headers for `RateLimit-Remaining: 0` and `RateLimit-Reset`

---

### 8.5 Keepalive (long sessions)

Simulate with `curl` or any HTTP client:

```bash
# Must have an active session cookie from a previous login
curl -X POST http://localhost:4000/auth/keepalive \
     -H "Cookie: poi.sid=<your-session-id>" \
     -H "Content-Type: application/json"
```

**Expected response:**

```json
{ "ok": true, "expiresIn": 7200000 }
```

`expiresIn` is the remaining cookie `maxAge` in milliseconds.
A `401` response means the session has already expired.

On the dashboard the browser automatically pings `/auth/keepalive` every
30 minutes. It stops once 8 hours have passed from initial login (`loginAt`).

---

### 8.6 GET /auth/me

```bash
curl http://localhost:4000/auth/me \
     -H "Cookie: poi.sid=<your-session-id>"
```

**Expected:**

```json
{
  "user": {
    "id": "...",
    "username": "admin",
    "role": "admin",
    "must_change_password": false
  }
}
```

Unauthenticated: `401 { "error": "Authentication required." }`
Password change pending: `403 { "error": "Password change required.", "must_change_password": true }`

---

## 9. Audit log

Every significant auth event is recorded in the `audit_logs` table:

| Action | Trigger |
|---|---|
| `LOGIN_SUCCESS` | Successful login |
| `LOGIN_FAILED` | Wrong password, unknown username, or inactive account |
| `LOGOUT` | Explicit logout |
| `CHANGE_PASSWORD` | Successful password change |

Query recent events:

```sql
SELECT username, action, ip_address, created_at
FROM   audit_logs
ORDER  BY created_at DESC
LIMIT  50;
```

---

## 10. Common errors

| Error | Cause | Fix |
|---|---|---|
| `Missing required environment variables` | `.env` not found or incomplete | Copy `.env.example` → `.env` and fill all values |
| `SESSION_SECRET must be at least 64 characters` | Weak secret in production | Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `argon2` install fails | Missing native build tools | Install Visual Studio Build Tools (Windows) or `build-essential` (Linux) |
| Sessions not persisting | `sessions` table not created | Ensure DB user has `CREATE TABLE` privilege, or create the table manually (DDL in `schema.prisma`) |
| Secure cookie not sent | Running in production without HTTPS | Ensure HTTPS is terminated at the reverse proxy and `TRUST_PROXY=1` is set |
