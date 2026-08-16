import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TrailmarkMark } from '../components/brand'
import * as api from '../lib/api'
import { formatRelativeTime } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'

export interface RecentTrip {
  shortId: string
  name?: string
  visitedAt: number
}

export const RECENT_TRIPS_KEY = 'trailmark:recent_trips'
export const LAST_ACTIVE_TRIP_KEY = 'trailmark:last_active_trip'

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

export function getLastActiveTrip(): RecentTrip | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_TRIP_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
    const recents = getRecentTrips()
    return recents.length > 0 ? recents[0] : null
  } catch {
    return null
  }
}

export function setLastActiveTrip(shortId: string, name?: string) {
  try {
    if (!shortId) return
    const cleanId = shortId.trim().toLowerCase()
    const tripObj: RecentTrip = {
      shortId: cleanId,
      name: name || `Trip ${cleanId}`,
      visitedAt: Date.now(),
    }
    localStorage.setItem(LAST_ACTIVE_TRIP_KEY, JSON.stringify(tripObj))
    saveRecentTrip(cleanId, name)
  } catch {
    // ignore
  }
}

export function getRecentTrips(): RecentTrip[] {
  try {
    const raw = localStorage.getItem(RECENT_TRIPS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecentTrip(shortId: string, name?: string) {
  try {
    if (!shortId) return
    const cleanId = shortId.trim().toLowerCase()
    const existing = getRecentTrips().filter((t) => t.shortId !== cleanId)
    const updated = [{ shortId: cleanId, name: name || `Trip ${cleanId}`, visitedAt: Date.now() }, ...existing].slice(0, 10)
    localStorage.setItem(RECENT_TRIPS_KEY, JSON.stringify(updated))
  } catch {
    // ignore storage errors
  }
}

export function removeRecentTrip(shortId: string) {
  try {
    const cleanId = shortId.trim().toLowerCase()
    const updated = getRecentTrips().filter((t) => t.shortId !== cleanId)
    localStorage.setItem(RECENT_TRIPS_KEY, JSON.stringify(updated))
    const last = getLastActiveTrip()
    if (last && last.shortId === cleanId) {
      if (updated.length > 0) {
        localStorage.setItem(LAST_ACTIVE_TRIP_KEY, JSON.stringify(updated[0]))
      } else {
        localStorage.removeItem(LAST_ACTIVE_TRIP_KEY)
      }
    }
  } catch {
    // ignore
  }
}

export default function Landing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSelectMode = searchParams.get('select') === '1' || searchParams.get('switch') === '1'

  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join')

  // Join trip state
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  // Create trip state
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Recent & last trips state
  const [lastTrip, setLastTrip] = useState<RecentTrip | null>(null)
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([])

  useEffect(() => {
    const last = getLastActiveTrip()
    const recents = getRecentTrips()
    setLastTrip(last)
    setRecentTrips(recents)

    // In PWA standalone mode, auto-resume active trip unless user clicked 'All Trips'
    if (!isSelectMode && isPwaStandalone() && last?.shortId) {
      navigate(`/t/${last.shortId}`, { replace: true })
    }
  }, [isSelectMode, navigate])

  function handleJoinSubmit(e: FormEvent) {
    e.preventDefault()
    let cleaned = joinInput.trim()
    if (!cleaned) {
      setJoinError('Please enter a trip code or URL.')
      return
    }

    // Extract short code if user pasted a full URL (e.g. https://domain.com/t/x7k2qa)
    if (cleaned.includes('/t/')) {
      const parts = cleaned.split('/t/')
      cleaned = parts[1].split('/')[0].split('?')[0]
    }

    // Clean special characters
    cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

    if (!cleaned) {
      setJoinError('Invalid trip code format.')
      return
    }

    setJoinError(null)
    setLastActiveTrip(cleaned)
    navigate(`/t/${cleaned}`)
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setCreateError('Name the trip first.')
      return
    }
    if (!/^\d{4}$/.test(code)) {
      setCreateError('The edit code must be exactly 4 digits.')
      return
    }
    setCreateError(null)
    setCreating(true)
    try {
      const { shortId } = await api.createTrip(name, code)
      setLastActiveTrip(shortId, name.trim())
      navigate(`/t/${shortId}`, { state: { justCreated: true } })
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : 'Could not create the trip.')
      setCreating(false)
    }
  }

  function handleRemoveTrip(e: React.MouseEvent, shortId: string) {
    e.stopPropagation()
    removeRecentTrip(shortId)
    setRecentTrips(getRecentTrips())
    setLastTrip(getLastActiveTrip())
  }

  return (
    <div className="min-h-screen bg-sand">
      <main className="mx-auto max-w-xl px-4 py-10 sm:py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5">
            <TrailmarkMark />
            <span className="font-display text-3xl font-black tracking-tight text-pine">Trailmark</span>
          </div>
          <p className="mt-2 font-mono text-sm text-moss">Trip plans & shared ledgers for small groups — works offline</p>
        </div>

        {/* Hero Card: Resume Last Tour (Quick 1-tap access) */}
        {lastTrip && (
          <div
            onClick={() => navigate(`/t/${lastTrip.shortId}`)}
            className="group card mt-6 cursor-pointer border-pine/30 bg-paper p-5 shadow-sm transition-all hover:border-pine hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-pine">
                <span className="inline-block h-2 w-2 rounded-full bg-pine animate-pulse" />
                Resume Last Tour
              </span>
              <span className="font-mono text-[11px] text-moss">
                {formatRelativeTime(lastTrip.visitedAt)}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-xl font-bold text-pine group-hover:text-pine-light transition-colors">
                  {lastTrip.name || `Trip ${lastTrip.shortId}`}
                </h3>
                <p className="font-mono text-xs text-moss">Code: /t/{lastTrip.shortId}</p>
              </div>
              <button
                type="button"
                className="btn btn-primary shrink-0 px-4 py-2 text-xs font-mono uppercase tracking-wider"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/t/${lastTrip.shortId}`)
                }}
              >
                Open Tour →
              </button>
            </div>
          </div>
        )}

        {/* Tab Switcher: Join existing trip OR Start a new trip */}
        <div className="mt-6 rounded-xl bg-sand-dark/30 p-1.5 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              className={`rounded-lg py-2 text-center font-display text-sm font-bold transition-all ${
                activeTab === 'join'
                  ? 'bg-paper text-pine shadow-sm'
                  : 'text-moss hover:text-pine'
              }`}
              onClick={() => setActiveTab('join')}
            >
              🔑 Enter Trip Code
            </button>
            <button
              type="button"
              className={`rounded-lg py-2 text-center font-display text-sm font-bold transition-all ${
                activeTab === 'create'
                  ? 'bg-paper text-pine shadow-sm'
                  : 'text-moss hover:text-pine'
              }`}
              onClick={() => setActiveTab('create')}
            >
              ✨ Start New Trip
            </button>
          </div>
        </div>

        {activeTab === 'join' ? (
          <form onSubmit={handleJoinSubmit} className="card mt-4 p-5">
            <h2 className="font-display text-xl font-bold text-pine">Go to a trip</h2>
            <p className="mt-1 text-xs text-moss">
              Enter the trip code (e.g. <code className="font-mono bg-sand px-1 py-0.5 rounded">rh9gmf</code>) or paste the full trip link.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="field-label">Trip code or link</label>
                <input
                  className="input font-mono text-base tracking-wider"
                  placeholder="e.g. rh9gmf or https://.../t/rh9gmf"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  autoFocus
                />
              </div>
              {joinError && <p className="font-mono text-sm text-clay">{joinError}</p>}
              <button className="btn btn-primary w-full py-2.5">
                Go to trip →
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateSubmit} className="card mt-4 p-5">
            <h2 className="font-display text-xl font-bold text-pine">Start a new trip</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="field-label">Trip name</label>
                <input
                  className="input"
                  placeholder="e.g. Sundarbans, Dec '26"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Edit code</label>
                <input
                  className="input text-center font-mono tracking-[0.4em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="····"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                />
                <p className="mt-1.5 text-xs text-moss">Anyone with the link can view. This 4-digit code unlocks editing.</p>
              </div>
              {createError && <p className="font-mono text-sm text-clay">{createError}</p>}
              <button className="btn btn-primary w-full py-2.5" disabled={creating}>
                {creating ? 'Creating…' : 'Create trip'}
              </button>
            </div>
          </form>
        )}

        {/* Recent Trips Section */}
        {recentTrips.length > 0 && (
          <div className="card mt-4 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-pine">
                Recent Tours on this device
              </h3>
              <span className="font-mono text-[11px] text-moss">{recentTrips.length} saved</span>
            </div>
            <ul className="mt-3 divide-y divide-sand-dark">
              {recentTrips.map((rt) => (
                <li
                  key={rt.shortId}
                  onClick={() => navigate(`/t/${rt.shortId}`)}
                  className="group flex cursor-pointer items-center justify-between py-2.5 transition-colors hover:bg-sand-light/40 rounded px-1.5"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-sm font-semibold text-pine group-hover:text-pine-light">
                        {rt.name || `Trip ${rt.shortId}`}
                      </span>
                      <span className="rounded bg-sand px-1.5 py-0.5 font-mono text-[10px] uppercase text-moss">
                        {rt.shortId}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-moss">
                      Visited {formatRelativeTime(rt.visitedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      className="btn btn-ghost py-1 px-2 text-xs font-mono text-moss hover:text-pine"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/t/${rt.shortId}`)
                      }}
                    >
                      Open →
                    </button>
                    <button
                      type="button"
                      title="Remove from recent trips"
                      className="rounded p-1 text-xs text-moss/60 hover:bg-clay/10 hover:text-clay transition-colors"
                      onClick={(e) => handleRemoveTrip(e, rt.shortId)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card mt-4 p-4">
          <h3 className="font-display text-lg font-bold text-pine">How it works</h3>
          <ol className="mt-2 space-y-1.5 font-mono text-xs text-moss">
            <li>1 · Enter a trip code above or create a new trip to get started.</li>
            <li>2 · Share the link or trip code with your group.</li>
            <li>3 · The 4-digit code unlocks editing and works offline.</li>
            <li>4 · Works offline — changes queue and sync when signal returns.</li>
          </ol>
        </div>

        {!isSupabaseConfigured && (
          <div className="card mt-4 border-clay/40 bg-clay/5 p-4">
            <div className="eyebrow">Setup needed</div>
            <p className="mt-2 text-sm text-ink">
              Supabase isn't connected yet. Create a project, run <code className="font-mono">supabase/schema.sql</code>,
              then add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to a <code className="font-mono">.env</code> file and
              restart the dev server.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}