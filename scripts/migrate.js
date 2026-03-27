#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const DB_HOST = process.env.DB_HOST || 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT || '3306')
const DB_USER = process.env.DB_USER || 'root'
const DB_PASSWORD = process.env.DB_PASSWORD || ''
const DB_NAME = process.env.DB_NAME || 'tonpao_poi'

async function runMigration() {
  let connection = null

  try {
    console.log('Connecting to MySQL...')

    // First connection to create database
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
    })

    console.log(`Creating database ${DB_NAME} if not exists...`)
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`)
    await connection.end()

    // Now connect to the specific database
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    })

    console.log(`Connected to ${DB_NAME}`)

    // Read migration file
    const migrationFile = path.join(
      process.cwd(),
      'lib',
      'db',
      'migrations',
      'init_mysql.sql',
    )

    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`)
    }

    const sql = fs.readFileSync(migrationFile, 'utf-8')

    // Split SQL statements by semicolon and execute
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    console.log(`Executing ${statements.length} SQL statements...`)

    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 60)}...`)
        await connection.execute(statement)
      } catch (error) {
        console.error(`Error executing statement: ${statement}`)
        throw error
      }
    }

    console.log('✅ Migration completed successfully!')

    await connection.end()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    if (connection) {
      await connection.end()
    }
    process.exit(1)
  }
}

runMigration()
