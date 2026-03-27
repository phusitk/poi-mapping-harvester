'use client'

import React from 'react'
import Link from 'next/link'

const getStatusCount = (grids, selectedGrids) => {
  const counts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  }

  grids.forEach((grid) => {
    if (selectedGrids[grid.grid_id]) {
      counts[grid.status]++
    }
  })

  return counts
}

export const SidePanel = ({
  areas,
  grids,
  selectedArea,
  selectedGrids,
  selectionMode,
  isLoading,
  onAreaChange,
  onSelectionModeChange,
  onClearSelection,
}) => {
  const selectedGridList = grids.filter((g) => selectedGrids[g.grid_id])
  const selectedCount = selectedGridList.length
  const statusCounts = getStatusCount(grids, selectedGrids)
  const hasWarning = selectedCount > 20

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      {/* Area Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Area
        </label>
        <select
          value={selectedArea?.area_id || ''}
          onChange={(e) => onAreaChange(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        >
          <option value="">-- Choose an area --</option>
          {areas.map((area) => (
            <option key={area.area_id} value={area.area_id}>
              {area.area_name}
            </option>
          ))}
        </select>
        {selectedArea && (
          <p className="text-xs text-gray-500 mt-1">
            {selectedArea.description}
          </p>
        )}
      </div>

      {/* Color Legend */}
      {selectedArea && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          {[
            { color: '#3b82f6', label: 'ยังไม่เก็บ' },
            { color: '#92400e', label: 'เก็บแล้ว' },
            { color: '#f59e0b', label: 'กำลังเก็บ' },
            { color: '#ef4444', label: 'ล้มเหลว' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm shrink-0 border border-white shadow-sm" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {selectedArea && (
        <>
          {/* Selection Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selection Mode
            </label>
            <div className="flex gap-2">
              {['single', 'multi', 'range'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => onSelectionModeChange(mode)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
                    selectionMode === mode
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {selectionMode === 'single' && 'คลิก grid = เลือกได้ทีละ 1 ช่อง'}
              {selectionMode === 'multi' && 'คลิกแต่ละ grid เพื่อเพิ่ม/ลบออกจากรายการ'}
              {selectionMode === 'range' && 'คลิก grid แรก → คลิก grid สุดท้าย เพื่อเลือกทั้งช่วง'}
            </p>
          </div>

          {/* Selection Summary */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-700">
                Selected Grids:{' '}
                <span className="text-blue-600 font-semibold">
                  {selectedCount}
                </span>
              </h3>
              {selectedCount > 0 && (
                <button
                  onClick={onClearSelection}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {hasWarning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                <p className="text-xs text-yellow-800">
                  ⚠️ You have selected {selectedCount} grids. This may take time
                  to process.
                </p>
              </div>
            )}

            {/* Status Summary */}
            {selectedCount > 0 && (
              <div className="bg-gray-50 rounded p-3 mb-3 space-y-1 text-xs">
                {Object.entries(statusCounts).map(([status, count]) =>
                  count > 0 ? (
                    <div key={status} className="flex justify-between">
                      <span className="text-gray-600 capitalize">
                        {status}:
                      </span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>

          {/* Selected Grids List */}
          {selectedCount > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                Selected Grids
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selectedGridList.map((grid) => {
                  const dotColor = {
                    completed:  '#92400e',
                    processing: '#f59e0b',
                    failed:     '#ef4444',
                    skipped:    '#6b7280',
                    pending:    '#3b82f6',
                  }[grid.status] ?? '#3b82f6'
                  return (
                    <div
                      key={grid.grid_id}
                      className="flex items-center justify-between text-xs text-gray-700 p-1 hover:bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: dotColor }} />
                        <span className="font-medium">{grid.grid_code}</span>
                      </div>
                      <span className="text-gray-500">{grid.status === 'completed' ? 'เก็บแล้ว' : grid.status}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Link
              href={`/jobs/create?grids=${selectedGridList.map((g) => g.grid_id).join(',')}&areaId=${selectedArea.area_id}&gridCodes=${selectedGridList.map((g) => g.grid_code).join(',')}`}
              className={`flex-1 px-4 py-2 text-center font-medium rounded-lg transition ${
                selectedCount === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Create Job
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
