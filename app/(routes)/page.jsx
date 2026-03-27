'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { SidePanel } from '@/components/map/SidePanel'

const MapContainer = dynamic(
  () =>
    import('@/components/map/MapContainer').then((m) => ({
      default: m.MapContainer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-600">
        Loading map...
      </div>
    ),
  },
)

export default function MapGridSelectionPage() {
  const [areas, setAreas] = useState([])
  const [selectedArea, setSelectedArea] = useState(null)
  const [grids, setGrids] = useState([])
  const [selectedGrids, setSelectedGrids] = useState({})
  const [selectionMode, setSelectionMode] = useState('single')
  const [lastSelectedGridId, setLastSelectedGridId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)


  // Load areas on mount
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/areas')
        const json = await response.json()
        if (json.success) {
          setAreas(json.data)
        } else {
          setError('Failed to load areas')
        }
      } catch (err) {
        setError('Error loading areas')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAreas()
  }, [])

  // Load grids when area changes
  useEffect(() => {
    if (!selectedArea) {
      setGrids([])
      setSelectedGrids({})
      setLastSelectedGridId(null)
      return
    }

    const fetchGrids = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/areas/${selectedArea.area_id}/grids`)
        const json = await response.json()
        if (json.success) {
          setGrids(json.data.grids)
          setSelectedGrids({})
          setLastSelectedGridId(null)
        } else {
          setError('Failed to load grids')
        }
      } catch (err) {
        setError('Error loading grids')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGrids()
  }, [selectedArea])

  const handleAreaChange = (areaId) => {
    const area = areas.find((a) => a.area_id === areaId) || null
    setSelectedArea(area)
  }

  const handleGridSelect = (gridId, selected) => {
    if (selectionMode === 'single') {
      setSelectedGrids(selected ? { [gridId]: true } : {})
      setLastSelectedGridId(selected ? gridId : null)
    } else if (selectionMode === 'range') {
      if (!lastSelectedGridId) {
        // First click: set anchor
        setSelectedGrids({ [gridId]: true })
        setLastSelectedGridId(gridId)
      } else {
        // Second click: select the whole range between anchor and this grid
        const ids = grids.map((g) => g.grid_id)
        const start = ids.indexOf(lastSelectedGridId)
        const end = ids.indexOf(gridId)
        const [min, max] = start < end ? [start, end] : [end, start]
        const next = {}
        for (let i = min; i <= max; i++) next[ids[i]] = true
        setSelectedGrids(next)
        setLastSelectedGridId(gridId)
      }
    } else {
      // Multi: toggle each grid independently
      setSelectedGrids((prev) => {
        const next = { ...prev }
        if (selected) next[gridId] = true
        else delete next[gridId]
        return next
      })
      setLastSelectedGridId(gridId)
    }
  }

  const handleSelectionModeChange = (mode) => {
    setSelectionMode(mode)
    setSelectedGrids({})
    setLastSelectedGridId(null)
  }

  const handleClearSelection = () => {
    setSelectedGrids({})
    setLastSelectedGridId(null)
  }

  return (
    <div className="flex h-screen gap-6 p-6 bg-white">
      {/* Left: Map */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                POI Google Map Harvester
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Select an area and choose grids to harvest POI data
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/jobs/history"
                className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                📋 Job History
              </Link>
              <form method="POST" action="/api/auth/logout">
                <button
                  type="submit"
                  className="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
          <MapContainer
            area={selectedArea}
            grids={grids}
            selectedGrids={selectedGrids}
            onGridSelect={handleGridSelect}
            selectionMode={selectionMode}
          />
        </div>
      </div>

      {/* Right: Side Panel */}
      <div className="w-80 flex-shrink-0 min-h-0 flex flex-col">
        <SidePanel
          areas={areas}
          selectedArea={selectedArea}
          grids={grids}
          selectedGrids={selectedGrids}
          selectionMode={selectionMode}
          isLoading={isLoading}
          error={error}
          onAreaChange={handleAreaChange}
          onSelectionModeChange={handleSelectionModeChange}
          onClearSelection={handleClearSelection}
        />
      </div>
    </div>
  )
}
