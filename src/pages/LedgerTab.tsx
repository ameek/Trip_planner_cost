import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTrip } from '../lib/TripContext'
import * as api from '../lib/api'
import { CATEGORIES, CATEGORY_LABELS } from '../lib/types'
import type { Category, LedgerEntry } from '../lib/types'
import { EmptyState } from '../components/EmptyState'

export default function LedgerTab() {
  const { entries, members, editable, formatMoney, mutate, refresh } = useTrip()
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!editable) setEditingId(null)
  }, [editable])

  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  const memberName = (id: string | null) => {
    if (!id) return '—'
    return members.find((m) => m.id === id)?.name ?? '—'
  }
  const categoryName = (c: Category | null) => (c ? CATEGORY_LABELS[c] : '—')

  async function removeEntry(entryId: string) {
    await mutate(async () => {
      await api.deleteEntry(entryId)
      await refresh()
    })
  }

  return (
    <div>
      {editable && members.length === 0 && (
        <p className="mb-4 font-mono text-sm text-clay">
          Add members first — an expense needs someone to pay for it.
        </p>
      )}
      {editable && members.length > 0 && <AddEntryForm />}

      {sorted.length === 0 ? (
        <EmptyState
          title="The ledger is quiet"
          body={editable ? 'Add the first expense when you spend something.' : 'No expenses logged yet.'}
        />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="ticket-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Paid by</th>
                <th>Split</th>
                <th className="text-right">Amount</th>
                {editable && <th className="text-right">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) =>
                editingId === entry.id ? (
                  <tr key={entry.id}>
                    <td colSpan={5} className="border-t-0 p-0">
                      <EditEntryForm entry={entry} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id}>
                    <td>
                      <div className="font-medium text-ink">{entry.description}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-moss">
                        {categoryName(entry.category)}
                      </div>
                    </td>
                    <td className="text-ink">{memberName(entry.paid_by)}</td>
                    <td>
                      {entry.split_between.length === 0 ? (
                        <span className="chip">everyone</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {entry.split_between.map((id) => (
                            <span key={id} className="chip">
                              {memberName(id)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="num font-medium text-pine">{formatMoney(entry.amount)}</td>
                    {editable && (
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn btn-ghost px-2 py-1 text-xs"
                            onClick={() => setEditingId(entry.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="icon-btn danger"
                            title="Delete entry"
                            onClick={() => void removeEntry(entry.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="total">
                <td colSpan={3}>Total</td>
                <td className="num">{formatMoney(total)}</td>
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function AddEntryForm() {
  const { trip, members, mutate, refresh } = useTrip()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(() => members[0]?.id ?? '')
  const [category, setCategory] = useState<Category | ''>('')
  const [split, setSplit] = useState<string[]>(() => members.map((m) => m.id))
  const [err, setErr] = useState<string | null>(null)

  const allSelected = members.length > 0 && split.length === members.length

  function toggleMember(id: string) {
    setSplit((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!description.trim()) {
      setErr('Give the expense a description.')
      return
    }
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount greater than zero.')
      return
    }
    if (!paidBy) {
      setErr('Choose who paid for it.')
      return
    }
    setErr(null)
    const ok = await mutate(async () => {
      await api.addEntry(trip.id, {
        description: description.trim(),
        amount: amt,
        paid_by: paidBy,
        category: category === '' ? null : category,
        split_between: allSelected ? [] : split,
      })
      await refresh()
    })
    if (ok) {
      setDescription('')
      setAmount('')
      setCategory('')
      setSplit(members.map((m) => m.id))
    }
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <h3 className="font-display text-lg font-bold text-pine">Log an expense</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label">Description</label>
          <input
            className="input"
            placeholder="e.g. Launch on the river"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Amount</label>
          <input
            className="input font-mono"
            inputMode="decimal"
            placeholder="1250"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </div>
        <div>
          <label className="field-label">Category</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | '')}
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Paid by</label>
          <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className="field-label">Split between</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={allSelected ? 'chip chip-selected' : 'chip'}
            onClick={() => setSplit(members.map((m) => m.id))}
          >
            Everyone
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={split.includes(m.id) && !allSelected ? 'chip chip-selected' : 'chip'}
              onClick={() => toggleMember(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-moss">
          Expenses split by “everyone” automatically include new members later on.
        </p>
      </div>
      {err && <p className="mt-2 font-mono text-xs text-clay">{err}</p>}
      <div className="mt-4">
        <button className="btn btn-primary">Add entry</button>
      </div>
    </form>
  )
}

function EditEntryForm({ entry, onDone }: { entry: LedgerEntry; onDone: () => void }) {
  const { members, mutate, refresh } = useTrip()
  const [description, setDescription] = useState(entry.description)
  const [amount, setAmount] = useState(String(entry.amount))
  const [paidBy, setPaidBy] = useState(entry.paid_by ?? '')
  const [category, setCategory] = useState<Category | ''>(entry.category ?? '')
  const [split, setSplit] = useState<string[]>(
    entry.split_between.length > 0 ? entry.split_between : members.map((m) => m.id),
  )
  const [err, setErr] = useState<string | null>(null)

  const allSelected = members.length > 0 && split.length === members.length

  function toggleMember(id: string) {
    setSplit((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!description.trim()) {
      setErr('Give the expense a description.')
      return
    }
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount greater than zero.')
      return
    }
    if (!paidBy) {
      setErr('Choose who paid for it.')
      return
    }
    setErr(null)
    const ok = await mutate(async () => {
      await api.updateEntry(entry.id, {
        description: description.trim(),
        amount: amt,
        paid_by: paidBy,
        category: category === '' ? null : category,
        split_between: allSelected ? [] : split,
      })
      await refresh()
    })
    if (ok) onDone()
  }

  return (
    <div className="border-b border-dashed border-line p-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label">Description</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Amount</label>
          <input
            className="input font-mono"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </div>
        <div>
          <label className="field-label">Category</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | '')}
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Paid by</label>
          <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Split between</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={allSelected ? 'chip chip-selected' : 'chip'}
              onClick={() => setSplit(members.map((m) => m.id))}
            >
              Everyone
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={split.includes(m.id) && !allSelected ? 'chip chip-selected' : 'chip'}
                onClick={() => toggleMember(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="font-mono text-xs text-clay">{err}</p>}
        <div className="sm:col-span-2 flex items-center gap-2">
          <button className="btn btn-primary" type="submit">
            Save
          </button>
          <button className="btn btn-ghost" type="button" onClick={onDone}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}