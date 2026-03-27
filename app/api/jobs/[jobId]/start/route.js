import { NextResponse } from 'next/server'
import { getJobByIdWithDetails } from '@/lib/db/queries.js'
import { triggerPOIWorker } from '@/lib/triggerWorker.js'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  try {
    const { jobId } = await params

    const job = await getJobByIdWithDetails(jobId)
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 },
      )
    }

    if (job.status === 'processing') {
      return NextResponse.json(
        { success: false, error: 'Job is already processing' },
        { status: 409 },
      )
    }

    if (job.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Job is already completed' },
        { status: 409 },
      )
    }

    const { pid, logFile } = triggerPOIWorker(jobId)

    return NextResponse.json(
      {
        success: true,
        data: { job_id: jobId, pid, logFile, message: 'Worker started' },
      },
      { status: 202 },
    )
  } catch (error) {
    console.error('Error starting job worker:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start worker' },
      { status: 500 },
    )
  }
}
