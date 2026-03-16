import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, GeoJSON, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Approximate ward polygons built from center points ───────────────────────
// Real GeoJSON would be more precise, but this gives BI-style choropleth
// without any external file dependency
const WARD_POLYGONS = {
  'A':     [[18.870,72.790],[18.870,72.840],[18.930,72.840],[18.930,72.790]],
  'B':     [[18.930,72.810],[18.930,72.860],[18.975,72.860],[18.975,72.810]],
  'C':     [[18.940,72.790],[18.940,72.830],[18.975,72.830],[18.975,72.790]],
  'D':     [[18.945,72.775],[18.945,72.820],[18.985,72.820],[18.985,72.775]],
  'E':     [[18.960,72.820],[18.960,72.860],[19.000,72.860],[19.000,72.820]],
  'F/North':[[19.010,72.835],[19.010,72.880],[19.055,72.880],[19.055,72.835]],
  'F/South':[[18.995,72.835],[18.995,72.875],[19.030,72.875],[19.030,72.835]],
  'G/North':[[19.000,72.820],[19.000,72.865],[19.040,72.865],[19.040,72.820]],
  'G/South':[[19.000,72.790],[19.000,72.835],[19.040,72.835],[19.040,72.790]],
  'H/East': [[19.035,72.815],[19.035,72.860],[19.075,72.860],[19.075,72.815]],
  'H/West': [[19.040,72.800],[19.040,72.845],[19.080,72.845],[19.080,72.800]],
  'K/East': [[19.090,72.845],[19.090,72.900],[19.140,72.900],[19.140,72.845]],
  'K/West': [[19.095,72.820],[19.095,72.865],[19.145,72.865],[19.145,72.820]],
  'L':      [[19.050,72.855],[19.050,72.910],[19.100,72.910],[19.100,72.855]],
  'M/East': [[19.030,72.890],[19.030,72.940],[19.075,72.940],[19.075,72.890]],
  'M/West': [[19.045,72.875],[19.045,72.920],[19.085,72.920],[19.085,72.875]],
  'N':      [[19.070,72.880],[19.070,72.940],[19.110,72.940],[19.110,72.880]],
  'P/North':[[19.145,72.825],[19.145,72.880],[19.195,72.880],[19.195,72.825]],
  'P/South':[[19.165,72.820],[19.165,72.875],[19.210,72.875],[19.210,72.820]],
  'R/Central':[[19.180,72.825],[19.180,72.880],[19.225,72.880],[19.225,72.825]],
  'R/North':[[19.205,72.830],[19.205,72.885],[19.255,72.885],[19.255,72.830]],
  'R/South':[[19.225,72.830],[19.225,72.885],[19.275,72.885],[19.275,72.830]],
  'S':      [[19.120,72.915],[19.120,72.965],[19.165,72.965],[19.165,72.915]],
  'T':      [[19.150,72.930],[19.150,72.980],[19.200,72.980],[19.200,72.930]],
}

// Build GeoJSON from polygon coords
const buildGeoJSON = (wardStats) => ({
  type: 'FeatureCollection',
  features: Object.entries(WARD_POLYGONS).map(([ward, coords]) => ({
    type: 'Feature',
    properties: {
      ward,
      count:    wardStats[ward]?.count    || 0,
      high:     wardStats[ward]?.high     || 0,
      resolved: wardStats[ward]?.resolved || 0,
      name:     wardStats[ward]?.name     || ward,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[...coords.map(([lat, lng]) => [lng, lat]), [coords[0][1], coords[0][0]]]],
    }
  }))
})

// Color scale: white → orange → red based on complaint count
const getColor = (count, max) => {
  if (max === 0 || count === 0) return '#1A1A2E'
  const ratio = count / max
  if (ratio < 0.2) return '#2D1B00'
  if (ratio < 0.4) return '#7A3300'
  if (ratio < 0.6) return '#B84E00'
  if (ratio < 0.8) return '#E06000'
  return '#FF6B00'
}

