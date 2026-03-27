import argon2 from 'argon2'
import pool from '../db/client.js'

const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$dummysaltdummysalt$dummyhashvaluedummyhashvaluedummyh'

export async function findByUsername(username) {
  const [rows] = await pool.query(
    `SELECT id, username, password_hash, role, is_active
       FROM users
      WHERE username = ?
      LIMIT 1`,
    [username.trim().toLowerCase()],
  )
  return rows[0] ?? null
}

/**
 * Always runs argon2.verify even for unknown usernames to prevent
 * timing-based user enumeration attacks.
 */
export async function verifyLogin(username, password) {
  const user = await findByUsername(username)
  const hash = user ? user.password_hash : DUMMY_HASH

  let passwordValid = false
  try {
    passwordValid = await argon2.verify(hash, password)
  } catch {
    passwordValid = false
  }

  if (!user || !user.is_active || !passwordValid) return null
  return user
}

export function safeUser(user) {
  return { id: user.id, username: user.username, role: user.role }
}
