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
    ipAddress: req.ip                     ?? null,
    userAgent: req.get('user-agent')      ?? null,
    metadata,
  })
}

module.exports = { createAuditLog, auditFromRequest, AUDIT_ACTIONS }
