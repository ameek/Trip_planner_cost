import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTrip } from '../lib/TripContext'
import { useIsOnline } from '../lib/queries'
import { useSyncCounts } from '../lib/ledgerMutations'
import type { TabKey } from '../lib/types'
import { LockIcon, LockOpenIcon } from '../components/brand'
import PlanTab from './PlanTab'
import LedgerTab from './LedgerTab'
import MembersTab from './MembersTab'
import SettleTab from './SettleTab'

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
      <header className="border-b border-line bg-paper/70">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow">Trailmark · /t/{shortId}</div>
              <h1 className="mt-1 truncate font-display text-2xl font-bold leading-tight text-pine">{trip.name}</h1>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide ${pill.cls}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                {pill.text}
              </span>
              {editable ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-pine px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-paper">
                    <LockOpenIcon /> editing
                  </span>
                  <button className="btn btn-ghost py-1.5 text-xs" onClick={lock}>Lock</button>
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
                    className="input w-20 text-center font-mono tracking-[0.3em]"
                    inputMode="numeric"
                    autoFocus
                    maxLength={4}
                    placeholder="····"
                    value={unlockInput}
                    onChange={(e) => setUnlockInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  />
                  <button className="btn btn-primary py-1.5 text-xs" disabled={verifying}>
                    {verifying ? '…' : 'Unlock'}
                  </button>
                  <button type="button" className="btn btn-ghost py-1.5 text-xs" onClick={() => setShowCode(false)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button className="btn btn-ghost flex items-center gap-1.5 py-1.5 text-xs" onClick={() => setShowCode(true)}>
                  <LockIcon /> Unlock editing
                </button>
              )}
            </div>
          </div>
          {codeError && <p className="mt-2 font-mono text-xs text-clay">{codeError}</p>}
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