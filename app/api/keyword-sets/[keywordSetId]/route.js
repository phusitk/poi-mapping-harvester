import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { keywordSetId } = await params

    return NextResponse.json(
      {
        success: true,
        data: {
          keyword_set_id: keywordSetId,
          keyword_set_name: 'Keyword Set',
          description: '',
          is_active: true,
          created_at: new Date().toISOString(),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching keyword set:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch keyword set' },
      { status: 500 },
    )
  }
}
