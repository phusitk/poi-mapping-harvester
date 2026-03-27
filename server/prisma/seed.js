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
    must_change_password: false,
  },
  {
    username: 'research',
    plainPassword: 'Hpoi$2569',
    role: 'admin',
    must_change_password: false,
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
