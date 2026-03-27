'use client'

import React, { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const statusColor = {
  pending:    'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  completed:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
  cancelled:  'bg-gray-100 text-gray-600',
  paused:     'bg-purple-100 text-purple-700',
}

const POI_PAGE_SIZE = 50

// ─── Color palette ────────────────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#6366f1','#eab308','#22c55e','#a855f7','#0ea5e9',
  '#78716c','#64748b','#f43f5e','#2dd4bf','#fb923c',
]

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ slices, total, size = 220 }) {
  const cx = size / 2
  const cy = size / 2
  const R  = size * 0.40   // outer radius
  const r  = size * 0.24   // inner radius

  const polar = (angle) => ({
    x: cx + R * Math.cos(angle),
    y: cy + R * Math.sin(angle),
  })
  const polarInner = (angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  })

  let cum = -Math.PI / 2   // start from 12 o'clock
  const paths = slices.map((s, i) => {
    const sweep = (s.percent / 100) * 2 * Math.PI
    const start = cum
    const end   = cum + sweep
    cum = end

    // Edge case: full circle → split into two arcs
    if (s.percent >= 99.9) {
      const mid = start + Math.PI
      const p0  = polar(start), p1 = polar(mid)
      const q0  = polarInner(start), q1 = polarInner(mid)
      const d = [
        `M ${p0.x} ${p0.y} A ${R} ${R} 0 1 1 ${p1.x} ${p1.y}`,
        `A ${R} ${R} 0 1 1 ${p0.x} ${p0.y}`,
        `L ${q0.x} ${q0.y}`,
        `A ${r} ${r} 0 1 0 ${q1.x} ${q1.y}`,
        `A ${r} ${r} 0 1 0 ${q0.x} ${q0.y} Z`,
      ].join(' ')
      return { d, color: s.color, key: i }
    }

    const large = sweep > Math.PI ? 1 : 0
    const os = polar(start), oe = polar(end)
    const is = polarInner(start), ie = polarInner(end)
    const d = [
      `M ${os.x} ${os.y}`,
      `A ${R} ${R} 0 ${large} 1 ${oe.x} ${oe.y}`,
      `L ${ie.x} ${ie.y}`,
      `A ${r} ${r} 0 ${large} 0 ${is.x} ${is.y}`,
      `Z`,
    ].join(' ')
    return { d, color: s.color, key: i }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.color} stroke="white" strokeWidth="1.5" />
      ))}
      {/* Center label */}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="11" fill="#9ca3af">POI ทั้งหมด</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#111827">
        {total.toLocaleString()}
      </text>
    </svg>
  )
}

