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

async function importAreas() {
  let connection = null

  try {
    console.log('Connecting to MySQL...')
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    })

    console.log('Connected to database')

    // Create sample area if no file provided
    console.log('Creating sample area...')

    const areaId = 'a0000000-0000-0000-0000-000000000001'
    const areaBoundary = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [98.9, 18.7],
                [99.0, 18.7],
                [99.0, 18.8],
                [98.9, 18.8],
                [98.9, 18.7],
              ],
            ],
          },
        },
      ],
    }

    await connection.execute(
      `INSERT INTO areas (area_id, area_name, description, boundary_geojson, center_lat, center_lng, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        areaId,
        'Tonpao Region',
        'Sample area for POI mapping',
        JSON.stringify(areaBoundary),
        18.75,
        98.95,
      ],
    )

    console.log('✅ Sample area created!')

    // Create sample grids for the area
    console.log('Creating sample grids...')

    const grids = []
    let gridId = 1

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const gridUUID = `00000000-0000-0000-0000-${String(gridId).padStart(12, '0')}`
        const minLat = 18.7 + row * 0.02
        const minLng = 98.9 + col * 0.02
        const maxLat = minLat + 0.02
        const maxLng = minLng + 0.02
        const centerLat = (minLat + maxLat) / 2
        const centerLng = (minLng + maxLng) / 2

        grids.push([
          gridUUID,
          areaId,
          `GRID-${row}-${col}`,
          row,
          col,
          centerLat,
          centerLng,
          minLat,
          minLng,
          maxLat,
          maxLng,
          'pending',
          null,
        ])

        gridId++
      }
    }

    for (const grid of grids) {
      await connection.execute(
        `INSERT INTO grids (grid_id, area_id, grid_code, row_index, col_index, center_lat, center_lng, min_lat, min_lng, max_lat, max_lng, status, last_harvested_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        grid,
      )
    }

    console.log(`✅ Created ${grids.length} sample grids!`)

    // Create sample keyword set
    console.log('Creating sample keyword set...')

    const keywordSetId = 'b0000000-0000-0000-0000-000000000001'

    await connection.execute(
      `INSERT INTO keyword_sets (keyword_set_id, keyword_set_name, description, is_active, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        keywordSetId,
        'Default Keywords',
        'Default keyword set for POI search',
        true,
      ],
    )

    const keywords = ['Restaurant', 'Cafe', 'Hotel', 'Shop', 'Museum']

    for (let i = 0; i < keywords.length; i++) {
      const keywordItemId = `c${i}000000-0000-0000-0000-000000000001`
      await connection.execute(
        `INSERT INTO keyword_set_items (keyword_item_id, keyword_set_id, keyword_text, sort_order, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [keywordItemId, keywordSetId, keywords[i], i],
      )
    }

    console.log('✅ Sample keyword set created with keywords!')
    console.log('\n✨ Sample data import completed successfully!')
    console.log('You can now select "Tonpao Region" from the dropdown.')

    await connection.end()
  } catch (error) {
    console.error('❌ Import failed:', error)
    if (connection) {
      await connection.end()
    }
    process.exit(1)
  }
}

importAreas()
