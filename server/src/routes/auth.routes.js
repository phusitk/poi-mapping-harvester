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
const requireAuth = require('../middleware/requireAuth')
const guestOnly   = require('../middleware/guestOnly')

const router = Router()

// GET /login
router.get('/login', guestOnly, (req, res) => {
  res.render('login', {
    title: 'Sign In',
    flash: res.locals.flash,
  })
})

// GET /change-password (optional — accessible but not forced)
router.get('/change-password', requireAuth, (req, res) => {
  res.render('change-password', {
    title: 'Change Password',
    user : req.user,
    flash: res.locals.flash,
  })
})

// POST /auth/login
router.post('/auth/login', loginRateLimiter, loginValidationRules, login)

// POST /auth/logout
router.post('/auth/logout', requireAuth, logout)

// GET /auth/me
router.get('/auth/me', requireAuth, me)

// POST /auth/change-password
router.post('/auth/change-password', requireAuth, changePasswordValidationRules, changePassword)

// POST /auth/keepalive
router.post('/auth/keepalive', requireAuth, keepalive)

module.exports = router
