import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useTrip } from '../lib/TripContext'
import * as api from '../lib/api'
import { SegmentToggle } from '../components/SegmentToggle'
import { EmptyState } from '../components/EmptyState'
import type { Member, SplitMode } from '../lib/types'

export default function MembersTab() {
  const { trip, members, editable, formatMoney, mutate, refresh } = useTrip()
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [target, setTarget] = useTripTarget(trip.short_id)
  const [targetInput, setTargetInput] = useState(target == null ? '' : String(target))

  const totalContribution = members.reduce((sum, m) => sum + (m.fixed_contribution ?? 0), 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setErr('Give the member a name.')
      return
    }
    setErr(null)
    const ok = await mutate(async () => {
      await api.addMember(trip.id, name)
      await refresh()
    })
    if (ok) setName('')
  }

  async function removeMember(member: Member) {
    await mutate(async () => {
      await api.deleteMember(trip.id, member.id)
      await refresh()
    })
  }

  async function switchMode(mode: SplitMode) {
    if (mode === trip.split_mode) return
    await mutate(async () => {
      await api.updateTripSplitMode(trip.id, mode)
      await refresh()
    })
  }

  function commitTarget() {
    const trimmed = targetInput.trim()
    if (trimmed === '') {
      setTarget(null)
      setTargetInput('')
      return
    }
    const n = parseFloat(trimmed)
    if (!Number.isFinite(n) || n < 0) {
      setTargetInput(target == null ? '' : String(target))
      return
    }
    setTarget(n)
  }

  const remaining = target == null ? null : target - totalContribution

  return (
    <div>
      <div className="card p-4">
        <h3 className="font-display text-lg font-bold text-pine">How costs are split</h3>
        <div className="mt-3">
          <SegmentToggle<SplitMode>
            value={trip.split_mode}
            disabled={!editable}
            onChange={(v) => void switchMode(v)}
            options={[
              { value: 'even', label: 'Even split' },
              { value: 'fixed', label: 'Fixed contribution' },
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-moss">
          {trip.split_mode === 'even'
            ? 'Every expense is divided equally among the members it applies to.'
            : 'Each member has a set contribution, and the ledger tracks what everyone has paid against that number.'}
        </p>
      </div>

      {trip.split_mode === 'fixed' && (
        <div className="card mt-4 p-4">
          <h3 className="font-display text-lg font-bold text-pine">Contribution target</h3>
          <p className="mt-1 text-sm text-moss">The total the group is aiming to cover.</p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div>
              <label className="field-label">Sum of contributions</label>
              <div className="font-mono text-xl tabular-nums text-pine">
                {formatMoney(totalContribution)}
              </div>
            </div>
            <div>
              <label className="field-label">Trip target</label>
              {editable ? (
                <input
                  className="input w-36 font-mono"
                  inputMode="decimal"
                  placeholder="0"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  onBlur={commitTarget}
                />
              ) : (
                <div className="font-mono text-xl tabular-nums">
                  {target == null ? '—' : formatMoney(target)}
                </div>
              )}
            </div>
            <div>
              <label className="field-label">Remaining</label>
              <div
                className={`font-mono text-xl tabular-nums ${remaining != null && remaining > 0 ? 'text-clay' : 'text-moss'}`}
              >
                {remaining == null ? '—' : formatMoney(remaining)}
              </div>
            </div>
          </div>
        </div>
      )}

      {editable && (
        <form onSubmit={submit} className="card mt-4 p-4">
          <h3 className="font-display text-lg font-bold text-pine">Add a member</h3>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <label className="field-label">Name</label>
              <input
                className="input"
                placeholder="e.g. Priya"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button className="btn btn-primary">Add member</button>
          </div>
          {err && <p className="mt-2 font-mono text-xs text-clay">{err}</p>}
        </form>
      )}

      {members.length === 0 ? (
        <EmptyState
          title="No members yet"
          body={editable ? 'Add everyone going on the trip.' : 'No members have been added to this trip yet.'}
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="card flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-moss" />
                <span className="truncate font-medium text-ink">{m.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {trip.split_mode === 'fixed' && editable && <ContributionInput member={m} />}
                {trip.split_mode === 'fixed' && !editable && m.fixed_contribution != null && (
                  <span className="font-mono text-sm tabular-nums text-moss">
                    {formatMoney(m.fixed_contribution)}
                  </span>
                )}
                {editable && (
                  <button
                    className="icon-btn danger"
                    title="Remove member"
                    onClick={() => void removeMember(m)}
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ContributionInput({ member }: { member: Member }) {
  const { mutate, refresh } = useTrip()
  const [val, setVal] = useState(
    member.fixed_contribution == null ? '' : String(member.fixed_contribution),
  )

  function commit() {
    const trimmed = val.trim()
    if (trimmed === '') {
      void mutate(async () => {
        await api.updateMemberContribution(member.id, null)
        await refresh()
      })
      return
    }
    const n = parseFloat(trimmed)
    if (!Number.isFinite(n) || n < 0) {
      setVal(member.fixed_contribution == null ? '' : String(member.fixed_contribution))
      return
    }
    if (n === (member.fixed_contribution ?? 0)) return
    void mutate(async () => {
      await api.updateMemberContribution(member.id, n)
      await refresh()
    })
  }

  return (
    <input
      className="input w-24 text-right font-mono"
      inputMode="decimal"
      placeholder="0"
      value={val}
      onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

function useTripTarget(shortId: string) {
  const key = `trailmark:target:${shortId}`
  const [target, setTargetState] = useState<number | null>(() => {
    const raw = localStorage.getItem(key)
    if (raw == null) return null
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : null
  })
  const setTarget = useCallback(
    (n: number | null) => {
      setTargetState(n)
      if (n == null) localStorage.removeItem(key)
      else localStorage.setItem(key, String(n))
    },
    [key],
  )
  return [target, setTarget] as const
}