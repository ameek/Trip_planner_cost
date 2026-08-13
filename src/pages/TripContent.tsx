import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTrip } from '../lib/TripContext'
import { LockIcon, LockOpenIcon } from '../components/brand'
import type { TabKey } from '../lib/types'
import PlanTab from './PlanTab'
import LedgerTab from './LedgerTab'
import MembersTab from './MembersTab'
import SettleTab from './SettleTab'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'plan', label: 'Plan' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'members', label: 'Members' },
  { key: 'settle', label: 'Settle' },
]

export default function TripContent() {
  const {
    trip,
    editable,
    error,
    clearError,
    unlockInput,
    setUnlockInput,
    codeError,
    verifying,
    unlock,
    lock,
  } = useTrip()
  const { shortId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('plan')
  const [banner, setBanner] = useState(false)
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    const state = location.state as { justCreated?: boolean } | null
    if (state?.justCreated) {
      setBanner(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    document.title = `${trip.name} · Trailmark`
  }, [trip.name])

  const shareUrl = `${window.location.origin}/t/${shortId}`

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-line bg-paper/70">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow">Trailmark · /t/{shortId}</div>
              <h1 className="mt-1 truncate font-display text-2xl font-bold leading-tight text-pine">
                {trip.name}
              </h1>
            </div>
            <div className="shrink-0">
              {editable ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pine px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-paper">
                    <LockOpenIcon /> editing
                  </span>
                  <button className="btn btn-ghost py-1.5 text-xs" onClick={lock}>
                    Lock
                  </button>
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
                    autoComplete="off"
                    maxLength={4}
                    placeholder="····"
                    value={unlockInput}
                    onChange={(e) =>
                      setUnlockInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))
                    }
                    autoFocus
                  />
                  <button className="btn btn-primary py-1.5 text-xs" disabled={verifying}>
                    {verifying ? '…' : 'Unlock'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1.5 text-xs"
                    onClick={() => setShowCode(false)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button className="btn btn-ghost py-1.5 text-xs" onClick={() => setShowCode(true)}>
                  <LockIcon /> Unlock editing
                </button>
              )}
            </div>
          </div>
          {codeError && <p className="mt-2 font-mono text-xs text-clay">{codeError}</p>}
        </div>
        <nav className="mx-auto max-w-3xl px-4">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap border-b-2 px-3 pb-2 pt-1 font-mono text-xs uppercase tracking-wider transition-colors ${tab === t.key ? 'border-pine text-pine' : 'border-transparent text-moss hover:text-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {banner && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="card border-clay/40 bg-clay/5 p-4">
            <p className="text-sm text-ink">
              This trip is ready to share. Send the link and the code{' '}
              <span className="font-mono font-bold text-clay">••••</span> to your group.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-sm text-moss">{shareUrl}</code>
              <button
                className="btn btn-ghost px-2 py-1 text-xs"
                onClick={() => {
                  void navigator.clipboard?.writeText(shareUrl)
                }}
              >
                Copy link
              </button>
            </div>
            <button className="btn btn-ghost mt-3 px-2 py-1 text-xs" onClick={() => setBanner(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="card flex items-center justify-between gap-3 border-clay/40 p-3">
            <p className="font-mono text-xs text-clay">{error}</p>
            <button className="btn btn-ghost px-2 py-1 text-xs" onClick={clearError}>
              Dismiss
            </button>
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