import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTrip } from '../lib/TripContext'
import {
  useAddMember,
  useAddTag,
  useDeleteMember,
  useDeleteTag,
  useMembers,
  useSetContribution,
  useTags,
} from '../lib/queries'
import type { Member } from '../lib/types'
import { EmptyState } from '../components/EmptyState'

export default function MembersTab() {
  const { tripId, editable, formatMoney } = useTrip()
  const { data: members = [] } = useMembers(tripId)
  const { data: tags = [] } = useTags(tripId)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [tagLabel, setTagLabel] = useState('')

  const addMember = useAddMember(tripId)
  const deleteMember = useDeleteMember(tripId)
  const addTag = useAddTag(tripId)
  const deleteTag = useDeleteTag(tripId)

  function handleMemberSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Give the member a name.')
      return
    }
    setNameError(null)
    addMember.mutate(name)
    setName('')
  }

  function handleTagSubmit(e: FormEvent) {
    e.preventDefault()
    const label = tagLabel.trim()
    if (!label) return
    addTag.mutate(label)
    setTagLabel('')
  }

  const evenCount = members.filter((m) => m.fixed_contribution == null).length

  return (
    <div>
      <div className="card p-4">
        <h3 className="font-display text-lg font-bold text-pine">How contributions work</h3>
        <p className="mt-2 text-sm text-moss">
          Members with no fixed amount split the remaining costs evenly with the other unset members. A
          member with a <span className="font-semibold text-ink">fixed amount</span> agrees to pay exactly that
          — the ledger tracks what they've paid toward it.
        </p>
        <p className="mt-2 font-mono text-xs text-moss">
          {evenCount > 0
            ? `${evenCount} ${evenCount === 1 ? 'member splits' : 'members split'} the remainder evenly.`
            : 'Everyone has a fixed contribution — no even splitting.'}
        </p>
      </div>

      {editable && (
        <form onSubmit={handleMemberSubmit} className="card mt-4 p-4">
          <h3 className="font-display text-lg font-bold text-pine">Add a member</h3>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <label className="field-label">Name</label>
              <input className="input" placeholder="e.g. Priya" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button className="btn btn-primary">Add member</button>
          </div>
          {nameError && <p className="mt-2 font-mono text-xs text-clay">{nameError}</p>}
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
            <MemberRow
              key={m.id}
              member={m}
              editable={editable}
              formatMoney={formatMoney}
              onDelete={() => deleteMember.mutate(m.id)}
            />
          ))}
        </ul>
      )}

      <div className="card mt-6 p-4">
        <h3 className="font-display text-lg font-bold text-pine">Tags & vehicles</h3>
        <p className="mt-1 text-sm text-moss">
          Tag expenses to a vehicle or subgroup for labelling and filters. Tags never change the settlement
          math.
        </p>
        {editable && (
          <form onSubmit={handleTagSubmit} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <label className="field-label">Tag label</label>
              <input className="input" placeholder="e.g. Bike A" value={tagLabel} onChange={(e) => setTagLabel(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={!tagLabel.trim()}>Add tag</button>
          </form>
        )}
        {tags.length === 0 ? (
          <p className="mt-3 font-mono text-xs text-moss">No tags yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t.id} className="chip">
                {t.label}
                {editable && (
                  <button type="button" className="ml-1 text-clay hover:text-ink" title="Delete tag" onClick={() => deleteTag.mutate(t.id)}>
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member,
  editable,
  formatMoney,
  onDelete,
}: {
  member: Member
  editable: boolean
  formatMoney: (n: number) => string
  onDelete: () => void
}) {
  const { tripId } = useTrip()
  const setContribution = useSetContribution(tripId)
  const fixed = member.fixed_contribution != null
  const [amountText, setAmountText] = useState(member.fixed_contribution == null ? '' : String(member.fixed_contribution))
  const [saved, setSaved] = useState(false)

  function commitAmount() {
    const n = parseFloat(amountText)
    if (!Number.isFinite(n) || n < 0) {
      setAmountText(member.fixed_contribution == null ? '' : String(member.fixed_contribution))
      return
    }
    if (n === member.fixed_contribution) return
    setContribution.mutate({ memberId: member.id, contribution: n })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1200)
  }

  return (
    <li className="card flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${fixed ? 'bg-dusk' : 'bg-moss'}`} />
        <span className={`truncate ${fixed ? 'font-medium text-ink' : 'font-medium text-pine'}`}>{member.name}</span>
        <span className="hidden font-mono text-[10px] uppercase tracking-wide text-moss sm:inline">
          {fixed ? 'fixed contribution' : 'even split'}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {editable && (
          <div className="inline-flex rounded-[3px] border border-line bg-paper p-0.5">
            <button
              type="button"
              className={`rounded-[2px] px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide transition-colors ${!fixed ? 'bg-pine text-paper' : 'text-moss hover:text-ink'}`}
              onClick={() => setContribution.mutate({ memberId: member.id, contribution: null })}
            >
              Even
            </button>
            <button
              type="button"
              className={`rounded-[2px] px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide transition-colors ${fixed ? 'bg-pine text-paper' : 'text-moss hover:text-ink'}`}
              onClick={() => {
                if (member.fixed_contribution != null) return
                setContribution.mutate({ memberId: member.id, contribution: 0 })
                setAmountText('0')
                setSaved(true)
                window.setTimeout(() => setSaved(false), 1200)
              }}
            >
              Fixed
            </button>
          </div>
        )}
        {fixed && editable && (
          <div className="flex items-center gap-1.5">
            <input
              className="input w-24 text-right font-mono"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={commitAmount}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
            {saved && <span className="font-mono text-[10px] text-moss">saved</span>}
          </div>
        )}
        {fixed && !editable && (
          <span className="font-mono text-sm tabular-nums text-moss">{formatMoney(member.fixed_contribution ?? 0)}</span>
        )}
        {editable && (
          <button className="icon-btn danger" title="Remove member" onClick={onDelete}>✕</button>
        )}
      </div>
    </li>
  )
}