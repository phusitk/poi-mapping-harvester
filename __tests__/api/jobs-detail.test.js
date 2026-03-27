import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn((body, init) => ({ _body: body, _status: init?.status ?? 200 })) },
}))

vi.mock('@/lib/db/queries.js', () => ({
  getJobByIdWithDetails: vi.fn(),
}))

import { getJobByIdWithDetails } from '@/lib/db/queries.js'
import { GET } from '@/app/api/jobs/[jobId]/route.js'

const JOB_DETAIL = {
  job_id: 'j-uuid-1',
  job_name: 'G001_20260324_120000',
  status: 'pending',
  total_grids: 5,
  done_grids: 0,
  failed_grids: 0,
  total_results: 0,
  area_name: 'Tonpao Region',
  keyword_set_name: 'Tourism POI Types',
  progress_percent: 0,
  keywords: [{ keyword_text: 'restaurant', sort_order: 0 }],
}

// Next.js 15+ params is a Promise
const makeParams = (jobId) => ({ params: Promise.resolve({ jobId }) })

describe('GET /api/jobs/[jobId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with full job details when job exists', async () => {
    getJobByIdWithDetails.mockResolvedValueOnce(JOB_DETAIL)

    const res = await GET(null, makeParams('j-uuid-1'))

    expect(res._status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.data).toEqual(JOB_DETAIL)
  })

  it('returns 404 when job does not exist', async () => {
    getJobByIdWithDetails.mockResolvedValueOnce(null)

    const res = await GET(null, makeParams('missing-id'))

    expect(res._status).toBe(404)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Job not found')
  })

  it('returns 500 when DB throws an error', async () => {
    getJobByIdWithDetails.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET(null, makeParams('j-uuid-1'))

    expect(res._status).toBe(500)
    expect(res._body.success).toBe(false)
    expect(res._body.error).toBe('Failed to fetch job')
  })

  it('passes the correct jobId to getJobByIdWithDetails', async () => {
    getJobByIdWithDetails.mockResolvedValueOnce(JOB_DETAIL)

    await GET(null, makeParams('j-uuid-1'))

    expect(getJobByIdWithDetails).toHaveBeenCalledWith('j-uuid-1')
  })

  it('includes keywords and progress_percent in response', async () => {
    getJobByIdWithDetails.mockResolvedValueOnce(JOB_DETAIL)

    const res = await GET(null, makeParams('j-uuid-1'))

    expect(res._body.data.keywords).toBeDefined()
    expect(res._body.data.progress_percent).toBeDefined()
  })

  it('calls getJobByIdWithDetails exactly once per request', async () => {
    getJobByIdWithDetails.mockResolvedValueOnce(JOB_DETAIL)

    await GET(null, makeParams('j-uuid-1'))

    expect(getJobByIdWithDetails).toHaveBeenCalledOnce()
  })
})
