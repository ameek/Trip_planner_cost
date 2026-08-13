import { useState } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTrip } from '../lib/TripContext'
import { useEntries, useMembers, useTags } from '../lib/queries'
import { computeBalances, EPS, minimumSettlements, round2 } from '../lib/settle'
import { EmptyState } from '../components/EmptyState'

export default function SettleTab() {
  const { tripId, formatMoney } = useTrip()
  const { data: members = [] } = useMembers(tripId)
  const { data: entries = [] } = useEntries(tripId)
  const { data: tags = [] } = useTags(tripId)
  const [tagFilter, setTagFilter] = useState('')

  const filtered = tagFilter === '' ? entries : entries.filter((e) => e.tag_id === tagFilter)
  const visibleBalances = computeBalances(filtered, members)
  const fullBalances = computeBalances(entries, members)
  const transactions = minimumSettlements(fullBalances)
  const chartData = visibleBalances.map((b) => ({ name: b.member.name, balance: round2(b.balance) }))

  const maxAbs = Math.max(
    EPS,
    ...visibleBalances.map((b) => Math.abs(b.balance)),
  )
  const chartMax = maxAbs * 1.12
  const domain = [-chartMax, chartMax] as [number, number]
  const rawStep = (chartMax * 2) / 5
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const norm = rawStep / magnitude
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * magnitude
  const halfSteps = Math.ceil(chartMax / step)
  const ticks = Array.from({ length: halfSteps * 2 + 1 }, (_, i) => (i - halfSteps) * step)

  if (members.length === 0) {
    return (
      <EmptyState title="Nothing to settle" body="Add members and some expenses first — the math needs names to work with." />
    )
  }
  if (entries.length === 0) {
    return <EmptyState title="The books are even" body="No expenses yet, so everyone is settled up by default." />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-pine">Who stands where</h3>
        <label className="flex items-center gap-2">
          <span className="field-label mb-0">Filter</span>
          <select className="input w-40" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">All costs</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 text-xs text-moss">
        Pine bars are owed money. Clay bars owe the group. Settlements always cover the full ledger.
      </p>

      <div className="card mt-4 p-4">
        <ResponsiveContainer width="100%" height={Math.max(visibleBalances.length * 42, 120)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              domain={domain}
              ticks={ticks}
              tick={{ fontSize: 10, fill: '#4a5d42', fontFamily: 'JetBrains Mono' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={110}
              tick={{ fontSize: 11, fill: '#1c2b21', fontFamily: 'Work Sans' }}
            />
            <ReferenceLine x={0} stroke="#1c2b21" strokeWidth={1.5} />
            <Bar dataKey="balance" barSize={14} radius={[0, 3, 3, 0]} isAnimationActive={false} minPointSize={3}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.balance >= 0 ? '#1c2b21' : '#b5652d'} />
              ))}
            </Bar>
            <Tooltip
              cursor={{ fill: 'rgba(28, 43, 33, 0.06)' }}
              contentStyle={{
                background: '#f7f3e8',
                border: '1px solid rgba(28, 43, 33, 0.18)',
                borderRadius: 3,
                fontFamily: 'JetBrains Mono',
                fontSize: 12,
              }}
              formatter={(value) => formatMoney(Number(value))}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card mt-4 p-4">
        <h3 className="font-display text-lg font-bold text-pine">Settle up</h3>
        <p className="mt-1 font-mono text-xs text-moss">Minimum payments across the full ledger.</p>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-moss">Everyone is settled up. Nothing owed.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transactions.map((t, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 font-mono text-sm">
                <span>
                  <span className="font-semibold text-ink">{t.from.name}</span>{' '}
                  <span className="text-moss">→</span>{' '}
                  <span className="font-semibold text-ink">{t.to.name}</span>
                </span>
                <span className="tabular-nums text-pine">{formatMoney(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card mt-4 p-4">
        <h3 className="font-display text-lg font-bold text-pine">Balances</h3>
        <ul className="mt-3 space-y-1 font-mono text-sm">
          {visibleBalances.map((b) => {
            const abs = Math.abs(b.balance)
            const settled = abs < EPS
            const line = settled
              ? `${b.member.name} is settled up`
              : b.balance > 0
                ? `${b.member.name} is owed ${formatMoney(abs)}`
                : `${b.member.name} owes ${formatMoney(abs)}`
            return (
              <li key={b.member.id} className="flex justify-between gap-3">
                <span className="text-ink">
                  {line}
                  <span className="ml-2 text-moss">target {formatMoney(round2(b.target))}</span>
                </span>
                <span className={`tabular-nums ${b.balance > 0 ? 'text-pine' : b.balance < 0 ? 'text-clay' : 'text-moss'}`}>
                  {formatMoney(b.balance)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}