import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client.js'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { jobId } = await params
  const searchParams = request.nextUrl.searchParams

  const page     = Math.max(1, parseInt(searchParams.get('page')     || '1',  10))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)))
  const keyword  = searchParams.get('keyword')  || undefined
  const gridCode = searchParams.get('gridCode') || undefined

  try {
    let whereClause = `WHERE pr.job_id = ?`
    const whereParams = [jobId]

    if (keyword) {
      whereClause += ` AND pr.keyword_text = ?`
      whereParams.push(keyword)
    }
    if (gridCode) {
      whereClause += ` AND g.grid_code = ?`
      whereParams.push(gridCode)
    }

    const baseJoin = `FROM poi_raw pr JOIN grids g ON pr.grid_id = g.grid_id`

    const [countRows] = await query(
      `SELECT COUNT(*) as total ${baseJoin} ${whereClause}`,
      whereParams,
    )
    const total  = countRows[0].total
    const offset = (page - 1) * pageSize

    const [rows] = await query(
      `SELECT pr.poi_raw_id, g.grid_code, pr.keyword_text,
              pr.place_id, pr.place_name, pr.primary_category,
              pr.address, pr.latitude, pr.longitude,
              pr.rating, pr.reviews_count, pr.harvested_at
       ${baseJoin} ${whereClause}
       ORDER BY pr.harvested_at ASC, pr.place_name ASC
       LIMIT ? OFFSET ?`,
      [...whereParams, pageSize, offset],
    )

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching POI for job:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch POI data' },
      { status: 500 },
    )
  }
}
