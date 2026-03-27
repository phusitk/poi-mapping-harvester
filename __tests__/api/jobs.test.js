import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })) },
}))

vi.mock('@/lib/db/queries.js', () => ({
  getAreaById: vi.fn(),
  getKeywordSetById: vi.fn(),
  getGridsByIds: vi.fn(),
  createJobWithGrids: vi.fn(),
  getJobsList: vi.fn(),
  getJobSummary: vi.fn(),
}))

import {
  getAreaById, getKeywordSetById, getGridsByIds,
  createJobWithGrids, getJobsList, getJobSummary,
} from '@/lib/db/queries.js'
import { GET, POST } from '@/app/api/jobs/route.js'

// ─── Fixtures ────────────────────────────────────────────
const VALID_UUID = '11111111-2222-3333-4444-555555555555'
const AREA_UUID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const KS_UUID    = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const GRID_UUID  = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const validBody = {
  area_id: AREA_UUID,
  job_name: 'G001_20260324_120000',
  created_by: 'Research team',
  keyword_set_id: KS_UUID,
  collection_type: 'nearby_search',
  selected_grid_ids: [GRID_UUID],
}

const mockArea    = { area_id: AREA_UUID, area_name: 'Tonpao' }
const mockKwSet   = { keyword_set_id: KS_UUID, keyword_set_name: 'Tourism', is_active: true }
const mockGrids   = [{ grid_id: GRID_UUID, area_id: AREA_UUID }]
const mockCreated = { job_id: VALID_UUID, status: 'pending', job_name: 'G001_20260324_120000', total_grids: 1 }

/** Build a minimal Next.js Request-like object */
const makeRequest = (searchParams = {}) => ({
  nextUrl: {
    searchParams: {
      get: (key) => searchParams[key] ?? null,
    },
  },
})

const makePostRequest = (body) => ({
  json: async () => body,
})

