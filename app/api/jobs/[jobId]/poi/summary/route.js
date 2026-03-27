import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client.js'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { jobId } = await params

  try {
    const [rows] = await query(
      `SELECT
         COALESCE(primary_category, '(ไม่ระบุ)') AS category,
         COUNT(*)                                  AS count
       FROM poi_raw
       WHERE job_id = ?
       GROUP BY primary_category
       ORDER BY count DESC`,
      [jobId],
    )

    const total = rows.reduce((sum, r) => sum + Number(r.count), 0)

    const data = rows.map((r) => ({
      category: r.category,
      count:    Number(r.count),
      percent:  total > 0 ? Math.round((Number(r.count) / total) * 1000) / 10 : 0,
    }))

    return NextResponse.json({ success: true, data, total })
  } catch (error) {
    console.error('POI summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch POI summary' },
      { status: 500 },
    )
  }
}
