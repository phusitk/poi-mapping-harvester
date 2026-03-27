import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  try {
    const { jobId } = await params

    return NextResponse.json(
      {
        success: true,
        message: 'Retry failed grids request queued',
        data: {
          job_id: jobId,
          status: 'processing',
        },
      },
      { status: 202 },
    )
  } catch (error) {
    console.error('Error retrying failed grids:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retry grids' },
      { status: 500 },
    )
  }
}
