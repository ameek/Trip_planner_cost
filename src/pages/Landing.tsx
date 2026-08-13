import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import { SegmentToggle } from '../components/SegmentToggle'
import { TrailmarkMark } from '../components/brand'
import type { SplitMode } from '../lib/types'

export default function Landing() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [splitMode, setSplitMode] = useState<SplitMode>('even')
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setErr('Name the trip first.')
      return
    }
    if (!/^\d{4}$/.test(code)) {
      setErr('The edit code must be exactly 4 digits.')
      return
    }
    setErr(null)
    setCreating(true)
    try {
      const { shortId } = await api.createTrip({
        name: name.trim(),
        split_mode: splitMode,
        edit_code: code,
      })
      sessionStorage.setItem(api.lockKey(shortId), '1')
      navigate(`/t/${shortId}`, { state: { justCreated: true } })
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : 'Could not create the trip.')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5">
            <TrailmarkMark />
            <span className="font-display text-3xl font-black tracking-tight text-pine">
              Trailmark
            </span>
          </div>
          <p className="mt-2 font-mono text-sm text-moss">
            Trip plans & shared ledgers for small groups
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="card mt-8 border-clay/40 bg-clay/5 p-4">
            <div className="eyebrow">Setup needed</div>
            <p className="mt-2 text-sm text-ink">
              Supabase isn't connected yet. Create a project, run{' '}
              <code className="font-mono">supabase/schema.sql</code>, then add{' '}
              <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to a{' '}
              <code className="font-mono">.env</code> file and restart the dev server.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="card mt-8 p-5">
          <h2 className="font-display text-xl font-bold text-pine">Start a trip</h2>
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
              <label className="field-label">How are costs split?</label>
              <SegmentToggle<SplitMode>
                value={splitMode}
                onChange={setSplitMode}
                options={[
                  { value: 'even', label: 'Even split' },
                  { value: 'fixed', label: 'Fixed contribution' },
                ]}
              />
              <p className="mt-1.5 text-xs text-moss">
                {splitMode === 'even'
                  ? 'Every expense is divided equally among the people it applies to.'
                  : 'Each member has a set contribution, and the ledger tracks what they have paid against it.'}
              </p>
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
              <p className="mt-1.5 text-xs text-moss">
                Anyone with the link can view. This 4-digit code unlocks editing.
              </p>
            </div>
            {err && <p className="font-mono text-sm text-clay">{err}</p>}
            <button className="btn btn-primary w-full py-2.5" disabled={creating}>
              {creating ? 'Creating…' : 'Create trip'}
            </button>
          </div>
        </form>

        <div className="card mt-4 p-4">
          <h3 className="font-display text-lg font-bold text-pine">How it works</h3>
          <ol className="mt-2 space-y-1.5 font-mono text-xs text-moss">
            <li>1 · Share the link — everyone can read the plan and ledger.</li>
            <li>2 · The 4-digit code unlocks editing for the session.</li>
            <li>3 · Plot days, add members and expenses — Settle Up does the math.</li>
          </ol>
        </div>
      </main>
    </div>
  )
}