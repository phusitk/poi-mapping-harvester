import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { exportId } = await params

    return NextResponse.json(
      {
        success: false,
        error: 'Export download not yet implemented',
      },
      { status: 501 },
    )
  } catch (error) {
    console.error('Error downloading export:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to download export' },
      { status: 500 },
    )
  }
}
