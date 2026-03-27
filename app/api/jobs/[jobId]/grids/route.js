import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { jobId } = await params

    return NextResponse.json(
      {
        success: true,
        data: {
          grids: [],
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching job grids:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job grids' },
      { status: 500 },
    )
  }
}
