import { query } from './client.js'

export const getAreas = async () => {
  const [rows] = await query(
    `SELECT area_id, area_name, description, boundary_geojson, 
            center_lat, center_lng, created_at, updated_at 
     FROM areas 
     ORDER BY area_name ASC`,
  )
  return rows
}

export const getAreaById = async (areaId) => {
  const [rows] = await query(
    `SELECT area_id, area_name, description, boundary_geojson, 
            center_lat, center_lng, created_at, updated_at 
     FROM areas 
     WHERE area_id = ?`,
    [areaId],
  )
  return rows[0]
}

export const getGridsByAreaId = async (areaId) => {
  const [rows] = await query(
    `SELECT grid_id, area_id, grid_code, row_index, col_index, 
            center_lat, center_lng, min_lat, min_lng, max_lat, max_lng, 
            status, last_harvested_at, created_at, updated_at 
     FROM grids 
     WHERE area_id = ? 
     ORDER BY row_index ASC, col_index ASC`,
    [areaId],
  )
  return rows
}

export const getActiveKeywordSets = async () => {
  const [rows] = await query(
    `SELECT keyword_set_id, keyword_set_name, description, is_active, created_at 
     FROM keyword_sets 
     WHERE is_active = true 
     ORDER BY keyword_set_name ASC`,
  )
  return rows
}

export const getKeywordSetById = async (keywordSetId) => {
  const [rows] = await query(
    `SELECT keyword_set_id, keyword_set_name, description, is_active, created_at 
     FROM keyword_sets 
     WHERE keyword_set_id = ?`,
    [keywordSetId],
  )
  return rows[0]
}

export const getKeywordItemsBySetId = async (keywordSetId) => {
  const [rows] = await query(
    `SELECT keyword_item_id, keyword_set_id, keyword_text, sort_order, created_at 
     FROM keyword_set_items 
     WHERE keyword_set_id = ? 
     ORDER BY sort_order ASC`,
    [keywordSetId],
  )
  return rows
}

export const getGridsByIds = async (gridIds, areaId) => {
  if (gridIds.length === 0) {
    return []
  }

  const placeholders = gridIds.map(() => '?').join(',')
  const [rows] = await query(
    `SELECT grid_id, area_id FROM grids 
     WHERE grid_id IN (${placeholders}) AND area_id = ?`,
    [...gridIds, areaId],
  )
  return rows
}

