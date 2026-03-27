import { NextResponse } from 'next/server'
import {
  getAreaById,
  getKeywordSetById,
  getGridsByIds,
  createJobWithGrids,
  getJobsList,
  getJobSummary,
} from '@/lib/db/queries.js'
import { triggerPOIWorker } from '@/lib/triggerWorker.js'

export const dynamic = 'force-dynamic'

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid,
  )
}

function validateRequestBody(body) {
  if (!body.area_id || !isValidUUID(body.area_id)) {
    return 'Invalid or missing area_id'
  }

  if (
    !body.job_name ||
    typeof body.job_name !== 'string' ||
    body.job_name.trim() === ''
  ) {
    return 'job_name is required and must be a non-empty string'
  }

  if (
    !body.created_by ||
    typeof body.created_by !== 'string' ||
    body.created_by.trim() === ''
  ) {
    return 'created_by is required and must be a non-empty string'
  }

  if (!body.keyword_set_id || !isValidUUID(body.keyword_set_id)) {
    return 'Invalid or missing keyword_set_id'
  }

  if (
    !body.collection_type ||
    typeof body.collection_type !== 'string' ||
    body.collection_type.trim() === ''
  ) {
    return 'collection_type is required'
  }

  if (
    !Array.isArray(body.selected_grid_ids) ||
    body.selected_grid_ids.length === 0
  ) {
    return 'selected_grid_ids must be a non-empty array'
  }

  for (const gridId of body.selected_grid_ids) {
    if (!isValidUUID(gridId)) {
      return `Invalid UUID in selected_grid_ids: ${gridId}`
    }
  }

  return null
}

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams

    const status = searchParams.get('status') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const search = searchParams.get('search') || undefined
    const createdBy = searchParams.get('createdBy') || undefined
    const summary = searchParams.get('summary') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)),
    )

    const filters = {
      status,
      dateFrom,
      dateTo,
      search,
      createdBy,
    }

    const jobsData = await getJobsList(filters, page, pageSize)

    const responseData = {
      success: true,
      data: jobsData.jobs,
      meta: {
        page: jobsData.page,
        pageSize: jobsData.pageSize,
        total: jobsData.total,
        totalPages: Math.ceil(jobsData.total / jobsData.pageSize),
      },
    }

    if (summary) {
      const summaryData = await getJobSummary()
      responseData.summary = {
        total_jobs_count: parseInt(summaryData.total_jobs_count, 10),
        total_completed_jobs: parseInt(summaryData.total_completed_jobs, 10),
        total_failed_jobs: parseInt(summaryData.total_failed_jobs, 10),
        total_poi_collected: parseInt(summaryData.total_poi_collected, 10),
      }
    }

    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    console.error('Error fetching jobs:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch jobs',
      },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()

    const validationError = validateRequestBody(body)
    if (validationError) {
      return NextResponse.json(
        {
          success: false,
          error: validationError,
        },
        { status: 400 },
      )
    }

    const area = await getAreaById(body.area_id)
    if (!area) {
      return NextResponse.json(
        {
          success: false,
          error: 'Area not found',
        },
        { status: 404 },
      )
    }

    const keywordSet = await getKeywordSetById(body.keyword_set_id)
    if (!keywordSet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Keyword set not found',
        },
        { status: 404 },
      )
    }

    if (!keywordSet.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: 'Keyword set is not active',
        },
        { status: 400 },
      )
    }

    const grids = await getGridsByIds(body.selected_grid_ids, body.area_id)

    if (grids.length !== body.selected_grid_ids.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            'One or more selected grids do not exist or do not belong to the specified area',
        },
        { status: 400 },
      )
    }

    const job = await createJobWithGrids(
      {
        area_id: body.area_id,
        job_name: body.job_name.trim(),
        job_description: body.job_description?.trim(),
        created_by: body.created_by.trim(),
        keyword_set_id: body.keyword_set_id,
        collection_type: body.collection_type.trim(),
        include_rating: body.include_rating,
        include_reviews_count: body.include_reviews_count,
        include_address: body.include_address,
      },
      body.selected_grid_ids,
    )

    // Trigger the Python worker in the background — non-blocking
    try {
      triggerPOIWorker(job.job_id)
    } catch (workerErr) {
      // Worker spawn failure doesn't block the response; job remains in DB as 'pending'
      console.error('[worker] Failed to start worker:', workerErr.message)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          job_id: job.job_id,
          status: job.status,
          job_name: job.job_name,
          total_grids: job.total_grids,
          message: 'Job created successfully',
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating job:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create job',
      },
      { status: 500 },
    )
  }
}
