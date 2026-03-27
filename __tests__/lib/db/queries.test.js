import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the DB client BEFORE importing queries
vi.mock('@/lib/db/client.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}))

import { query, getClient } from '@/lib/db/client.js'
import {
  getAreas,
  getAreaById,
  getGridsByAreaId,
  getActiveKeywordSets,
  getKeywordSetById,
  getKeywordItemsBySetId,
  getGridsByIds,
  createJobWithGrids,
  getJobsList,
  getJobSummary,
  getJobByIdWithDetails,
  getJobGrids,
} from '@/lib/db/queries.js'

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────
const AREA = { area_id: 'area-uuid-1', area_name: 'Tonpao Region', description: 'Test' }
const GRID_1 = { grid_id: 'g-uuid-1', area_id: 'area-uuid-1', grid_code: 'G001', row_index: 0, col_index: 0, status: 'pending' }
const GRID_2 = { grid_id: 'g-uuid-2', area_id: 'area-uuid-1', grid_code: 'G002', row_index: 0, col_index: 1, status: 'completed' }
const KW_SET = { keyword_set_id: 'ks-uuid-1', keyword_set_name: 'Tourism POI Types', is_active: true }
const KW_ITEM = { keyword_item_id: 'ki-uuid-1', keyword_text: 'restaurant', sort_order: 0 }
const JOB = {
  job_id: 'j-uuid-1',
  area_id: 'area-uuid-1',
  job_name: 'Test Job',
  job_description: 'Desc',
  created_by: 'Research team',
  keyword_set_id: 'ks-uuid-1',
  collection_type: 'nearby_search',
  status: 'pending',
  total_grids: 10,
  done_grids: 7,
  failed_grids: 1,
  total_results: 300,
  total_requests: 70,
  error_message: null,
  area_name: 'Tonpao Region',
  keyword_set_name: 'Tourism POI Types',
}

describe('lib/db/queries', () => {
  beforeEach(() => vi.clearAllMocks())

  // ─────────────────────────────────────────────
  // getAreas
  // ─────────────────────────────────────────────
  describe('getAreas', () => {
    it('returns all areas from DB', async () => {
      query.mockResolvedValueOnce([[AREA]])
      const result = await getAreas()
      expect(result).toEqual([AREA])
      expect(query).toHaveBeenCalledOnce()
      expect(query.mock.calls[0][0]).toMatch(/FROM areas/i)
    })

    it('returns empty array when no areas exist', async () => {
      query.mockResolvedValueOnce([[]])
      expect(await getAreas()).toEqual([])
    })

    it('orders by area_name ASC', async () => {
      query.mockResolvedValueOnce([[]])
      await getAreas()
      expect(query.mock.calls[0][0]).toMatch(/ORDER BY area_name ASC/i)
    })
  })

  // ─────────────────────────────────────────────
  // getAreaById
  // ─────────────────────────────────────────────
  describe('getAreaById', () => {
    it('returns the matching area', async () => {
      query.mockResolvedValueOnce([[AREA]])
      const result = await getAreaById('area-uuid-1')
      expect(result).toEqual(AREA)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE area_id = ?'),
        ['area-uuid-1'],
      )
    })

    it('returns undefined when area not found', async () => {
      query.mockResolvedValueOnce([[]])
      expect(await getAreaById('missing')).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────
  // getGridsByAreaId
  // ─────────────────────────────────────────────
  describe('getGridsByAreaId', () => {
    it('returns grids for the given area', async () => {
      query.mockResolvedValueOnce([[GRID_1, GRID_2]])
      const result = await getGridsByAreaId('area-uuid-1')
      expect(result).toHaveLength(2)
      expect(result[0].grid_code).toBe('G001')
    })

    it('passes areaId as query parameter', async () => {
      query.mockResolvedValueOnce([[]])
      await getGridsByAreaId('area-uuid-1')
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE area_id = ?'),
        ['area-uuid-1'],
      )
    })

    it('orders by row_index and col_index', async () => {
      query.mockResolvedValueOnce([[]])
      await getGridsByAreaId('area-uuid-1')
      expect(query.mock.calls[0][0]).toMatch(/ORDER BY row_index ASC, col_index ASC/i)
    })
  })

  // ─────────────────────────────────────────────
  // getActiveKeywordSets
  // ─────────────────────────────────────────────
  describe('getActiveKeywordSets', () => {
    it('returns only active keyword sets', async () => {
      query.mockResolvedValueOnce([[KW_SET]])
      const result = await getActiveKeywordSets()
      expect(result).toEqual([KW_SET])
      expect(query.mock.calls[0][0]).toContain('is_active = true')
    })

    it('returns empty array when no active sets', async () => {
      query.mockResolvedValueOnce([[]])
      expect(await getActiveKeywordSets()).toEqual([])
    })
  })

  // ─────────────────────────────────────────────
  // getKeywordSetById
  // ─────────────────────────────────────────────
  describe('getKeywordSetById', () => {
    it('returns the matching keyword set', async () => {
      query.mockResolvedValueOnce([[KW_SET]])
      const result = await getKeywordSetById('ks-uuid-1')
      expect(result).toEqual(KW_SET)
    })

    it('returns undefined when not found', async () => {
      query.mockResolvedValueOnce([[]])
      expect(await getKeywordSetById('missing')).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────
  // getKeywordItemsBySetId
  // ─────────────────────────────────────────────
  describe('getKeywordItemsBySetId', () => {
    it('returns keyword items for the given set', async () => {
      const items = [KW_ITEM, { ...KW_ITEM, keyword_item_id: 'ki-2', keyword_text: 'hotel', sort_order: 1 }]
      query.mockResolvedValueOnce([items])
      const result = await getKeywordItemsBySetId('ks-uuid-1')
      expect(result).toHaveLength(2)
      expect(result[0].keyword_text).toBe('restaurant')
    })

    it('passes keyword_set_id as parameter', async () => {
      query.mockResolvedValueOnce([[]])
      await getKeywordItemsBySetId('ks-uuid-1')
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE keyword_set_id = ?'),
        ['ks-uuid-1'],
      )
    })
  })

  // ─────────────────────────────────────────────
  // getGridsByIds
  // ─────────────────────────────────────────────
  describe('getGridsByIds', () => {
    it('returns empty array immediately when gridIds is empty', async () => {
      const result = await getGridsByIds([], 'area-uuid-1')
      expect(result).toEqual([])
      expect(query).not.toHaveBeenCalled()
    })

    it('returns matching grids for given IDs and areaId', async () => {
      query.mockResolvedValueOnce([[GRID_1, GRID_2]])
      const result = await getGridsByIds(['g-uuid-1', 'g-uuid-2'], 'area-uuid-1')
      expect(result).toHaveLength(2)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE grid_id IN'),
        ['g-uuid-1', 'g-uuid-2', 'area-uuid-1'],
      )
    })

    it('returns partial list when some grids belong to a different area', async () => {
      query.mockResolvedValueOnce([[GRID_1]])   // only 1 of 2 found
      const result = await getGridsByIds(['g-uuid-1', 'g-uuid-2'], 'area-uuid-1')
      expect(result).toHaveLength(1)
    })

    it('builds correct number of placeholders', async () => {
      query.mockResolvedValueOnce([[]])
      await getGridsByIds(['a', 'b', 'c'], 'area-uuid-1')
      expect(query.mock.calls[0][0]).toContain('?,?,?')
    })
  })

  // ─────────────────────────────────────────────
  // createJobWithGrids
  // ─────────────────────────────────────────────
  describe('createJobWithGrids', () => {
    const jobData = {
      area_id: 'area-uuid-1',
      job_name: 'G001_20260324_120000',
      job_description: 'Some description',
      created_by: 'Research team',
      keyword_set_id: 'ks-uuid-1',
      collection_type: 'nearby_search',
      include_rating: false,
      include_reviews_count: false,
      include_address: true,
    }

    const makeConn = (overrides = {}) => ({
      query: vi.fn().mockResolvedValue([{}]),
      release: vi.fn(),
      ...overrides,
    })

    it('runs START TRANSACTION, inserts job + grids, then COMMITs', async () => {
      const conn = makeConn()
      getClient.mockResolvedValue(conn)
      const created = { job_id: 'new-j', status: 'pending', job_name: jobData.job_name, total_grids: 2 }
      query.mockResolvedValueOnce([[created]])

      const result = await createJobWithGrids(jobData, ['g-uuid-1', 'g-uuid-2'])

      const calls = conn.query.mock.calls.map((c) => c[0])
      expect(calls[0]).toBe('START TRANSACTION')
      expect(calls.some((q) => q.includes('INSERT INTO jobs'))).toBe(true)
      expect(calls.filter((q) => q.includes('INSERT INTO job_grids'))).toHaveLength(2)
      expect(calls[calls.length - 1]).toBe('COMMIT')
      expect(conn.release).toHaveBeenCalled()
      expect(result).toEqual(created)
    })

    it('generates a UUID for job_id (not relying on insertId)', async () => {
      const conn = makeConn()
      getClient.mockResolvedValue(conn)
      query.mockResolvedValueOnce([[{ job_id: 'any', status: 'pending', job_name: 'j', total_grids: 1 }]])

      await createJobWithGrids(jobData, ['g-uuid-1'])

      const insertJobCall = conn.query.mock.calls.find((c) => c[0].includes('INSERT INTO jobs'))
      // First param in array should be a UUID string (36 chars)
      const firstParam = insertJobCall[1][0]
      expect(typeof firstParam).toBe('string')
      expect(firstParam).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('uses null for empty job_description', async () => {
      const conn = makeConn()
      getClient.mockResolvedValue(conn)
      query.mockResolvedValueOnce([[{ job_id: 'j', status: 'pending', job_name: 'j', total_grids: 1 }]])

      await createJobWithGrids({ ...jobData, job_description: '' }, ['g-uuid-1'])

      const insertJobCall = conn.query.mock.calls.find((c) => c[0].includes('INSERT INTO jobs'))
      expect(insertJobCall[1]).toContain(null)
    })

    it('rolls back and releases connection when INSERT fails', async () => {
      const conn = makeConn({
        query: vi.fn()
          .mockResolvedValueOnce([{}])              // START TRANSACTION
          .mockRejectedValueOnce(new Error('DB error')), // INSERT fails
      })
      getClient.mockResolvedValue(conn)

      await expect(createJobWithGrids(jobData, ['g-uuid-1'])).rejects.toThrow('DB error')

      const calls = conn.query.mock.calls.map((c) => c[0])
      expect(calls).toContain('ROLLBACK')
      expect(conn.release).toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────
  // getJobsList
  // ─────────────────────────────────────────────
  describe('getJobsList', () => {
    const mkJobRow = (overrides = {}) => ({
      job_id: 'j-1', job_name: 'Job', status: 'pending',
      total_grids: 10, done_grids: 5, failed_grids: 0,
      total_results: 0, total_requests: 0, area_name: 'Tonpao',
      ...overrides,
    })

    it('returns paginated result with default page/pageSize', async () => {
      query
        .mockResolvedValueOnce([[{ total: 1 }]])
        .mockResolvedValueOnce([[mkJobRow()]])

      const result = await getJobsList({})
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(10)
      expect(result.total).toBe(1)
      expect(result.jobs).toHaveLength(1)
    })

    it('calculates progress_percent = floor(done/total * 100)', async () => {
      query
        .mockResolvedValueOnce([[{ total: 2 }]])
        .mockResolvedValueOnce([[mkJobRow({ done_grids: 3, total_grids: 4 }), mkJobRow({ total_grids: 0, done_grids: 0 })]])

      const { jobs } = await getJobsList({})
      expect(jobs[0].progress_percent).toBe(75)   // floor(3/4*100)
      expect(jobs[1].progress_percent).toBe(0)     // total_grids = 0
    })

    it('applies status filter in SQL', async () => {
      query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]])
      await getJobsList({ status: 'completed' })
      expect(query.mock.calls[0][0]).toContain('j.status = ?')
      expect(query.mock.calls[0][1]).toContain('completed')
    })

    it('applies search filter with LIKE wildcards', async () => {
      query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]])
      await getJobsList({ search: 'Tonpao' })
      const params = query.mock.calls[0][1]
      expect(params).toContain('%Tonpao%')
    })

    it('applies dateFrom and dateTo filters', async () => {
      query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]])
      await getJobsList({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })
      const sql = query.mock.calls[0][0]
      expect(sql).toContain('j.created_at >=')
      expect(sql).toContain('j.created_at <=')
    })

    it('applies createdBy filter', async () => {
      query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]])
      await getJobsList({ createdBy: 'Research team' })
      expect(query.mock.calls[0][1]).toContain('Research team')
    })

    it('calculates correct SQL OFFSET for page 3, pageSize 5', async () => {
      query.mockResolvedValueOnce([[{ total: 15 }]]).mockResolvedValueOnce([[]])
      await getJobsList({}, 3, 5)
      const listParams = query.mock.calls[1][1]
      expect(listParams.at(-2)).toBe(5)   // LIMIT
      expect(listParams.at(-1)).toBe(10)  // OFFSET = (3-1)*5
    })
  })

  // ─────────────────────────────────────────────
  // getJobSummary
  // ─────────────────────────────────────────────
  describe('getJobSummary', () => {
    it('returns aggregate job statistics', async () => {
      const summary = {
        total_jobs_count: '8',
        total_completed_jobs: '5',
        total_failed_jobs: '2',
        total_poi_collected: '1250',
      }
      query.mockResolvedValueOnce([[summary]])
      const result = await getJobSummary()
      expect(result).toEqual(summary)
    })

    it('queries COUNT and SUM aggregates', async () => {
      query.mockResolvedValueOnce([[{}]])
      await getJobSummary()
      const sql = query.mock.calls[0][0]
      expect(sql).toContain('COUNT(*)')
      expect(sql).toContain('SUM(total_results)')
    })
  })

  // ─────────────────────────────────────────────
  // getJobByIdWithDetails
  // ─────────────────────────────────────────────
  describe('getJobByIdWithDetails', () => {
    it('returns job with keywords and progress_percent', async () => {
      query
        .mockResolvedValueOnce([[JOB]])
        .mockResolvedValueOnce([[KW_ITEM]])

      const result = await getJobByIdWithDetails('j-uuid-1')
      expect(result.job_id).toBe('j-uuid-1')
      expect(result.keywords).toEqual([KW_ITEM])
      expect(result.progress_percent).toBe(70) // floor(7/10*100)
    })

    it('returns null when job not found', async () => {
      query.mockResolvedValueOnce([[]])
      expect(await getJobByIdWithDetails('missing')).toBeNull()
    })

    it('returns progress_percent = 0 when total_grids is 0', async () => {
      query
        .mockResolvedValueOnce([[{ ...JOB, total_grids: 0, done_grids: 0 }]])
        .mockResolvedValueOnce([[]])
      const result = await getJobByIdWithDetails('j-uuid-1')
      expect(result.progress_percent).toBe(0)
    })

    it('fetches keywords using the job keyword_set_id', async () => {
      query.mockResolvedValueOnce([[JOB]]).mockResolvedValueOnce([[KW_ITEM]])
      await getJobByIdWithDetails('j-uuid-1')
      expect(query.mock.calls[1][1]).toEqual(['ks-uuid-1'])
    })
  })

  // ─────────────────────────────────────────────
  // getJobGrids
  // ─────────────────────────────────────────────
  describe('getJobGrids', () => {
    it('returns all grid rows for the given job', async () => {
      const grids = [
        { job_grid_id: 'jg-1', grid_id: 'g-uuid-1', grid_code: 'G001', grid_status: 'completed', records_collected: 50 },
        { job_grid_id: 'jg-2', grid_id: 'g-uuid-2', grid_code: 'G002', grid_status: 'pending',   records_collected: 0 },
      ]
      query.mockResolvedValueOnce([grids])
      const result = await getJobGrids('j-uuid-1')
      expect(result).toHaveLength(2)
      expect(result[0].grid_code).toBe('G001')
    })

    it('passes jobId as query parameter', async () => {
      query.mockResolvedValueOnce([[]])
      await getJobGrids('j-uuid-1')
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE jg.job_id = ?'),
        ['j-uuid-1'],
      )
    })

    it('orders grids by row_index and col_index', async () => {
      query.mockResolvedValueOnce([[]])
      await getJobGrids('j-uuid-1')
      expect(query.mock.calls[0][0]).toMatch(/ORDER BY g.row_index ASC, g.col_index ASC/i)
    })
  })
})
