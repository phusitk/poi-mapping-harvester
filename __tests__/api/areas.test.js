import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })) },
}))

vi.mock('@/lib/db/queries.js', () => ({
  getAreas: vi.fn(),
}))

import { NextResponse } from 'next/server'
import { getAreas } from '@/lib/db/queries.js'
import { GET } from '@/app/api/areas/route.js'

describe('GET /api/areas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with areas array on success', async () => {
    const areas = [
      { area_id: 'a-1', area_name: 'Tonpao Region' },
      { area_id: 'a-2', area_name: 'Chiang Mai' },
    ]
    getAreas.mockResolvedValueOnce(areas)

    const res = await GET()

    expect(res._status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data).toEqual(areas)
  })

  it('returns 200 with empty array when no areas exist', async () => {
    getAreas.mockResolvedValueOnce([])

    const res = await GET()

    expect(res._status).toBe(200)
    expect(res._body.data).toEqual([])
  })

  it('returns 500 when DB throws an error', async () => {
    getAreas.mockRejectedValueOnce(new Error('DB connection failed'))

    const res = await GET()

    expect(res._status).toBe(500)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Failed to fetch areas')
  })

  it('calls getAreas exactly once per request', async () => {
    getAreas.mockResolvedValueOnce([])
    await GET()
    expect(getAreas).toHaveBeenCalledOnce()
  })
})