// ─── Category Summary Section ──────────────────────────────────────────────────
function CategorySummarySection({ jobId }) {
  const [data, setData]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/poi/summary`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data)
          setTotal(res.total)
        } else {
          setError(res.error)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [jobId])

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded animate-pulse" />
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-red-500">โหลด summary ไม่สำเร็จ: {error}</p>
  }
  if (data.length === 0) return null

  // Assign colors; group tail (beyond 12) into "อื่นๆ"
  const MAX_SLICES = 12
  let chartData = data.slice(0, MAX_SLICES).map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }))
  if (data.length > MAX_SLICES) {
    const otherCount   = data.slice(MAX_SLICES).reduce((s, d) => s + d.count, 0)
    const otherPercent = total > 0 ? Math.round((otherCount / total) * 1000) / 10 : 0
    chartData.push({ category: 'อื่นๆ', count: otherCount, percent: otherPercent, color: '#d1d5db' })
  }

  // Recalculate percent from actual count so chart adds to 100%
  chartData = chartData.map((d) => ({
    ...d,
    percent: total > 0 ? (d.count / total) * 100 : 0,
  }))

  const maxCount = data[0]?.count ?? 1

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-800">สรุปประเภท POI</h2>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Donut chart ── */}
        <div className="flex flex-col items-center shrink-0">
          <DonutChart slices={chartData} total={total} size={220} />
          {/* Legend */}
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs max-w-[240px]">
            {chartData.map((d) => (
              <div key={d.category} className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="truncate text-gray-600">{d.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                <th className="text-left px-3 py-2 font-semibold text-gray-500 w-8">#</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">ประเภท</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-500">จำนวน</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-500">%</th>
                <th className="px-3 py-2 w-32 hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row, i) => {
                const color = PALETTE[i % PALETTE.length]
                const barW  = Math.round((row.count / maxCount) * 100)
                return (
                  <tr key={row.category} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                        <span className="text-gray-800 font-medium">{row.category}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                      {row.percent.toFixed(1)}%
                    </td>
                    {/* Mini bar */}
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ width: `${barW}%`, background: color }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {/* Total row */}
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-sm">
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-gray-700">รวม</td>
                <td className="px-3 py-2 text-right text-gray-900">{total.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-500">100%</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---- POI Table Section ----
function PoiSection({ jobId, totalResults, keywords }) {
  const [pois, setPois]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [kwFilter, setKwFilter]   = useState('')
  const [exportingPoi, setExportingPoi] = useState(false)

  const fetchPoi = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(POI_PAGE_SIZE) })
      if (kwFilter) params.set('keyword', kwFilter)

      const res  = await fetch(`/api/jobs/${jobId}/poi?${params}`)
      const data = await res.json()
      if (data.success) {
        setPois(data.data)
        setTotal(data.meta.total)
        setTotalPages(data.meta.totalPages)
      } else {
        setError(data.error || 'Failed to fetch POI')
      }
    } catch (err) {
      setError('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [jobId, page, kwFilter])

  useEffect(() => { fetchPoi() }, [fetchPoi])

  const handleKwChange = (kw) => { setKwFilter(kw); setPage(1) }

  const handleExport = async () => {
    setExportingPoi(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/export`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const match = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)
      a.download  = match ? match[1] : `poi_${jobId}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export ไม่สำเร็จ: ' + err.message)
    } finally {
      setExportingPoi(false)
    }
  }

  // Pagination buttons
  const pageButtons = (() => {
    if (totalPages <= 1) return []
    const range = 2
    let start = Math.max(1, page - range)
    let end   = Math.min(totalPages, page + range)
    if (end - start < range * 2) {
      if (start === 1) end = Math.min(totalPages, start + range * 2)
      else start = Math.max(1, end - range * 2)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })()

  return (
    <div className="space-y-3">
      {/* POI header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-semibold text-gray-800">
            รายการ POI{' '}
            <span className="text-gray-400 font-normal text-sm">
              ({total.toLocaleString()} รายการ)
            </span>
          </h2>
          {/* Keyword filter */}
          <select
            value={kwFilter}
            onChange={(e) => handleKwChange(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ทุก Keyword</option>
            {keywords.map((k) => (
              <option key={k.keyword_text} value={k.keyword_text}>
                {k.keyword_text}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={exportingPoi || totalResults === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {exportingPoi ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : '↓'}
          Export Excel
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-1.5">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      ) : pois.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border border-gray-200 rounded-lg">
          ไม่พบข้อมูล POI
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500 w-10">#</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">ชื่อสถานที่</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">ประเภท</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Keyword</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">ที่อยู่</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Rating</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Reviews</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Grid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {pois.map((poi, i) => (
                <tr key={poi.poi_raw_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-400 text-xs">
                    {(page - 1) * POI_PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <p className="font-medium text-gray-900 truncate">{poi.place_name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{poi.latitude}, {poi.longitude}</p>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                    {poi.primary_category || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      {poi.keyword_text}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[220px]">
                    <span className="line-clamp-2">{poi.address || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700">
                    {poi.rating != null ? (
                      <span className="text-yellow-600 font-medium">{poi.rating}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500 text-xs">
                    {poi.reviews_count != null ? poi.reviews_count.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                      {poi.grid_code}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-gray-500 text-xs">
            แสดง {((page - 1) * POI_PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(page * POI_PAGE_SIZE, total).toLocaleString()} จาก {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs">
              «
            </button>
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
              className="px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs">
              ‹
            </button>
            {pageButtons[0] > 1 && <span className="px-1 text-gray-400 text-xs">…</span>}
            {pageButtons.map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                  p === page
                    ? 'bg-blue-600 text-white border-blue-600 font-medium'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}>
                {p}
              </button>
            ))}
            {pageButtons[pageButtons.length - 1] < totalPages && (
              <span className="px-1 text-gray-400 text-xs">…</span>
            )}
            <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}
              className="px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs">
              ›
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs">
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Main Job Detail Page ----
export default function JobDetailPage({ params }) {
  const { jobId } = use(params)
  const [job, setJob]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [starting, setStarting] = useState(false)
  const [startMsg, setStartMsg] = useState(null)

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res  = await fetch(`/api/jobs/${jobId}`)
        const data = await res.json()
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

    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/jobs/${jobId}`)
        const data = await res.json()
        if (data.success) {
          setJob(data.data)
          if (['completed', 'failed', 'cancelled'].includes(data.data.status)) {
            clearInterval(interval)
          }
        }
      } catch {}
    }, 5000)

    return () => clearInterval(interval)
  }, [jobId])

  const handleStart = async () => {
    setStarting(true)
    setStartMsg(null)
    try {
      const res  = await fetch(`/api/jobs/${jobId}/start`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setStartMsg({ type: 'ok', text: `Worker started (PID ${data.data.pid})` })
      } else {
        setStartMsg({ type: 'err', text: data.error })
      }
    } catch (e) {
      setStartMsg({ type: 'err', text: e.message })
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Link href="/jobs/history" className="text-sm text-blue-600 hover:underline mb-4 block">← Back to history</Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  const progress = job.total_grids > 0
    ? Math.floor((job.done_grids * 100) / job.total_grids)
    : 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <Link href="/jobs/history" className="text-sm text-blue-600 hover:underline mb-2 block">← Back to history</Link>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{job.job_name}</h1>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${statusColor[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {job.status}
            </span>
            {['pending', 'failed'].includes(job.status) && (
              <button
                onClick={handleStart}
                disabled={starting}
                className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {starting ? 'Starting…' : '▶ Start Worker'}
              </button>
            )}
          </div>
        </div>
        {startMsg && (
          <p className={`text-sm mt-1 ${startMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {startMsg.text}
          </p>
        )}
        {job.job_description && (
          <p className="text-gray-500 text-sm mt-1">{job.job_description}</p>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span className="font-medium">{job.done_grids} / {job.total_grids} grids</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-500 mt-1">{progress}%</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Grids',   value: job.total_grids,   color: 'text-blue-600' },
          { label: 'Completed',     value: job.done_grids,    color: 'text-green-600' },
          { label: 'Failed',        value: job.failed_grids,  color: 'text-red-600' },
          { label: 'POI Collected', value: job.total_results, color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Job Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-gray-700 mb-3">Job Details</h2>
        {[
          ['Job ID',          <span key="id" className="font-mono text-xs">{job.job_id}</span>],
          ['Area',            job.area_name],
          ['Created By',      job.created_by],
          ['Keyword Set',     job.keyword_set_name],
          ['Collection Type', job.collection_type],
          ['Created At',      new Date(job.created_at).toLocaleString('th-TH')],
          job.started_at  ? ['Started At',  new Date(job.started_at).toLocaleString('th-TH')]  : null,
          job.finished_at ? ['Finished At', new Date(job.finished_at).toLocaleString('th-TH')] : null,
        ].filter(Boolean).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-gray-500 shrink-0">{label}:</span>
            <span className="text-gray-800 text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {job.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Error</p>
          <p className="text-sm text-red-600">{job.error_message}</p>
        </div>
      )}

      {/* Category Summary — only when there's data */}
      {job.total_results > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <CategorySummarySection jobId={jobId} />
        </div>
      )}

      {/* POI Section — only when there's data */}
      {job.total_results > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <PoiSection
            jobId={jobId}
            totalResults={job.total_results}
            keywords={job.keywords ?? []}
          />
        </div>
      )}
    </div>
  )
}
