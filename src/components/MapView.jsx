import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function MapView({ lat, lng, ward }) {
  if (!lat || !lng) return null
  return (
    <div style={{ height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>
            📍 {ward?.name || 'Location'}<br />
            Ward: {ward?.ward}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}