// ─────────────────────────────────────────────────────────
// GET /api/jobs
// ─────────────────────────────────────────────────────────
describe('GET /api/jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with paginated jobs', async () => {
    const jobsData = {
      jobs: [{ job_id: 'j-1', job_name: 'Job 1', status: 'pending' }],
      total: 1, page: 1, pageSize: 10,
    }
    getJobsList.mockResolvedValueOnce(jobsData)

    const res = await GET(makeRequest())

    expect(res._status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data).toEqual(jobsData.jobs)
    expect(res._body.meta.total).toBe(1)
    expect(res._body.meta.totalPages).toBe(1)
  })

  it('includes summary when ?summary=true', async () => {
    const jobsData = { jobs: [], total: 0, page: 1, pageSize: 10 }
    const summary  = { total_jobs_count: '5', total_completed_jobs: '3', total_failed_jobs: '1', total_poi_collected: '500' }
    getJobsList.mockResolvedValueOnce(jobsData)
    getJobSummary.mockResolvedValueOnce(summary)

    const res = await GET(makeRequest({ summary: 'true' }))

    expect(res._body.summary.total_jobs_count).toBe(5)
    expect(res._body.summary.total_poi_collected).toBe(500)
    expect(getJobSummary).toHaveBeenCalledOnce()
  })

  it('does NOT call getJobSummary when summary param is absent', async () => {
    getJobsList.mockResolvedValueOnce({ jobs: [], total: 0, page: 1, pageSize: 10 })

    await GET(makeRequest())

    expect(getJobSummary).not.toHaveBeenCalled()
  })

  it('forwards status filter to getJobsList', async () => {
    getJobsList.mockResolvedValueOnce({ jobs: [], total: 0, page: 1, pageSize: 10 })

    await GET(makeRequest({ status: 'completed' }))

    expect(getJobsList.mock.calls[0][0].status).toBe('completed')
  })

  it('forwards search filter to getJobsList', async () => {
    getJobsList.mockResolvedValueOnce({ jobs: [], total: 0, page: 1, pageSize: 10 })

    await GET(makeRequest({ search: 'Tonpao' }))

    expect(getJobsList.mock.calls[0][0].search).toBe('Tonpao')
  })

  it('forwards createdBy filter to getJobsList', async () => {
    getJobsList.mockResolvedValueOnce({ jobs: [], total: 0, page: 1, pageSize: 10 })

    await GET(makeRequest({ createdBy: 'Research team' }))

    expect(getJobsList.mock.calls[0][0].createdBy).toBe('Research team')
  })

  it('parses page and pageSize from query params', async () => {
    getJobsList.mockResolvedValueOnce({ jobs: [], total: 0, page: 2, pageSize: 5 })

    await GET(makeRequest({ page: '2', pageSize: '5' }))

    expect(getJobsList.mock.calls[0][1]).toBe(2)
    expect(getJobsList.mock.calls[0][2]).toBe(5)
  })

  it('returns 500 when getJobsList throws', async () => {
    getJobsList.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET(makeRequest())

    expect(res._status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────
// POST /api/jobs — request body validation
// ─────────────────────────────────────────────────────────
describe('POST /api/jobs — request validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when area_id is missing', async () => {
    const res = await POST(makePostRequest({ ...validBody, area_id: undefined }))
    expect(res._status).toBe(400)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toContain('area_id')
  })

  it('returns 400 when area_id is not a valid UUID', async () => {
    const res = await POST(makePostRequest({ ...validBody, area_id: 'not-a-uuid' }))
    expect(res._status).toBe(400)
    expect(res._body.error).toContain('area_id')
  })

  it('returns 400 when job_name is missing', async () => {
    const res = await POST(makePostRequest({ ...validBody, job_name: '' }))
    expect(res._status).toBe(400)
    expect(res._body.error).toContain('job_name')
  })

  it('returns 400 when created_by is missing', async () => {
    const res = await POST(makePostRequest({ ...validBody, created_by: '' }))
    expect(res._status).toBe(400)
    expect(res._body.error).toContain('created_by')
  })

  it('returns 400 when keyword_set_id is not a valid UUID', async () => {
    const res = await POST(makePostRequest({ ...validBody, keyword_set_id: 'bad' }))
    expect(res._status).toBe(400)
    expect(res._body.error).toContain('keyword_set_id')
  })

  it('returns 400 when collection_type is missing', async () => {
    const res = await POST(makePostRequest({ ...validBody, collection_type: '' }))
    expect(res._status).toBe(400)
    expect(res._body.error).toContain('collection_type')
  })

  it('returns 400 when selected_grid_ids is empty', async () => {
    const res = await POST(makePostRequest({ ...validBody, selected_grid_ids: [] }))
    expect(res._status).toBe(400)
    expect(res._body.error).toContain('selected_grid_ids')
  })

  it('returns 400 when selected_grid_ids contains an invalid UUID', async () => {
    const res = await POST(makePostRequest({ ...validBody, selected_grid_ids: ['not-a-uuid'] }))
    expect(res._status).toBe(400)
    expect(res._body.error).toContain('Invalid UUID')
  })
})

// ─────────────────────────────────────────────────────────
// POST /api/jobs — business logic
// ─────────────────────────────────────────────────────────
describe('POST /api/jobs — business logic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when area does not exist', async () => {
    getAreaById.mockResolvedValueOnce(undefined)

    const res = await POST(makePostRequest(validBody))

    expect(res._status).toBe(404)
    expect(res._body.error).toBe('Area not found')
  })

  it('returns 404 when keyword set does not exist', async () => {
    getAreaById.mockResolvedValueOnce(mockArea)
    getKeywordSetById.mockResolvedValueOnce(undefined)

    const res = await POST(makePostRequest(validBody))

    expect(res._status).toBe(404)
    expect(res._body.error).toBe('Keyword set not found')
  })

  it('returns 400 when keyword set is inactive', async () => {
    getAreaById.mockResolvedValueOnce(mockArea)
    getKeywordSetById.mockResolvedValueOnce({ ...mockKwSet, is_active: false })

    const res = await POST(makePostRequest(validBody))

    expect(res._status).toBe(400)
    expect(res._body.error).toBe('Keyword set is not active')
  })

  it('returns 400 when some grid IDs do not belong to the area', async () => {
    getAreaById.mockResolvedValueOnce(mockArea)
    getKeywordSetById.mockResolvedValueOnce(mockKwSet)
    getGridsByIds.mockResolvedValueOnce([]) // 0 found, 1 expected → mismatch

    const res = await POST(makePostRequest(validBody))

    expect(res._status).toBe(400)
    expect(res._body.error).toContain('do not exist or do not belong')
  })

  it('returns 201 and job data on successful creation', async () => {
    getAreaById.mockResolvedValueOnce(mockArea)
    getKeywordSetById.mockResolvedValueOnce(mockKwSet)
    getGridsByIds.mockResolvedValueOnce(mockGrids)
    createJobWithGrids.mockResolvedValueOnce(mockCreated)

    const res = await POST(makePostRequest(validBody))

    expect(res._status).toBe(201)
    expect(res._body.success).toBe(true)
    expect(res._body.data.job_id).toBe(VALID_UUID)
    expect(res._body.data.message).toBe('Job created successfully')
  })

  it('passes trimmed job_name to createJobWithGrids', async () => {
    getAreaById.mockResolvedValueOnce(mockArea)
    getKeywordSetById.mockResolvedValueOnce(mockKwSet)
    getGridsByIds.mockResolvedValueOnce(mockGrids)
    createJobWithGrids.mockResolvedValueOnce(mockCreated)

    await POST(makePostRequest({ ...validBody, job_name: '  My Job  ' }))

    expect(createJobWithGrids.mock.calls[0][0].job_name).toBe('My Job')
  })

  it('returns 500 when createJobWithGrids throws', async () => {
    getAreaById.mockResolvedValueOnce(mockArea)
    getKeywordSetById.mockResolvedValueOnce(mockKwSet)
    getGridsByIds.mockResolvedValueOnce(mockGrids)
    createJobWithGrids.mockRejectedValueOnce(new Error('DB error'))

    const res = await POST(makePostRequest(validBody))

    expect(res._status).toBe(500)
    expect(res._body.success).toBe(false)
  })
})