// ── Heatmap layer component ──────────────────────────────────────────────────
function HeatmapLayer({ points }) {
  const map = useMap()
  const heatRef = useRef(null)

  useEffect(() => {
    if (!points || points.length === 0) return

    // Dynamically load leaflet.heat
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'
    script.onload = () => {
      if (heatRef.current) { map.removeLayer(heatRef.current) }
      const heatData = points.map(p => [
        p.lat, p.lng,
        p.severity === 'High' ? 1.0 : p.severity === 'Medium' ? 0.6 : 0.3
      ])
      heatRef.current = L.heatLayer(heatData, {
        radius:    25,
        blur:      20,
        maxZoom:   17,
        max:       1.0,
        gradient:  { 0.2: '#FF6B00', 0.5: '#FF3B30', 0.8: '#FF0000', 1.0: '#FFFFFF' }
      }).addTo(map)
    }
    document.head.appendChild(script)

    return () => {
      if (heatRef.current) { map.removeLayer(heatRef.current) }
    }
  }, [points, map])

  return null
}

// ── Choropleth layer component ───────────────────────────────────────────────
function ChoroplethLayer({ geoData, maxCount, onWardClick }) {
  const style = (feature) => ({
    fillColor:   getColor(feature.properties.count, maxCount),
    fillOpacity: feature.properties.count > 0 ? 0.75 : 0.2,
    color:       '#FF6B00',
    weight:      1,
    opacity:     0.6,
  })

  const onEachFeature = (feature, layer) => {
    const { ward, name, count, high, resolved } = feature.properties
    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ fillOpacity: 0.9, weight: 2 })
      },
      mouseout: (e) => {
        e.target.setStyle({ fillOpacity: count > 0 ? 0.75 : 0.2, weight: 1 })
      },
      click: () => onWardClick(feature.properties),
    })
  }

  return (
    <GeoJSON
      key={JSON.stringify(geoData)}
      data={geoData}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MumbaiAnalyticsMap({ complaints = [] }) {
  const [viewMode, setViewMode]       = useState('heatmap')   // 'heatmap' | 'choropleth'
  const [filterType, setFilterType]   = useState('All')
  const [selectedWard, setSelectedWard] = useState(null)

  // Compute ward stats from complaints
  const wardStats = {}
  complaints.forEach(c => {
    const w = c.ward
    if (!wardStats[w]) wardStats[w] = { count: 0, high: 0, medium: 0, low: 0, resolved: 0, name: c.wardName || w, issues: {} }
    wardStats[w].count++
    if (c.severity === 'High')   wardStats[w].high++
    if (c.severity === 'Medium') wardStats[w].medium++
    if (c.severity === 'Low')    wardStats[w].low++
    if (c.status === 'Resolved') wardStats[w].resolved++
    wardStats[w].issues[c.issueType] = (wardStats[w].issues[c.issueType] || 0) + 1
  })

  const maxCount = Math.max(...Object.values(wardStats).map(w => w.count), 1)

  // Filter complaints for heatmap
  const filteredComplaints = filterType === 'All'
    ? complaints
    : complaints.filter(c => c.issueType === filterType)

  const heatPoints = filteredComplaints
    .filter(c => c.lat && c.lng)
    .map(c => ({ lat: c.lat, lng: c.lng, severity: c.severity }))

  const geoData = buildGeoJSON(wardStats)

  // Summary stats
  const totalComplaints = complaints.length
  const highPriority    = complaints.filter(c => c.severity === 'High').length
  const resolved        = complaints.filter(c => c.status === 'Resolved').length
  const hotWard         = Object.entries(wardStats).sort((a, b) => b[1].count - a[1].count)[0]

  const ISSUE_TYPES = ['All', 'Pothole', 'Garbage', 'Broken Streetlight', 'Waterlogging']

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#0D0D0D', borderRadius: 20, overflow: 'hidden', border: '1px solid #1E1E1E', marginBottom: 16 }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif' }}>Mumbai Complaint Analytics</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Live data from Firestore</div>
        </div>
        {/* Toggle */}
        <div style={{ display: 'flex', background: '#1A1A1A', border: '1px solid #252525', borderRadius: 10, overflow: 'hidden' }}>
          {['heatmap', 'choropleth'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              background: viewMode === mode ? '#FF6B00' : 'transparent',
              color: viewMode === mode ? '#fff' : '#555',
              transition: 'all 0.2s',
            }}>
              {mode === 'heatmap' ? '🔥 Heatmap' : '🗺️ Ward Map'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 16px' }}>
        {[
          { label: 'Total',       value: totalComplaints, color: '#FF6B00' },
          { label: 'High',        value: highPriority,    color: '#FF3B30' },
          { label: 'Resolved',    value: resolved,        color: '#34C759' },
          { label: 'Hot Ward',    value: hotWard ? `${hotWard[0]}` : '—', color: '#FF9500', sub: hotWard ? `${hotWard[1].count} issues` : '' },
        ].map(s => (
          <div key={s.label} style={{ background: '#141414', border: '1px solid #1E1E1E', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Issue filter (heatmap only) */}
      {viewMode === 'heatmap' && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto' }}>
          {ISSUE_TYPES.map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid',
              borderColor: filterType === t ? '#FF6B00' : '#252525',
              background: filterType === t ? '#FF6B0018' : 'transparent',
              color: filterType === t ? '#FF6B00' : '#555',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div style={{ height: 340, position: 'relative' }}>
        <MapContainer
          center={[19.076, 72.877]}
          zoom={11}
          style={{ height: '100%', width: '100%', background: '#0D0D0D' }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CartoDB'
          />
          {viewMode === 'heatmap' && <HeatmapLayer points={heatPoints} />}
          {viewMode === 'choropleth' && (
            <ChoroplethLayer
              geoData={geoData}
              maxCount={maxCount}
              onWardClick={setSelectedWard}
            />
          )}
        </MapContainer>

        {/* Legend */}
        {viewMode === 'choropleth' && (
          <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(13,13,13,0.9)', border: '1px solid #252525', borderRadius: 10, padding: '8px 12px', zIndex: 999 }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Complaints</div>
            {[
              { color: '#1A1A2E', label: '0' },
              { color: '#7A3300', label: '1-2' },
              { color: '#B84E00', label: '3-5' },
              { color: '#E06000', label: '6-9' },
              { color: '#FF6B00', label: '10+' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color, border: '1px solid #333' }} />
                <span style={{ fontSize: 11, color: '#888' }}>{l.label}</span>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'heatmap' && (
          <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(13,13,13,0.9)', border: '1px solid #252525', borderRadius: 10, padding: '8px 12px', zIndex: 999 }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Intensity</div>
            {[
              { color: '#FF6B00', label: 'Low' },
              { color: '#FF3B30', label: 'Medium' },
              { color: '#FFFFFF', label: 'High' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.color }} />
                <span style={{ fontSize: 11, color: '#888' }}>{l.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ward detail panel (choropleth click) */}
      {selectedWard && (
        <div style={{ margin: '0 16px 16px', background: '#141414', border: '1px solid #FF6B0030', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
              Ward {selectedWard.ward} — {selectedWard.name}
            </div>
            <button onClick={() => setSelectedWard(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'Total',    value: selectedWard.count,    color: '#FF6B00' },
              { label: 'High',     value: selectedWard.high,     color: '#FF3B30' },
              { label: 'Resolved', value: selectedWard.resolved, color: '#34C759' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1A1A1A', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {selectedWard.count > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Issue Breakdown</div>
              {Object.entries(wardStats[selectedWard.ward]?.issues || {}).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 11, color: '#888', flex: 1 }}>{type}</div>
                  <div style={{ height: 6, borderRadius: 3, background: '#FF6B00', width: `${(count / selectedWard.count) * 120}px`, minWidth: 4 }} />
                  <div style={{ fontSize: 11, color: '#FF6B00', fontWeight: 700, minWidth: 16 }}>{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {complaints.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: '#333', fontSize: 13 }}>
          Koi complaint data nahi — pehle kuch complaints submit karo
        </div>
      )}
    </div>
  )
}