'use client'

import React, { useEffect, useRef, useState } from 'react'

const getStatusColor = (status) => {
  switch (status) {
    case 'completed':  return '#92400e'   // brown — harvested
    case 'processing': return '#f59e0b'
    case 'failed':     return '#ef4444'
    case 'skipped':    return '#6b7280'
    case 'pending':
    default:           return '#3b82f6'
  }
}

export const MapContainer = ({
  area,
  grids,
  selectedGrids,
  onGridSelect,
  selectionMode,
}) => {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(6)
  const [hoveredGrid, setHoveredGrid] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const layersRef = useRef({ boundary: null, grids: [] })
  const googleRef = useRef(null)
  // Keep onGridSelect always current without putting it in effect deps
  const onGridSelectRef = useRef(onGridSelect)
  onGridSelectRef.current = onGridSelect

  // Initialize Google Map
  useEffect(() => {
    if (!containerRef.current) return

    const initMap = async () => {
      try {
        const google = await new Promise((resolve, reject) => {
          if (window.google?.maps?.Map) { resolve(window.google); return }
          let waited = 0
          const interval = setInterval(() => {
            waited += 100
            if (window.google?.maps?.Map) {
              clearInterval(interval); resolve(window.google)
            } else if (waited >= 10000) {
              clearInterval(interval)
              reject(new Error('Google Maps script did not load in time'))
            }
          }, 100)
        })

        googleRef.current = google

        if (!mapRef.current && containerRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            zoom: 6,
            center: { lat: 13.0, lng: 101.0 },
            mapTypeId: 'roadmap',
          })
          setMapLoaded(true)
          mapRef.current.addListener('zoom_changed', () => {
            setZoomLevel(mapRef.current.getZoom())
          })
        }
      } catch (err) {
        const msg = `Failed to load Google Maps: ${err.message}`
        console.error(msg, err)
        setError(msg)
      }
    }

    initMap()
  }, [])

  // Update boundary polygon
  useEffect(() => {
    if (!mapRef.current || !googleRef.current || !area) return

    const google = googleRef.current

    if (layersRef.current.boundary) {
      layersRef.current.boundary.forEach((p) => p.setMap(null))
    }

    if (area.boundary_geojson) {
      const boundaries = []
      const features = area.boundary_geojson.features || []

      features.forEach((feature) => {
        if (feature.geometry.type === 'Polygon') {
          const coords = feature.geometry.coordinates[0].map((c) => ({
            lat: c[1], lng: c[0],
          }))
          boundaries.push(new google.maps.Polygon({
            paths: coords,
            strokeColor: '#374151',
            strokeOpacity: 0.4,
            strokeWeight: 1.5,
            fillColor: '#000000',
            fillOpacity: 0.03,
            clickable: false,
            map: mapRef.current,
          }))
        }
      })

      layersRef.current.boundary = boundaries

      if (boundaries.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        features.forEach((f) => {
          if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates[0].forEach((c) => bounds.extend({ lat: c[1], lng: c[0] }))
          }
        })
        mapRef.current.fitBounds(bounds)
      }
    }
  }, [area, mapLoaded])

  // Update grid overlays — only re-runs when grids data or selection changes
  useEffect(() => {
    if (!mapRef.current || !googleRef.current) return

    const google = googleRef.current

    layersRef.current.grids.forEach(({ rectangle }) => rectangle.setMap(null))
    layersRef.current.grids = []

    grids.forEach((grid) => {
      if (grid.min_lat == null || grid.max_lat == null || grid.min_lng == null || grid.max_lng == null) return

      const isSelected = !!selectedGrids[grid.grid_id]
      const statusColor = getStatusColor(grid.status)

      const rectangle = new google.maps.Rectangle({
        bounds: {
          north: parseFloat(grid.max_lat),
          south: parseFloat(grid.min_lat),
          east: parseFloat(grid.max_lng),
          west: parseFloat(grid.min_lng),
        },
        strokeColor: isSelected ? '#1d4ed8' : statusColor,
        strokeOpacity: 0.9,
        strokeWeight: isSelected ? 3 : 1,
        fillColor: isSelected ? '#3b82f6' : statusColor,
        fillOpacity: isSelected ? 0.5 : 0.25,
        map: mapRef.current,
        zIndex: isSelected ? 2 : 1,
      })

      rectangle.addListener('click', () => {
        onGridSelectRef.current(grid.grid_id, !isSelected)
      })

      rectangle.addListener('mouseover', () => {
        setHoveredGrid({ code: grid.grid_code, status: grid.status, row: grid.row_index, col: grid.col_index, lastHarvestedAt: grid.last_harvested_at })
        rectangle.setOptions({ strokeWeight: isSelected ? 3 : 2, fillOpacity: isSelected ? 0.65 : 0.45 })
      })

      rectangle.addListener('mouseout', () => {
        setHoveredGrid(null)
        rectangle.setOptions({ strokeWeight: isSelected ? 3 : 1, fillOpacity: isSelected ? 0.5 : 0.25 })
      })

      layersRef.current.grids.push({ gridId: grid.grid_id, rectangle })
    })
  }, [grids, selectedGrids])

  return (
    <div
      className="h-full w-full rounded-lg border border-gray-200 relative"
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }}
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-50 rounded-lg">
          <div className="text-center p-6 bg-white rounded-lg border border-red-200">
            <p className="text-red-600 font-semibold mb-2">Map Error</p>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <p className="text-gray-600 text-xs">Check browser console (F12) for details</p>
          </div>
        </div>
      )}
      {!error && !mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-40 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Loading Google Maps...</p>
          </div>
        </div>
      )}
      {/* Hover tooltip — follows cursor, never blocks clicks */}
      {hoveredGrid && (
        <div
          className="absolute z-20 pointer-events-none bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(mousePos.x + 14, (containerRef.current?.offsetWidth ?? 400) - 160),
            top: mousePos.y > 80 ? mousePos.y - 72 : mousePos.y + 14,
          }}
        >
          <p className="font-bold text-gray-900 text-sm mb-0.5">{hoveredGrid.code}</p>
          <p className="text-gray-500">สถานะ: <span className={`font-medium capitalize ${hoveredGrid.status === 'completed' ? 'text-amber-800' : 'text-gray-700'}`}>{hoveredGrid.status === 'completed' ? 'เก็บแล้ว' : hoveredGrid.status}</span></p>
          {hoveredGrid.lastHarvestedAt && (
            <p className="text-amber-700 font-medium">เก็บล่าสุด: {new Date(hoveredGrid.lastHarvestedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
          )}
          <p className="text-gray-400">Row {hoveredGrid.row} · Col {hoveredGrid.col}</p>
        </div>
      )}
      {/* Zoom hint */}
      {grids.length > 0 && zoomLevel < 14 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
            Zoom in to select grids (zoom {zoomLevel} → need 14+)
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full rounded-lg" />
    </div>
  )
}
