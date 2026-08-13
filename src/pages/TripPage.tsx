import { Navigate, useParams } from 'react-router-dom'
import { TripProvider } from '../lib/TripContext'
import TripContent from './TripContent'

export default function TripPage() {
  const { shortId } = useParams()
  if (!shortId) return <Navigate to="/" replace />
  return (
    <TripProvider key={shortId} shortId={shortId}>
      <TripContent />
    </TripProvider>
  )
}