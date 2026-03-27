import { NextResponse } from 'next/server'
import { getAreaById, getGridsByAreaId } from '@/lib/db/queries.js'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { areaId } = await params

    const area = await getAreaById(areaId)
    if (!area) {
      return NextResponse.json(
        { success: false, error: 'Area not found' },
        { status: 404 },
      )
    }

    const grids = await getGridsByAreaId(areaId)

    return NextResponse.json(
      {
        success: true,
        data: {
          area,
          grids,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching area grids:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch area grids' },
      { status: 500 },
    )
  }
}
