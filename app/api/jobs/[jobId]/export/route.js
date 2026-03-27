import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client.js'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { jobId } = await params

  try {
    // Verify job exists and get job info
    const [jobRows] = await query(
      `SELECT j.job_id, j.job_name, j.status, a.area_name
       FROM jobs j
       JOIN areas a ON j.area_id = a.area_id
       WHERE j.job_id = ?`,
      [jobId],
    )

    if (jobRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 },
      )
    }

    const job = jobRows[0]

    // Fetch POI raw data for this job
    const [rows] = await query(
      `SELECT
        pr.poi_raw_id,
        g.grid_code,
        pr.keyword_text,
        pr.place_id,
        pr.place_name,
        pr.primary_category,
        pr.address,
        pr.latitude,
        pr.longitude,
        pr.rating,
        pr.reviews_count,
        pr.harvested_at
       FROM poi_raw pr
       JOIN grids g ON pr.grid_id = g.grid_id
       WHERE pr.job_id = ?
       ORDER BY pr.harvested_at ASC, pr.place_name ASC`,
      [jobId],
    )

    const data = rows.map((row, i) => ({
      '#': i + 1,
      'Grid Code': row.grid_code,
      'Keyword': row.keyword_text || '',
      'Place ID': row.place_id || '',
      'ชื่อสถานที่': row.place_name || '',
      'ประเภท': row.primary_category || '',
      'ที่อยู่': row.address || '',
      'Latitude': row.latitude != null ? parseFloat(row.latitude) : '',
      'Longitude': row.longitude != null ? parseFloat(row.longitude) : '',
      'Rating': row.rating != null ? parseFloat(row.rating) : '',
      'Reviews': row.reviews_count ?? '',
      'Harvested At': row.harvested_at
        ? new Date(row.harvested_at).toLocaleString('th-TH')
        : '',
    }))

    const ws = XLSX.utils.json_to_sheet(data)

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 12 },  // Grid Code
      { wch: 20 },  // Keyword
      { wch: 30 },  // Place ID
      { wch: 35 },  // ชื่อสถานที่
      { wch: 20 },  // ประเภท
      { wch: 40 },  // ที่อยู่
      { wch: 12 },  // Latitude
      { wch: 12 },  // Longitude
      { wch: 8 },   // Rating
      { wch: 10 },  // Reviews
      { wch: 20 },  // Harvested At
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'POI Data')

    // Summary sheet
    const summary = [
      { 'รายการ': 'Job Name', 'ค่า': job.job_name },
      { 'รายการ': 'Job ID', 'ค่า': job.job_id },
      { 'รายการ': 'Area', 'ค่า': job.area_name },
      { 'รายการ': 'Status', 'ค่า': job.status },
      { 'รายการ': 'Total POI', 'ค่า': rows.length },
      {
        'รายการ': 'Exported At',
        'ค่า': new Date().toLocaleString('th-TH'),
      },
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summary)
    wsSummary['!cols'] = [{ wch: 18 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const safeName = job.job_name.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_').slice(0, 50)
    const filename = `poi_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 },
    )
  }
}
