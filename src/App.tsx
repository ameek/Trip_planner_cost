import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import TripPage from './pages/TripPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/t/:shortId" element={<TripPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}