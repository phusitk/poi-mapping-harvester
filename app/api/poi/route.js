import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    return NextResponse.json(
      {
        success: true,
        data: [],
        message: 'POI endpoint not yet implemented',
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching POI:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch POI',
      },
      { status: 500 },
    )
  }
}
