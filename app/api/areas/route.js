import { NextResponse } from 'next/server'
import { getAreas } from '@/lib/db/queries.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const areas = await getAreas()

    return NextResponse.json(
      {
        success: true,
        data: areas,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching areas:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch areas',
      },
      { status: 500 },
    )
  }
}
