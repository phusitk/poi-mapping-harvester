import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client.js'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const createdBy = searchParams.get('createdBy') || undefined
    const search = searchParams.get('search') || undefined

    let queryStr = `SELECT j.job_id, j.job_name, j.job_description,
      j.created_by, j.created_at, j.started_at, j.finished_at,
      j.status, j.collection_type,
      j.total_grids, j.done_grids, j.failed_grids,
      j.total_results, j.total_requests, j.error_message,
      a.area_name, ks.keyword_set_name
    FROM jobs j
    JOIN areas a ON j.area_id = a.area_id
    JOIN keyword_sets ks ON j.keyword_set_id = ks.keyword_set_id
    WHERE 1=1`

    const params = []

    if (status) {
      queryStr += ` AND j.status = ?`
      params.push(status)
    }
    if (dateFrom) {
      queryStr += ` AND j.created_at >= ?`
      params.push(dateFrom)
    }
    if (dateTo) {
      queryStr += ` AND j.created_at <= ?`
      params.push(dateTo)
    }
    if (createdBy) {
      queryStr += ` AND j.created_by = ?`
      params.push(createdBy)
    }
    if (search) {
      queryStr += ` AND (j.job_name LIKE ? OR j.job_description LIKE ?)`
      params.push(`%${search}%`, `%${search}%`)
    }

    queryStr += ` ORDER BY j.created_at DESC`

    const [rows] = await query(queryStr, params)

    const data = rows.map((job, i) => ({
      '#': i + 1,
      'Job ID': job.job_id,
      'ชื่อ Job': job.job_name,
      'คำอธิบาย': job.job_description || '',
      'พื้นที่': job.area_name,
      'Status': job.status,
      'Keyword Set': job.keyword_set_name,
      'ประเภทการเก็บ': job.collection_type,
      'Total Grids': job.total_grids,
      'Done Grids': job.done_grids,
      'Failed Grids': job.failed_grids,
      'POI Collected': job.total_results,
      'Total Requests': job.total_requests,
      'สร้างโดย': job.created_by,
      'สร้างเมื่อ': job.created_at ? new Date(job.created_at).toLocaleString('th-TH') : '',
      'เริ่มเมื่อ': job.started_at ? new Date(job.started_at).toLocaleString('th-TH') : '',
      'เสร็จเมื่อ': job.finished_at ? new Date(job.finished_at).toLocaleString('th-TH') : '',
      'Error': job.error_message || '',
    }))

    const ws = XLSX.utils.json_to_sheet(data)

    // Auto-width columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }))
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Jobs')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `jobs_export_${new Date().toISOString().split('T')[0]}.xlsx`

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
