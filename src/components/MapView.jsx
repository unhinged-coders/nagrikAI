import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function MapView({ location, result }) {
  const severityColor = result.severity === 'High' ? '#FF3B30' : result.severity === 'Medium' ? '#FF9500' : '#34C759'
  return (
    <MapContainer center={[location.lat, location.lng]} zoom={15} style={{ height: 220, width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[location.lat, location.lng]}>
        <Popup>
          <b>{result.issueType}</b><br />
          {result.description}<br />
          <span style={{ color: severityColor, fontWeight: 'bold' }}>{result.severity} Severity</span>
        </Popup>
      </Marker>
    </MapContainer>
  )
}