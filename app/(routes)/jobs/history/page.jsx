'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'completed', label: 'completed' },
  { value: 'processing', label: 'processing' },
  { value: 'pending', label: 'pending' },
  { value: 'failed', label: 'failed' },
  { value: 'paused', label: 'paused' },
  { value: 'cancelled', label: 'cancelled' },
]

const statusColor = {
  pending:    'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  completed:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
  cancelled:  'bg-gray-100 text-gray-600',
  paused:     'bg-purple-100 text-purple-700',
}

async function downloadJobExport(jobId, setExportingId) {
  setExportingId(jobId)
  try {
    const res = await fetch(`/api/jobs/${jobId}/export`)
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="(.+)"/)
    a.download = match ? match[1] : `poi_${jobId}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    alert('Export ไม่สำเร็จ: ' + err.message)
  } finally {
    setExportingId(null)
  }
}

export default function JobsHistoryPage() {
  const router = useRouter()

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [exportingId, setExportingId]       = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingId, setDeletingId]           = useState(null)

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        })
        if (statusFilter !== 'all') params.set('status', statusFilter)

        const res = await fetch(`/api/jobs?${params}`)
        const data = await res.json()
        if (data.success) {
          setJobs(data.data)
          setTotal(data.meta.total)
          setTotalPages(data.meta.totalPages)
        } else {
          setError(data.error || 'Failed to fetch jobs')
        }
      } catch (err) {
        setError('Error: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
  }, [page, pageSize, statusFilter])

  const handleDelete = async (jobId) => {
    setDeletingId(jobId)
    try {
      const res  = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setJobs((prev) => prev.filter((j) => j.job_id !== jobId))
        setTotal((t) => t - 1)
      } else {
        alert(data.error || 'ลบไม่สำเร็จ')
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const handlePageSizeChange = (size) => {
    setPageSize(size)
    setPage(1)
  }

  const handleStatusChange = (value) => {
    setStatusFilter(value)
    setPage(1)
  }

  // Pagination buttons centered around current page
  const pageButtons = (() => {
    if (totalPages <= 1) return []
    const range = 3
    let start = Math.max(1, page - range)
    let end = Math.min(totalPages, page + range)
    if (end - start < range * 2) {
      if (start === 1) end = Math.min(totalPages, start + range * 2)
      else start = Math.max(1, end - range * 2)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-1 block">
          ← Back to map
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Job History</h1>
        {!loading && (
          <p className="text-sm text-gray-500 mt-0.5">
            {total.toLocaleString()} jobs
            {statusFilter !== 'all' ? ` (filter: ${statusFilter})` : ''}
          </p>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 shrink-0">แสดงรายการ:</span>
          <div className="flex gap-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                  pageSize === size
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-5 bg-gray-300 hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-10">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อ Job</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">พื้นที่</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Grids</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">POI</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">สร้างโดย</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">สร้างเมื่อ ↓</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">เสร็จเมื่อ</th>
                <th className="px-3 py-3 w-10" />
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-gray-400">
                    ไม่พบข้อมูล Job
                  </td>
                </tr>
              ) : (
                jobs.map((job, i) => (
                  <tr
                    key={job.job_id}
                    onClick={() => confirmDeleteId !== job.job_id && router.push(`/jobs/${job.job_id}`)}
                    className={`transition-colors group ${confirmDeleteId === job.job_id ? 'bg-red-50' : 'hover:bg-blue-50 cursor-pointer'}`}
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-900 group-hover:text-blue-700 truncate">
                        {job.job_name}
                      </p>
                      {job.job_description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {job.job_description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {job.area_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          statusColor[job.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-gray-700">
                        {job.done_grids}/{job.total_grids}
                      </span>
                      {job.failed_grids > 0 && (
                        <span className="ml-1 text-xs text-red-500">
                          ({job.failed_grids} fail)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-purple-700">
                      {(job.total_results ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {job.created_by}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(job.created_at).toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {job.finished_at
                        ? new Date(job.finished_at).toLocaleString('th-TH')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Export button */}
                    <td
                      className="px-3 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => downloadJobExport(job.job_id, setExportingId)}
                        disabled={exportingId === job.job_id || job.total_results === 0}
                        title={job.total_results === 0 ? 'ไม่มีข้อมูล POI' : 'Export POI เป็น Excel'}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {exportingId === job.job_id
                          ? <span className="inline-block w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                          : '↓'}
                        xlsx
                      </button>
                    </td>

                    {/* Delete button */}
                    <td
                      className="px-2 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {confirmDeleteId === job.job_id ? (
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(job.job_id)}
                            disabled={deletingId === job.job_id}
                            className="px-2 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {deletingId === job.job_id
                              ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : 'ยืนยัน'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === job.job_id}
                            className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(job.job_id)}
                          disabled={job.status === 'processing'}
                          title={job.status === 'processing' ? 'ไม่สามารถลบ Job ที่กำลังทำงาน' : 'ลบ Job นี้'}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-gray-500">
            แสดง {((page - 1) * pageSize + 1).toLocaleString()}–
            {Math.min(page * pageSize, total).toLocaleString()} จาก{' '}
            {total.toLocaleString()} รายการ
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>

            {pageButtons[0] > 1 && <span className="px-2 text-gray-400">…</span>}

            {pageButtons.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded-md border transition-colors ${
                  p === page
                    ? 'bg-blue-600 text-white border-blue-600 font-medium'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}

            {pageButtons[pageButtons.length - 1] < totalPages && (
              <span className="px-2 text-gray-400">…</span>
            )}

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
