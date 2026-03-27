import { NextResponse } from 'next/server'
import { getJobByIdWithDetails } from '@/lib/db/queries.js'
import { query } from '@/lib/db/client.js'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { jobId } = await params

    const job = await getJobByIdWithDetails(jobId)

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: job }, { status: 200 })
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job' },
      { status: 500 },
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    const { jobId } = await params

    const [rows] = await query(
      `SELECT job_id, status FROM jobs WHERE job_id = ?`,
      [jobId],
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 },
      )
    }

    if (rows[0].status === 'processing') {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถลบ Job ที่กำลังประมวลผลอยู่ได้' },
        { status: 409 },
      )
    }

    // CASCADE deletes job_grids, poi_raw, poi_job_map, exports automatically
    await query(`DELETE FROM jobs WHERE job_id = ?`, [jobId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete job' },
      { status: 500 },
    )
  }
}
