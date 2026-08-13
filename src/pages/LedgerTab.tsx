import { useMemo, useState } from 'react'
import { useTrip } from '../lib/TripContext'
import { useEntries, useMembers, useRevisions, useTags } from '../lib/queries'
import {
  retryEntryMutation,
  useCreateEntry,
  useDeleteEntry,
  useLedgerRowStatus,
  useUpdateEntry,
} from '../lib/ledgerMutations'
import { EntryForm } from '../components/EntryForm'
import { EmptyState } from '../components/EmptyState'
import { CATEGORY_LABELS } from '../lib/types'
import type { Category, LedgerEntry, Member, Tag } from '../lib/types'

export default function LedgerTab() {
  const { tripId, editable, formatMoney } = useTrip()
  const { data: members = [] } = useMembers(tripId)
  const { data: tags = [] } = useTags(tripId)
  const { data: entries = [] } = useEntries(tripId)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const createEntry = useCreateEntry(tripId)
  const updateEntry = useUpdateEntry(tripId)
  const deleteEntry = useDeleteEntry(tripId)

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [entries],
  )
  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries])

  const memberName = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? '—') : '—')

  return (
    <div>
      {editable && members.length === 0 && (
        <p className="mb-4 font-mono text-sm text-clay">Add members first — an expense needs someone to pay for it.</p>
      )}
      {editable && members.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
            {adding ? 'Close form' : 'Add expense'}
          </button>
        </div>
      )}

      {adding && editable && members.length > 0 && (
        <div className="card mb-6">
          <EntryForm
            members={members}
            tags={tags}
            onCancel={() => setAdding(false)}
            onSubmit={(data) => {
              createEntry.mutate({ clientId: crypto.randomUUID(), data })
              setAdding(false)
            }}
          />
        </div>
      )}

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
                <th>Tag</th>
                <th className="text-right">Amount</th>
                {editable && <th className="text-right">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  members={members}
                  tags={tags}
                  editable={editable}
                  memberName={memberName}
                  formatMoney={formatMoney}
                  tripId={tripId}
                  isEditing={editingId === entry.id}
                  onEdit={() => setEditingId(entry.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(data) => {
                    updateEntry.mutate({ id: entry.id, data })
                    setEditingId(null)
                  }}
                  onDelete={() => deleteEntry.mutate({ id: entry.id })}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td colSpan={4}>Total</td>
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

function EntryRow({
  entry,
  members,
  tags,
  editable,
  memberName,
  formatMoney,
  tripId,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  entry: LedgerEntry
  members: Member[]
  tags: Tag[]
  editable: boolean
  memberName: (id: string | null) => string
  formatMoney: (n: number) => string
  tripId: string
  isEditing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (data: import('../lib/api').NewEntryInput) => void
  onDelete: () => void
}) {
  const [showPayers, setShowPayers] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const status = useLedgerRowStatus(tripId, entry.id)
  const { data: revisions } = useRevisions(entry.id, showHistory)

  const tagLabel = tags.find((t) => t.id === entry.tag_id)?.label ?? null
  const edited = new Date(entry.updated_at).getTime() !== new Date(entry.created_at).getTime()

  const payersText =
    entry.paid_by.length === 0
      ? '—'
      : entry.paid_by.length === 1
        ? memberName(entry.paid_by[0].member_id)
        : entry.paid_by.map((p) => memberName(p.member_id)).join(' + ')

  const splitText =
    entry.split_type === 'even'
      ? entry.split_details.length === 0 || entry.split_details.length === members.length
        ? 'Even · everyone'
        : `Even · ${entry.split_details.length} people`
      : `Exact · ${entry.split_details.length} people`

  if (isEditing) {
    return (
      <tr>
        <td colSpan={6} className="p-0">
          <div className="card border-0">
            <EntryForm
              members={members}
              tags={tags}
              initial={entry}
              submitLabel="Save changes"
              onCancel={onCancelEdit}
              onSubmit={onSave}
            />
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <div className="font-medium text-ink">{entry.description}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-moss">
          <span>{entry.category ? CATEGORY_LABELS[entry.category as Category] : '—'}</span>
          {edited && (
            <button
              type="button"
              className="rounded-full border border-clay/40 bg-clay/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-clay"
              onClick={() => setShowHistory((v) => !v)}
            >
              edited
            </button>
          )}
        </div>
        {showHistory && (
          <div className="mt-2 space-y-1.5 rounded-[3px] border border-line bg-sand/60 p-2">
            {!revisions || revisions.length === 0 ? (
              <p className="font-mono text-[11px] text-moss">No recorded revisions.</p>
            ) : (
              revisions.map((r) => (
                <div key={r.id} className="font-mono text-[11px] text-moss">
                  <span className="text-clay">{new Date(r.edited_at).toLocaleString()}</span> —{' '}
                  {r.snapshot.description} · {formatMoney(r.snapshot.amount)}
                </div>
              ))
            )}
          </div>
        )}
      </td>
      <td>
        <button
          type="button"
          className="text-left text-ink hover:text-pine"
          disabled={entry.paid_by.length <= 1}
          onClick={() => setShowPayers((v) => !v)}
        >
          {payersText}
        </button>
        {showPayers && entry.paid_by.length > 1 && (
          <div className="mt-1 space-y-0.5 font-mono text-[11px] text-moss">
            {entry.paid_by.map((p) => (
              <div key={p.member_id}>
                {memberName(p.member_id)} · {formatMoney(p.amount)}
              </div>
            ))}
          </div>
        )}
        {status !== 'ok' && editable && (
          <div className="mt-1 font-mono text-[10px]">
            {status === 'queued' && <span className="text-clay">● queued</span>}
            {status === 'syncing' && <span className="text-dusk">● syncing</span>}
            {status === 'failed' && (
              <button className="text-clay underline" onClick={() => retryEntryMutation(tripId, entry.id)}>
                ● failed — retry
              </button>
            )}
          </div>
        )}
      </td>
      <td className="font-mono text-xs text-moss">{splitText}</td>
      <td className="font-mono text-xs text-moss">{tagLabel ?? '—'}</td>
      <td className="num font-medium text-pine">{formatMoney(entry.amount)}</td>
      {editable && (
        <td className="text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={onEdit}
              disabled={status === 'queued' || status === 'syncing'}
            >
              Edit
            </button>
            <button className="icon-btn danger" title="Delete entry" onClick={onDelete}>✕</button>
          </div>
        </td>
      )}
    </tr>
  )
}