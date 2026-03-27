import { NextResponse } from 'next/server'
import { getActiveKeywordSets } from '@/lib/db/queries.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const keywordSets = await getActiveKeywordSets()

    return NextResponse.json(
      {
        success: true,
        data: keywordSets,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching keyword sets:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch keyword sets',
      },
      { status: 500 },
    )
  }
}
