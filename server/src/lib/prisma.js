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