export const createJobWithGrids = async (jobData, selectedGridIds) => {
  const { getClient } = await import('./client.js')
  const client = await getClient()

  try {
    await client.query('START TRANSACTION')

    // Generate UUID in JS — MySQL's insertId returns 0 for UUID primary keys
    const job_id = crypto.randomUUID()

    await client.query(
      `INSERT INTO jobs (
        job_id, area_id, job_name, job_description, created_by, keyword_set_id,
        collection_type, include_rating, include_reviews_count,
        include_address, status, total_grids, done_grids, failed_grids,
        total_results, total_requests, created_source, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        job_id,
        jobData.area_id,
        jobData.job_name,
        jobData.job_description || null,
        jobData.created_by,
        jobData.keyword_set_id,
        jobData.collection_type,
        jobData.include_rating,
        jobData.include_reviews_count,
        jobData.include_address,
        'pending',
        selectedGridIds.length,
        0,
        0,
        0,
        0,
        'api',
      ],
    )

    for (const gridId of selectedGridIds) {
      await client.query(
        `INSERT INTO job_grids (
          job_id, grid_id, grid_status, records_collected,
          requests_used, retry_count, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [job_id, gridId, 'pending', 0, 0, 0],
      )
    }

    await client.query('COMMIT')

    // Fetch the created job
    const [jobRows] = await query(
      `SELECT job_id, status, job_name, total_grids FROM jobs WHERE job_id = ?`,
      [job_id],
    )

    return jobRows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const getJobsList = async (filters, page = 1, pageSize = 10) => {
  let whereClause = `WHERE 1=1`
  const whereParams = []

  if (filters?.status) {
    whereClause += ` AND j.status = ?`
    whereParams.push(filters.status)
  }
  if (filters?.dateFrom) {
    whereClause += ` AND j.created_at >= ?`
    whereParams.push(filters.dateFrom)
  }
  if (filters?.dateTo) {
    whereClause += ` AND j.created_at <= ?`
    whereParams.push(filters.dateTo)
  }
  if (filters?.createdBy) {
    whereClause += ` AND j.created_by = ?`
    whereParams.push(filters.createdBy)
  }
  if (filters?.search) {
    whereClause += ` AND (j.job_name LIKE ? OR j.job_description LIKE ?)`
    whereParams.push(`%${filters.search}%`, `%${filters.search}%`)
  }

  const baseJoin = `FROM jobs j
    JOIN areas a ON j.area_id = a.area_id
    JOIN keyword_sets ks ON j.keyword_set_id = ks.keyword_set_id`

  const [countRows] = await query(
    `SELECT COUNT(*) as total ${baseJoin} ${whereClause}`,
    whereParams,
  )

  const total = countRows[0].total
  const offset = (page - 1) * pageSize

  const [rows] = await query(
    `SELECT j.job_id, j.area_id, j.job_name, j.job_description,
      j.created_by, j.created_at, j.started_at, j.finished_at,
      j.status, j.keyword_set_id, j.collection_type,
      j.include_rating, j.include_reviews_count, j.include_address,
      j.total_grids, j.done_grids, j.failed_grids,
      j.total_results, j.total_requests, j.error_message,
      a.area_name, ks.keyword_set_name
    ${baseJoin} ${whereClause}
    ORDER BY j.created_at DESC
    LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, offset],
  )

  return {
    jobs: rows.map((job) => ({
      ...job,
      progress_percent:
        job.total_grids > 0
          ? Math.floor((job.done_grids * 100) / job.total_grids)
          : 0,
    })),
    total,
    page,
    pageSize,
  }
}

export const getJobSummary = async () => {
  const [rows] = await query(
    `SELECT
      COUNT(*) as total_jobs_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_completed_jobs,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed_jobs,
      COALESCE(SUM(total_results), 0) as total_poi_collected
     FROM jobs`,
  )
  return rows[0]
}

export const getJobByIdWithDetails = async (jobId) => {
  const [jobRows] = await query(
    `SELECT j.job_id, j.area_id, j.job_name, j.job_description,
      j.created_by, j.created_at, j.started_at, j.finished_at,
      j.status, j.keyword_set_id, j.collection_type,
      j.include_rating, j.include_reviews_count, j.include_address,
      j.total_grids, j.done_grids, j.failed_grids,
      j.total_results, j.total_requests, j.error_message,
      a.area_name, ks.keyword_set_name
     FROM jobs j
     JOIN areas a ON j.area_id = a.area_id
     JOIN keyword_sets ks ON j.keyword_set_id = ks.keyword_set_id
     WHERE j.job_id = ?`,
    [jobId],
  )

  if (jobRows.length === 0) {
    return null
  }

  const job = jobRows[0]

  const [keywordRows] = await query(
    `SELECT keyword_item_id, keyword_text, sort_order
     FROM keyword_set_items
     WHERE keyword_set_id = ?
     ORDER BY sort_order ASC`,
    [job.keyword_set_id],
  )

  return {
    ...job,
    progress_percent:
      job.total_grids > 0
        ? Math.floor((job.done_grids * 100) / job.total_grids)
        : 0,
    keywords: keywordRows,
  }
}

export const getJobGrids = async (jobId) => {
  const [rows] = await query(
    `SELECT jg.job_grid_id, jg.grid_id, g.grid_code, jg.grid_status,
            jg.started_at, jg.finished_at, jg.records_collected,
            jg.requests_used, jg.error_message
     FROM job_grids jg
     JOIN grids g ON jg.grid_id = g.grid_id
     WHERE jg.job_id = ?
     ORDER BY g.row_index ASC, g.col_index ASC`,
    [jobId],
  )
  return rows
}
