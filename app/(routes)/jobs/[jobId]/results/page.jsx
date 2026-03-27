'use client'

import React, { use, useState, useEffect } from 'react'

export default function JobResultsPage({ params }) {
  const { jobId } = use(params)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        const data = await response.json()

        if (data.success) {
          setJob(data.data)
        } else {
          setError(data.error || 'Failed to fetch job')
        }
      } catch (err) {
        setError('Error fetching job: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchJob()
    // Refresh every 5 seconds
    const interval = setInterval(fetchJob, 5000)
    return () => clearInterval(interval)
  }, [jobId])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-gray-600">Loading job details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Job Results: {job?.job_name}</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded p-4">
          <p className="text-sm text-gray-600">Total Grids</p>
          <p className="text-2xl font-bold text-blue-600">{job?.total_grids}</p>
        </div>

        <div className="bg-green-50 rounded p-4">
          <p className="text-sm text-gray-600">Completed Grids</p>
          <p className="text-2xl font-bold text-green-600">{job?.done_grids}</p>
        </div>

        <div className="bg-purple-50 rounded p-4">
          <p className="text-sm text-gray-600">Total POI Collected</p>
          <p className="text-2xl font-bold text-purple-600">
            {job?.total_results}
          </p>
        </div>

        <div className="bg-orange-50 rounded p-4">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-2xl font-bold text-orange-600 capitalize">
            {job?.status}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded p-4">
        <h2 className="text-lg font-semibold mb-2">Details</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Job ID:</dt>
            <dd className="font-mono">{job?.job_id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Created By:</dt>
            <dd>{job?.created_by}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Created At:</dt>
            <dd>{new Date(job?.created_at).toLocaleString()}</dd>
          </div>
          {job?.description && (
            <div className="flex justify-between">
              <dt className="text-gray-600">Description:</dt>
              <dd>{job.description}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
