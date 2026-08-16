import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useIsRestoring } from '@tanstack/react-query'
import * as api from './api'
import { formatMoney as formatCurrency } from './format'
import { useTripQuery } from './queries'
import type { TripPublic } from './types'

export interface TripContextValue {
  trip: TripPublic
  tripId: string
  editable: boolean
  unlockInput: string
  setUnlockInput: (v: string) => void
  codeError: string | null
  verifying: boolean
  unlock: () => Promise<void>
  lock: () => void
  formatMoney: (amount: number) => string
}

const TripContext = createContext<TripContextValue | null>(null)

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip must be used inside TripProvider')
  return ctx
}

export function TripProvider({ shortId, children }: { shortId: string; children: ReactNode }) {
  const isRestoring = useIsRestoring()
  const tripQuery = useTripQuery(shortId)
  const [editable, setEditable] = useState(() => api.isTripUnlocked(shortId))
  const [unlockInput, setUnlockInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const unlock = useCallback(async () => {
    if (unlockInput.length !== 4) {
      setCodeError('Enter the 4-digit code.')
      return
    }
    setVerifying(true)
    setCodeError(null)
    try {
      const ok = await api.verifyCode(shortId, unlockInput)
      if (ok) {
        api.setTripUnlocked(shortId, true)
        setEditable(true)
        setUnlockInput('')
      } else {
        setCodeError("That code didn't match. Try again.")
      }
    } catch (err) {
      const okOffline = await api.checkPinMatch(shortId, unlockInput)
      if (okOffline) {
        api.setTripUnlocked(shortId, true)
        setEditable(true)
        setUnlockInput('')
      } else {
        setCodeError(err instanceof Error ? err.message : 'Could not verify the code.')
      }
    } finally {
      setVerifying(false)
    }
  }, [shortId, unlockInput])

  const lock = useCallback(() => {
    api.setTripUnlocked(shortId, false)
    setEditable(false)
    setUnlockInput('')
    setCodeError(null)
  }, [shortId])

  // While IndexedDB is restoring cache or query is loading initial data, show loading state
  if (isRestoring || (tripQuery.isLoading && !tripQuery.data)) {
    return (
      <div className="min-h-screen bg-sand">
        <div className="mx-auto max-w-3xl px-4 pt-20 text-center">
          <p className="font-mono text-sm text-moss">Loading trip…</p>
        </div>
      </div>
    )
  }

  // Fallback to local storage mirror cache if React Query didn't have it yet
  const trip = tripQuery.data ?? api.getLocalCache<TripPublic>(api.cacheTripKey(shortId))

  if (!trip) {
    if (tripQuery.isError) {
      return (
        <div className="min-h-screen bg-sand">
          <div className="mx-auto max-w-3xl px-4 pt-20">
            <div className="card p-6 text-center">
              <div className="eyebrow">Trailmark</div>
              <h1 className="mt-2 font-display text-2xl font-bold text-pine">Could not load the trip</h1>
              <p className="mt-2 text-sm text-moss">
                {tripQuery.error instanceof Error ? tripQuery.error.message : 'Something went wrong.'}
              </p>
              <Link to="/?select=1" className="btn btn-primary mt-5 inline-flex">
                Back to start
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-sand">
        <div className="mx-auto max-w-3xl px-4 pt-20">
          <div className="card p-6 text-center">
            <div className="eyebrow">Trailmark</div>
            <h1 className="mt-2 font-display text-2xl font-bold text-pine">Trip not found</h1>
            <p className="mt-2 text-sm text-moss">
              Check that the link is correct, or ask whoever shared it for a fresh one.
            </p>
            <Link to="/?select=1" className="btn btn-primary mt-5 inline-flex">
              Back to start
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const formatMoney = (amount: number) => formatCurrency(amount, trip.currency)

  const value: TripContextValue = {
    trip,
    tripId: trip.id,
    editable,
    unlockInput,
    setUnlockInput,
    codeError,
    verifying,
    unlock,
    lock,
    formatMoney,
  }

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}