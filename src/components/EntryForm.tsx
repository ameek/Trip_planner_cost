import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, ExactShare, LedgerEntry, Member, SplitType, Tag } from '../lib/types'
import { CATEGORIES, CATEGORY_LABELS } from '../lib/types'
import { useTrip } from '../lib/TripContext'

const ZEROISH = 0.01

function parseMoney(text: string): number | null {
  const n = parseFloat(text)
  return Number.isFinite(n) ? n : null
}

function digitsOnly(text: string) {
  return text.replace(/[^0-9.]/g, '')
}

export interface EntryFormData {
  description: string
  amount: number
  paid_by: { member_id: string; amount: number }[]
  category: Category | null
  tag_id: string | null
  split_type: SplitType
  split_details: string[] | ExactShare[]
}

export function EntryForm({
  members,
  tags,
  initial,
  submitLabel = 'Add entry',
  onCancel,
  onSubmit,
}: {
  members: Member[]
  tags: Tag[]
  initial?: LedgerEntry
  submitLabel?: string
  onCancel?: () => void
  onSubmit: (data: EntryFormData) => void
}) {
  const { formatMoney } = useTrip()
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState<Category | ''>(initial?.category ?? '')
  const [tagId, setTagId] = useState(initial?.tag_id ?? '')
  const [splitType, setSplitType] = useState<SplitType>(initial?.split_type ?? 'even')
  const [evenIds, setEvenIds] = useState<string[]>(
    initial && initial.split_type === 'even'
      ? (initial.split_details as string[]).length > 0
        ? (initial.split_details as string[])
        : members.map((m) => m.id)
      : members.map((m) => m.id),
  )
  const [exactShares, setExactShares] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    if (initial && initial.split_type === 'exact') {
      for (const s of initial.split_details as ExactShare[]) map[s.member_id] = String(s.share)
    }
    for (const m of members) if (!(m.id in map)) map[m.id] = ''
    return map
  })
  const [payers, setPayers] = useState<{ memberId: string; amountText: string }[]>(() => {
    if (initial && initial.paid_by.length > 0) {
      return initial.paid_by.map((p) => ({ memberId: p.member_id, amountText: String(p.amount) }))
    }
    return members.length > 0 ? [{ memberId: members[0].id, amountText: '' }] : []
  })

  const amount = parseMoney(amountText)
  const isSinglePayer = payers.length <= 1

  const payerSum = payers.reduce((sum, p) => {
    const n = parseMoney(p.amountText)
    return sum + (n ?? 0)
  }, 0)

  const shareSum = members.reduce((sum, m) => {
    const n = parseMoney(exactShares[m.id])
    return sum + (n ?? 0)
  }, 0)

  const payersBalanced = isSinglePayer
    ? amount != null && amount > 0
    : amount != null && Math.abs(payerSum - amount) <= ZEROISH

  const sharesBalanced = splitType === 'exact' ? amount != null && Math.abs(shareSum - amount) <= ZEROISH : true

  const canSubmit =
    description.trim().length > 0 &&
    amount != null &&
    amount > 0 &&
    payers.length > 0 &&
    payersBalanced &&
    sharesBalanced

  function addPayer(memberId: string) {
    setPayers((prev) => [...prev, { memberId, amountText: '' }])
  }

  function removePayer(memberId: string) {
    setPayers((prev) => prev.filter((p) => p.memberId !== memberId))
  }

  function toggleEven(memberId: string) {
    setEvenIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || amount == null) return
    const paidBy =
      payers.length === 1
        ? [{ member_id: payers[0].memberId, amount }]
        : payers.map((p) => ({ member_id: p.memberId, amount: parseMoney(p.amountText) ?? 0 }))
    const splitDetails: string[] | ExactShare[] =
      splitType === 'even'
        ? evenIds.length === members.length || evenIds.length === 0
          ? []
          : evenIds
        : members
            .map((m) => ({ member_id: m.id, share: parseMoney(exactShares[m.id]) ?? 0 }))
            .filter((d) => d.share > 0)
    onSubmit({
      description: description.trim(),
      amount,
      paid_by: paidBy,
      category: category === '' ? null : category,
      tag_id: tagId === '' ? null : tagId,
      split_type: splitType,
      split_details: splitDetails,
    })
  }

  return (
    <form onSubmit={submit} className="p-4">
      <div className="grid gap-3 sm:grid-cols-2">
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
            value={amountText}
            onChange={(e) => setAmountText(digitsOnly(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label">Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Tag / vehicle</label>
          <select className="input" value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">None</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="field-label">Paid by</label>
        {payers.map((payer) => (
          <div key={payer.memberId} className="mt-1 flex flex-wrap items-end gap-2">
            <div className={isSinglePayer ? 'min-w-[160px] sm:min-w-[200px]' : 'min-w-[110px]'}>
              {!isSinglePayer && <label className="field-label">Payer</label>}
              <select
                className="input"
                value={payer.memberId}
                onChange={(e) =>
                  setPayers((prev) =>
                    prev.map((p) => (p.memberId === payer.memberId ? { ...p, memberId: e.target.value } : p)),
                  )
                }
              >
                {members
                  .filter((m) => m.id === payer.memberId || !payers.some((p) => p.memberId === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            {!isSinglePayer && (
              <div>
                <label className="field-label">Amount</label>
                <input
                  className="input w-24 font-mono"
                  inputMode="decimal"
                  placeholder="0"
                  value={payer.amountText}
                  onChange={(e) =>
                    setPayers((prev) =>
                      prev.map((p) => (p.memberId === payer.memberId ? { ...p, amountText: digitsOnly(e.target.value) } : p)),
                    )
                  }
                />
              </div>
            )}
            {payers.length > 1 && (
              <button type="button" className="icon-btn danger mt-[22px]" title="Remove payer" onClick={() => removePayer(payer.memberId)}>
                ✕
              </button>
            )}
          </div>
        ))}

        {isSinglePayer && payers.length > 0 ? (
          <p className="mt-1.5 font-mono text-[11px] text-moss">
            {members.find((m) => m.id === payers[0]?.memberId)?.name ?? 'This member'} covers the
            full {formatMoney(amount ?? 0)} — the split below decides who owes a share.
          </p>
        ) : (
          !isSinglePayer &&
          amount != null && (
            <p
              className={`mt-1.5 font-mono text-[11px] ${Math.abs(payerSum - amount) <= ZEROISH ? 'text-moss' : 'text-clay'}`}
            >
              Paid {formatMoney(payerSum)} of {formatMoney(amount)} across payers
            </p>
          )
        )}

        {payers.length < members.length && (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-wide text-moss underline decoration-dotted underline-offset-4 hover:text-pine"
            onClick={() => {
              const next = members.find((m) => !payers.some((p) => p.memberId === m.id))
              if (next) addPayer(next.id)
            }}
          >
            {isSinglePayer ? 'split who paid this →' : 'add another payer →'}
          </button>
        )}
      </div>

      <div className="mt-4">
        <label className="field-label">Split</label>
        <div className="inline-flex rounded-[3px] border border-line bg-paper p-0.5">
          <button
            type="button"
            className={`rounded-[2px] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition-colors ${splitType === 'even' ? 'bg-pine text-paper' : 'text-moss hover:text-ink'}`}
            onClick={() => setSplitType('even')}
          >
            Evenly
          </button>
          <button
            type="button"
            className={`rounded-[2px] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition-colors ${splitType === 'exact' ? 'bg-pine text-paper' : 'text-moss hover:text-ink'}`}
            onClick={() => setSplitType('exact')}
          >
            Exact amounts
          </button>
        </div>

        {splitType === 'even' ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={evenIds.length === members.length ? 'chip chip-selected' : 'chip'}
              onClick={() => setEvenIds(members.map((m) => m.id))}
            >
              Everyone
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={evenIds.includes(m.id) && evenIds.length !== members.length ? 'chip chip-selected' : 'chip'}
                onClick={() => toggleEven(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.name}</span>
                <input
                  className="input w-24 text-right font-mono"
                  inputMode="decimal"
                  placeholder="0"
                  value={exactShares[m.id] ?? ''}
                  onChange={(e) => setExactShares((prev) => ({ ...prev, [m.id]: digitsOnly(e.target.value) }))}
                />
              </div>
            ))}
            {amount != null && (
              <p className={`font-mono text-[11px] ${Math.abs(shareSum - amount) <= ZEROISH ? 'text-moss' : 'text-clay'}`}>
                Shares {formatMoney(shareSum)} of {formatMoney(amount)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}