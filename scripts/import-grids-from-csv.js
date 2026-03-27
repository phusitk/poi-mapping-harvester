#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { createInterface } from 'readline'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const AREA_ID = 'a0000000-0000-0000-0000-000000000001'
const CSV_PATH = path.join(process.cwd(), 'grid_area', 'tonpao_grid_200m_centroid.csv')

// 200m grid: half = 100m
// 1 degree lat ≈ 111,320 m
const HALF_LAT = 100 / 111320

function halfLng(lat) {
  return 100 / (111320 * Math.cos((lat * Math.PI) / 180))
}

async function parseCSV(filePath) {
  const grids = []
  const rl = createInterface({ input: fs.createReadStream(filePath) })
  let isHeader = true

  for await (const line of rl) {
    // Each row is wrapped in double quotes — strip them first
    const raw = line.replace(/^"|"$/g, '')
    const cols = raw.split(',')

    if (isHeader) {
      isHeader = false
      continue
    }

    // Columns: X,Y,fid,id,left,top,right,bottom,row_index,col_index,lon,lat
    const lon = parseFloat(cols[10])
    const lat = parseFloat(cols[11])
    const row_index = parseInt(cols[8])
    const col_index = parseInt(cols[9])
    const fid = parseInt(cols[2]) // cols[2] = fid (unique sequential ID)

    if (isNaN(lon) || isNaN(lat) || isNaN(fid)) continue

    const hLat = HALF_LAT
    const hLng = halfLng(lat)

    grids.push({
      grid_id: randomUUID(),
      area_id: AREA_ID,
      grid_code: `G${fid}`,   // use fid as unique code
      row_index,
      col_index,
      center_lat: lat,
      center_lng: lon,
      min_lat: lat - hLat,
      max_lat: lat + hLat,
      min_lng: lon - hLng,
      max_lng: lon + hLng,
    })
  }

  return grids
}

async function run() {
  let connection = null

  try {
    console.log('Connecting to MySQL...')
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tonpao_poi',
    })
    console.log('Connected.')

    // Parse CSV
    console.log(`Reading CSV: ${CSV_PATH}`)
    const grids = await parseCSV(CSV_PATH)
    console.log(`Parsed ${grids.length} grids from CSV.`)

    // Calculate area bounding box from grid centroids
    const minLat = Math.min(...grids.map((g) => g.min_lat))
    const maxLat = Math.max(...grids.map((g) => g.max_lat))
    const minLng = Math.min(...grids.map((g) => g.min_lng))
    const maxLng = Math.max(...grids.map((g) => g.max_lng))
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    const areaBoundary = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat],
              ],
            ],
          },
        },
      ],
    }

    // Update area boundary and center
    console.log('Updating area boundary...')
    await connection.execute(
      `UPDATE areas SET boundary_geojson = ?, center_lat = ?, center_lng = ?, updated_at = NOW()
       WHERE area_id = ?`,
      [JSON.stringify(areaBoundary), centerLat, centerLng, AREA_ID],
    )
    console.log(`✅ Area boundary updated (center: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)})`)

    // Delete old grids
    console.log('Removing old grids...')
    const [deleteResult] = await connection.execute(
      `DELETE FROM grids WHERE area_id = ?`,
      [AREA_ID],
    )
    console.log(`✅ Removed ${deleteResult.affectedRows} old grids.`)

    // Insert new grids in batches of 100
    console.log('Inserting new grids...')
    const BATCH = 100
    let inserted = 0

    for (let i = 0; i < grids.length; i += BATCH) {
      const batch = grids.slice(i, i + BATCH)
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(), NOW())').join(', ')
      const values = batch.flatMap((g) => [
        g.grid_id,
        g.area_id,
        g.grid_code,
        g.row_index,
        g.col_index,
        g.center_lat,
        g.center_lng,
        g.min_lat,
        g.min_lng,
        g.max_lat,
        g.max_lng,
        'pending',
      ])

      await connection.execute(
        `INSERT INTO grids (grid_id, area_id, grid_code, row_index, col_index,
          center_lat, center_lng, min_lat, min_lng, max_lat, max_lng,
          status, last_harvested_at, created_at, updated_at)
         VALUES ${placeholders}`,
        values,
      )

      inserted += batch.length
      process.stdout.write(`\r  Progress: ${inserted}/${grids.length}`)
    }

    console.log(`\n✅ Inserted ${inserted} grids successfully!`)
    console.log('\n✨ Done! Refresh the app to see the real grid data.')

    await connection.end()
  } catch (error) {
    console.error('\n❌ Import failed:', error.message)
    if (connection) await connection.end()
    process.exit(1)
  }
}

run()
