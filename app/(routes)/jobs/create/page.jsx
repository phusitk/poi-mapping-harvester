'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function CreateJobForm() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const areaId = searchParams.get('areaId') || ''
  const gridIds = searchParams.get('grids')?.split(',').filter(Boolean) || []
  const gridCodes = searchParams.get('gridCodes')?.split(',').filter(Boolean) || []

  const generateDefaultJobName = (codes) => {
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    if (codes.length === 0) return ''
    if (codes.length === 1) return `${codes[0]}_${ts}`
    if (codes.length <= 3) return `${codes.join('-')}_${ts}`
    return `${codes[0]}+${codes.length - 1}_${ts}`
  }

  const [keywordSets, setKeywordSets] = useState([])
  const [areaName, setAreaName] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    job_name: generateDefaultJobName(gridCodes),
    job_description: '',
    created_by: 'Research team',
    keyword_set_id: '',
    collection_type: 'nearby_search',
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const [kwRes, areaRes] = await Promise.all([
          fetch('/api/keyword-sets'),
          areaId ? fetch(`/api/areas`) : Promise.resolve(null),
        ])

        const kwData = await kwRes.json()
        if (kwData.success) {
          setKeywordSets(kwData.data)
          if (kwData.data.length > 0) {
            setForm((f) => ({ ...f, keyword_set_id: kwData.data[0].keyword_set_id }))
          }
        }

        if (areaRes) {
          const areaData = await areaRes.json()
          if (areaData.success) {
            const area = areaData.data.find((a) => a.area_id === areaId)
            if (area) setAreaName(area.area_name)
          }
        }
      } catch (err) {
        setError('Failed to load form data')
      } finally {
        setInitialLoading(false)
      }
    }
    loadData()
  }, [areaId])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (gridIds.length === 0) {
      setError('No grids selected. Please go back and select grids.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: areaId,
          job_name: form.job_name,
          job_description: form.job_description,
          created_by: form.created_by,
          keyword_set_id: form.keyword_set_id,
          collection_type: form.collection_type,
          include_rating: false,
          include_reviews_count: false,
          include_address: true,
          selected_grid_ids: gridIds,
        }),
      })

      const data = await response.json()
      if (data.success) {
        router.push(`/jobs/${data.data.job_id}`)
      } else {
        setError(data.error || 'Failed to create job')
      }
    } catch (err) {
      setError('Error creating job: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline mb-2 block">
          ← Back to map
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Job</h1>
      </div>

      {/* Job Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-blue-800">
          Area: <span className="font-semibold">{areaName || areaId}</span>
        </p>
        <p className="text-sm text-blue-700 mt-1">
          Selected grids: <span className="font-semibold">{gridIds.length}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Job Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="job_name"
            value={form.job_name}
            onChange={handleChange}
            required
            placeholder="e.g. Tonpao Restaurant Survey Mar 2026"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="job_description"
            value={form.job_description}
            onChange={handleChange}
            rows={2}
            placeholder="Optional description"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Created By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Created By <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="created_by"
            value={form.created_by}
            onChange={handleChange}
            required
            placeholder="Your name or team name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Keyword Set */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keyword Set <span className="text-red-500">*</span>
          </label>
          {keywordSets.length === 0 ? (
            <p className="text-sm text-red-600">No active keyword sets found.</p>
          ) : (
            <select
              name="keyword_set_id"
              value={form.keyword_set_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {keywordSets.map((ks) => (
                <option key={ks.keyword_set_id} value={ks.keyword_set_id}>
                  {ks.keyword_set_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Collection Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Collection Type <span className="text-red-500">*</span>
          </label>
          <select
            name="collection_type"
            value={form.collection_type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="nearby_search">Nearby Search</option>
            <option value="text_search">Text Search</option>
          </select>
        </div>

        {/* Data Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-600 mb-1">ข้อมูลที่จะเก็บ (Basic Data)</p>
          <div className="flex flex-wrap gap-2">
            {['ชื่อสถานที่', 'พิกัด Lat/Long', 'ประเภท (Type)', 'ไอคอน', 'ที่อยู่'].map((f) => (
              <span key={f} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{f}</span>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || gridIds.length === 0 || keywordSets.length === 0}
            className="flex-1 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {loading ? 'Creating...' : `Create Job (${gridIds.length} grids)`}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function CreateJobPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <CreateJobForm />
    </Suspense>
  )
}
