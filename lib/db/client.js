import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tonpao_poi',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export const query = (text, params) => {
  return pool.query(text, params)
}

export const getClient = async () => {
  return pool.getConnection()
}

export default pool
