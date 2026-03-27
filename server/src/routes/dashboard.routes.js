'use strict'

const { Router } = require('express')
const requireAuth = require('../middleware/requireAuth')

const router = Router()

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

// GET /dashboard
router.get('/', requireAuth, (req, res) => {
  res.render('dashboard', {
    title  : 'Dashboard',
    user   : req.user,
    flash  : res.locals.flash,
    appUrl : APP_URL,
  })
})

module.exports = router
