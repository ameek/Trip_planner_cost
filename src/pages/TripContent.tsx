import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTrip } from '../lib/TripContext'
import { useIsOnline } from '../lib/queries'
import { useSyncCounts } from '../lib/ledgerMutations'
import type { TabKey } from '../lib/types'
import { LockIcon, LockOpenIcon } from '../components/brand'
import PlanTab from './PlanTab'
import LedgerTab from './LedgerTab'
import MembersTab from './MembersTab'
import SettleTab from './SettleTab'

import { setLastActiveTrip } from './Landing'

const SHARE_URL = (shortId: string) => `${window.location.origin}/t/${shortId}`

export default function TripContent() {
  const { shortId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    trip,
    editable,
    verifying,
    codeError,
    unlockInput,
    setUnlockInput,
    unlock,
    lock,
  } = useTrip()
  const online = useIsOnline()
  const { paused, syncing } = useSyncCounts()
  const [tab, setTab] = useState<TabKey>('plan')
  const [justCreated, setJustCreated] = useState(false)
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    if (trip?.short_id) {
      setLastActiveTrip(trip.short_id, trip.name)
    }
  }, [trip?.short_id, trip?.name])

  useEffect(() => {
    const state = location.state as { justCreated?: boolean } | null
    if (state?.justCreated) {
      setJustCreated(true)
      navigate(location.pathname, { replace: true })
    }
  }, [location, navigate])

  useEffect(() => {
    document.title = `${trip.name} · Trailmark`
  }, [trip.name])

  const pill =
    paused > 0
      ? { text: `Offline — ${paused} queued`, cls: 'text-clay border-clay/40 bg-clay/5', dot: 'bg-clay' }
      : syncing > 0
        ? { text: 'Syncing…', cls: 'text-dusk border-dusk/40 bg-dusk/5', dot: 'bg-dusk' }
        : online
          ? { text: 'Online', cls: 'text-moss border-line bg-paper', dot: 'bg-moss' }
          : { text: 'Offline', cls: 'text-clay border-clay/40 bg-clay/5', dot: 'bg-clay' }

  return (
    <div className="min-h-screen bg-sand">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/?select=1"
                title="View all tours"
                className="flex items-center gap-1.5 rounded-lg border border-line bg-sand/60 px-2.5 py-1.5 font-mono text-xs font-medium text-moss transition-colors hover:border-pine hover:text-pine hover:bg-sand shrink-0"
              >
                <span>←</span>
                <span className="hidden sm:inline">All Trips</span>
                <span className="sm:hidden">Trips</span>
              </Link>
              <div className="min-w-0">
                <div className="eyebrow text-[10px]">/t/{shortId}</div>
                <h1 className="mt-0.5 truncate font-display text-xl sm:text-2xl font-bold leading-tight text-pine">
                  {trip.name}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${pill.cls}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                {pill.text}
              </span>
              {editable ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-pine px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-paper">
                    <LockOpenIcon /> editing
                  </span>
                  <button className="btn btn-ghost py-1 text-xs" onClick={lock}>Lock</button>
                </div>
              ) : showCode ? (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void unlock()
                  }}
                >
                  <input
                    className="input w-20 text-center font-mono tracking-[0.3em] py-1 text-xs"
                    inputMode="numeric"
                    autoFocus
                    maxLength={4}
                    placeholder="····"
                    value={unlockInput}
                    onChange={(e) => setUnlockInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  />
                  <button className="btn btn-primary py-1 text-xs" disabled={verifying}>
                    {verifying ? '…' : 'Unlock'}
                  </button>
                  <button type="button" className="btn btn-ghost py-1 text-xs" onClick={() => setShowCode(false)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button className="btn btn-ghost flex items-center gap-1.5 py-1 text-xs" onClick={() => setShowCode(true)}>
                  <LockIcon /> Unlock editing
                </button>
              )}
            </div>
          </div>
          {codeError && <p className="mt-1.5 font-mono text-xs text-clay">{codeError}</p>}
        </div>
      </header>
      <nav className="mx-auto max-w-3xl px-4">
        <div className="flex gap-1 overflow-x-auto">
          {(['plan', 'ledger', 'members', 'settle'] as TabKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`whitespace-nowrap border-b-2 px-3 pb-2 pt-3 font-mono text-xs uppercase tracking-wider transition-colors ${tab === k ? 'border-pine text-pine' : 'border-transparent text-moss hover:text-ink'}`}
            >
              {k}
            </button>
          ))}
        </div>
      </nav>

      {justCreated && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="card border-clay/40 bg-clay/5 p-4">
            <p className="text-sm text-ink">
              This trip is ready to share. Send the link and the edit code to your group.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-sm text-moss">{shortId && SHARE_URL(shortId)}</code>
              <button
                className="btn btn-ghost px-2 py-1 text-xs"
                onClick={() => {
                  if (!shortId) return
                  void navigator.clipboard?.writeText(SHARE_URL(shortId))
                }}
              >
                Copy link
              </button>
            </div>
            <div className="mt-3">
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setJustCreated(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {tab === 'plan' && <PlanTab />}
        {tab === 'ledger' && <LedgerTab />}
        {tab === 'members' && <MembersTab />}
        {tab === 'settle' && <SettleTab />}
      </main>
    </div>
  )
}