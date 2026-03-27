import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })) },
}))

vi.mock('@/lib/db/queries.js', () => ({
  getActiveKeywordSets: vi.fn(),
}))

import { getActiveKeywordSets } from '@/lib/db/queries.js'
import { GET } from '@/app/api/keyword-sets/route.js'

const KW_SETS = [
  { keyword_set_id: 'ks-1', keyword_set_name: 'Tourism POI Types', is_active: true },
  { keyword_set_id: 'ks-2', keyword_set_name: 'Food & Beverage',   is_active: true },
]

describe('GET /api/keyword-sets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with all active keyword sets', async () => {
    getActiveKeywordSets.mockResolvedValueOnce(KW_SETS)

    const res = await GET()

    expect(res._status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data).toEqual(KW_SETS)
  })

  it('returns 200 with empty array when no active sets', async () => {
    getActiveKeywordSets.mockResolvedValueOnce([])

    const res = await GET()

    expect(res._status).toBe(200)
    expect(res._body.data).toEqual([])
  })

  it('returns 500 when DB throws', async () => {
    getActiveKeywordSets.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET()

    expect(res._status).toBe(500)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Failed to fetch keyword sets')
  })

  it('calls getActiveKeywordSets exactly once', async () => {
    getActiveKeywordSets.mockResolvedValueOnce([])
    await GET()
    expect(getActiveKeywordSets).toHaveBeenCalledOnce()
  })
})
