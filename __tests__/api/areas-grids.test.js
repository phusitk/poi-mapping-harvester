import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })) },
}))

vi.mock('@/lib/db/queries.js', () => ({
  getAreaById: vi.fn(),
  getGridsByAreaId: vi.fn(),
}))

import { getAreaById, getGridsByAreaId } from '@/lib/db/queries.js'
import { GET } from '@/app/api/areas/[areaId]/grids/route.js'

const AREA = { area_id: 'a-uuid-1', area_name: 'Tonpao Region', description: 'Test' }
const GRIDS = [
  { grid_id: 'g-1', grid_code: 'G001', row_index: 0, col_index: 0, status: 'pending' },
  { grid_id: 'g-2', grid_code: 'G002', row_index: 0, col_index: 1, status: 'completed' },
]

const makeParams = (areaId) => ({ params: Promise.resolve({ areaId }) })

describe('GET /api/areas/[areaId]/grids', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with area and grids when area exists', async () => {
    getAreaById.mockResolvedValueOnce(AREA)
    getGridsByAreaId.mockResolvedValueOnce(GRIDS)

    const res = await GET(null, makeParams('a-uuid-1'))

    expect(res._status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data.area).toEqual(AREA)
    expect(res._body.data.grids).toEqual(GRIDS)
  })

  it('returns 404 when area does not exist', async () => {
    getAreaById.mockResolvedValueOnce(undefined)

    const res = await GET(null, makeParams('missing'))

    expect(res._status).toBe(404)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Area not found')
    expect(getGridsByAreaId).not.toHaveBeenCalled()
  })

  it('returns 200 with empty grids array when area has no grids', async () => {
    getAreaById.mockResolvedValueOnce(AREA)
    getGridsByAreaId.mockResolvedValueOnce([])

    const res = await GET(null, makeParams('a-uuid-1'))

    expect(res._status).toBe(200)
    expect(res._body.data.grids).toEqual([])
  })

  it('returns 500 when getAreaById throws', async () => {
    getAreaById.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET(null, makeParams('a-uuid-1'))

    expect(res._status).toBe(500)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Failed to fetch area grids')
  })

  it('returns 500 when getGridsByAreaId throws', async () => {
    getAreaById.mockResolvedValueOnce(AREA)
    getGridsByAreaId.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET(null, makeParams('a-uuid-1'))

    expect(res._status).toBe(500)
    expect(res._body.success).toBe(false)
  })

  it('passes the correct areaId to both queries', async () => {
    getAreaById.mockResolvedValueOnce(AREA)
    getGridsByAreaId.mockResolvedValueOnce([])

    await GET(null, makeParams('a-uuid-1'))

    expect(getAreaById).toHaveBeenCalledWith('a-uuid-1')
    expect(getGridsByAreaId).toHaveBeenCalledWith('a-uuid-1')
  })
})
