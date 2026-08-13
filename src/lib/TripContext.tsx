import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
  const tripQuery = useTripQuery(shortId)
  const [editable, setEditable] = useState(() => sessionStorage.getItem(api.lockKey(shortId)) === '1')
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
        sessionStorage.setItem(api.lockKey(shortId), '1')
        setEditable(true)
        setUnlockInput('')
      } else {
        setCodeError("That code didn't match. Try again.")
      }
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Could not verify the code.')
    } finally {
      setVerifying(false)
    }
  }, [shortId, unlockInput])

  const lock = useCallback(() => {
    sessionStorage.removeItem(api.lockKey(shortId))
    setEditable(false)
    setUnlockInput('')
    setCodeError(null)
  }, [shortId])

  if (tripQuery.isLoading) {
    return (
      <div className="min-h-screen bg-sand">
        <div className="mx-auto max-w-3xl px-4 pt-20 text-center">
          <p className="font-mono text-sm text-moss">Loading the trip…</p>
        </div>
      </div>
    )
  }

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
            <Link to="/" className="btn btn-primary mt-5 inline-flex">
              Back to start
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const trip = tripQuery.data

  if (!trip) {
    return (
      <div className="min-h-screen bg-sand">
        <div className="mx-auto max-w-3xl px-4 pt-20">
          <div className="card p-6 text-center">
            <div className="eyebrow">Trailmark</div>
            <h1 className="mt-2 font-display text-2xl font-bold text-pine">Trip not found</h1>
            <p className="mt-2 text-sm text-moss">
              Check that the link is correct, or ask whoever shared it for a fresh one.
            </p>
            <Link to="/" className="btn btn-primary mt-5 inline-flex">
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