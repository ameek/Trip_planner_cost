import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTrip } from '../lib/TripContext'
import {
  useAddDay,
  useAddDaysBatch,
  useAddStop,
  useDays,
  useDeleteDay,
  useDeleteStop,
  useMoveDay,
  useMoveStop,
  useStops,
  useUpdateDay,
} from '../lib/queries'
import type { PlanDay, PlanStop } from '../lib/types'
import { EmptyState } from '../components/EmptyState'

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts.map(Number)
  const date = new Date(y, m - 1, d)
  if (isNaN(date.getTime())) return dateStr
  const monthName = date.toLocaleString('en-US', { month: 'short' })
  const dayName = date.toLocaleString('en-US', { weekday: 'short' })
  return `${d} ${monthName} — ${dayName}`
}

export default function PlanTab() {
  const { tripId, editable } = useTrip()
  const { data: days = [], isPending: daysPending } = useDays(tripId)
  const { data: stops = [], isPending: stopsPending } = useStops(tripId)

  const moveDay = useMoveDay(tripId)
  const deleteDay = useDeleteDay(tripId)
  const moveStop = useMoveStop(tripId)
  const deleteStop = useDeleteStop(tripId)
  const updateDay = useUpdateDay(tripId)

  const orderedDays = useMemo(
    () => [...days].sort((a, b) => a.sort_order - b.sort_order),
    [days],
  )
  const stopsByDay = useMemo(() => {
    const map = new Map<string, PlanStop[]>()
    for (const stop of [...stops].sort((a, b) => a.sort_order - b.sort_order)) {
      const list = map.get(stop.day_id) ?? []
      list.push(stop)
      map.set(stop.day_id, list)
    }
    return map
  }, [stops])

  if (daysPending || stopsPending) {
    return <p className="font-mono text-sm text-moss">Loading the plan…</p>
  }

  return (
    <div>
      {editable && <AddDaysSection tripId={tripId} existingCount={orderedDays.length} />}

      {orderedDays.length === 0 ? (
        <EmptyState
          title="The trail is empty"
          body={editable ? 'Select trip dates above to auto-populate days, or add a single day to start plotting your itinerary.' : 'No days have been plotted yet — check back once the group plans the route.'}
        />
      ) : (
        <ol className="mt-8">
          {orderedDays.map((day, index) => (
            <DayCard
              key={day.id}
              day={day}
              index={index}
              total={orderedDays.length}
              stops={stopsByDay.get(day.id) ?? []}
              editable={editable}
              onMoveDay={(dayId, direction) => moveDay.mutate({ dayId, direction })}
              onMoveStop={(stopId, dayId, direction) => moveStop.mutate({ stopId, dayId, direction })}
              onDeleteDay={(dayId) => deleteDay.mutate(dayId)}
              onDeleteStop={(stopId) => deleteStop.mutate(stopId)}
              onUpdateDay={(dayId, patch) => updateDay.mutate({ dayId, patch })}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function AddDaysSection({ tripId, existingCount }: { tripId: string; existingCount: number }) {
  const [mode, setMode] = useState<'range' | 'single'>('range')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [singleDate, setSingleDate] = useState('')
  const [singleLabel, setSingleLabel] = useState('')
  const [singleTitle, setSingleTitle] = useState('')
  const [singleOvernight, setSingleOvernight] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addDay = useAddDay(tripId)
  const addDaysBatch = useAddDaysBatch(tripId)

  const rangeDaysCount = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }, [startDate, endDate])

  function handleBatchRangeSubmit(e: FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) {
      setError('Please select both start and end dates.')
      return
    }
    if (rangeDaysCount <= 0) {
      setError('End date must be on or after start date.')
      return
    }
    setError(null)

    const batch = []
    const start = new Date(startDate)
    for (let i = 0; i < rangeDaysCount; i++) {
      const curDate = new Date(start)
      curDate.setDate(start.getDate() + i)
      const y = curDate.getFullYear()
      const m = String(curDate.getMonth() + 1).padStart(2, '0')
      const d = String(curDate.getDate()).padStart(2, '0')
      const isoStr = `${y}-${m}-${d}`
      
      const dateLabel = formatDateLabel(isoStr)
      const dayNumber = existingCount + i + 1
      batch.push({
        date_label: dateLabel,
        title: `Day ${dayNumber}`,
        is_overnight: false,
      })
    }

    addDaysBatch.mutate(batch)
    setStartDate('')
    setEndDate('')
  }

  function handleSingleSubmit(e: FormEvent) {
    e.preventDefault()
    const finalTitle = singleTitle.trim() || `Day ${existingCount + 1}`
    const finalLabel = singleLabel.trim() || (singleDate ? formatDateLabel(singleDate) : '')

    setError(null)
    addDay.mutate({
      date_label: finalLabel,
      title: finalTitle,
      is_overnight: singleOvernight,
    })

    setSingleDate('')
    setSingleLabel('')
    setSingleTitle('')
    setSingleOvernight(false)
  }

  function handleSingleDateChange(dateVal: string) {
    setSingleDate(dateVal)
    if (dateVal) {
      setSingleLabel(formatDateLabel(dateVal))
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-dark pb-3">
        <h3 className="font-display text-lg font-bold text-pine">Add Trip Days</h3>
        <div className="flex rounded-md bg-sand p-1">
          <button
            type="button"
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              mode === 'range' ? 'bg-paper text-pine shadow-sm' : 'text-moss hover:text-pine'
            }`}
            onClick={() => setMode('range')}
          >
            📅 Calendar Range (Auto-populate)
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              mode === 'single' ? 'bg-paper text-pine shadow-sm' : 'text-moss hover:text-pine'
            }`}
            onClick={() => setMode('single')}
          >
            ➕ Single Day
          </button>
        </div>
      </div>

      {mode === 'range' ? (
        <form onSubmit={handleBatchRangeSubmit} className="mt-3">
          <p className="text-xs text-moss">
            Pick your trip start and end dates to automatically generate blank itinerary days. You can customize each day’s title and activities afterwards.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Start Date</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">End Date</label>
              <input
                type="date"
                className="input"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {rangeDaysCount > 0 && (
            <div className="mt-3 rounded-md bg-sand-light p-2.5 text-xs text-pine">
              ✨ Ready to auto-populate <strong className="font-bold">{rangeDaysCount} blank days</strong> ({formatDateLabel(startDate)} → {formatDateLabel(endDate)}).
            </div>
          )}

          {error && <p className="mt-2 font-mono text-xs text-clay">{error}</p>}

          <div className="mt-4">
            <button className="btn btn-primary" disabled={rangeDaysCount <= 0}>
              Auto-populate {rangeDaysCount > 0 ? `${rangeDaysCount} Days` : 'Days'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSingleSubmit} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label">Select Date</label>
              <input
                type="date"
                className="input"
                value={singleDate}
                onChange={(e) => handleSingleDateChange(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Date Label</label>
              <input
                className="input"
                placeholder="e.g. 26 Aug — Wed"
                value={singleLabel}
                onChange={(e) => setSingleLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Day Title</label>
              <input
                className="input"
                placeholder={`e.g. Day ${existingCount + 1}`}
                value={singleTitle}
                onChange={(e) => setSingleTitle(e.target.value)}
              />
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="accent-pine"
              checked={singleOvernight}
              onChange={(e) => setSingleOvernight(e.target.checked)}
            />
            Overnight / travel day
          </label>

          {error && <p className="mt-2 font-mono text-xs text-clay">{error}</p>}

          <div className="mt-4">
            <button className="btn btn-primary">Add Day</button>
          </div>
        </form>
      )}
    </div>
  )
}

function DayCard({
  day,
  index,
  total,
  stops,
  editable,
  onMoveDay,
  onMoveStop,
  onDeleteDay,
  onDeleteStop,
  onUpdateDay,
}: {
  day: PlanDay
  index: number
  total: number
  stops: PlanStop[]
  editable: boolean
  onMoveDay: (dayId: string, direction: -1 | 1) => void
  onMoveStop: (stopId: string, dayId: string, direction: -1 | 1) => void
  onDeleteDay: (dayId: string) => void
  onDeleteStop: (stopId: string) => void
  onUpdateDay: (dayId: string, patch: { title?: string; date_label?: string; is_overnight?: boolean }) => void
}) {
  const { tripId } = useTrip()
  const addStop = useAddStop(tripId)
  const [label, setLabel] = useState('')
  const [isStay, setIsStay] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(day.title)
  const [editDateLabel, setEditDateLabel] = useState(day.date_label)
  const [editOvernight, setEditOvernight] = useState(day.is_overnight)

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editTitle.trim()) return
    onUpdateDay(day.id, {
      title: editTitle.trim(),
      date_label: editDateLabel.trim(),
      is_overnight: editOvernight,
    })
    setIsEditing(false)
  }

  function handleStopSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    addStop.mutate({ dayId: day.id, label: label.trim(), isStay })
    setLabel('')
    setIsStay(false)
  }

  return (
    <li className="relative pb-10 pl-9">
      <span className="trail-line absolute bottom-0 left-[9px] top-3 w-px" aria-hidden />
      <span
        aria-hidden
        className={`absolute left-0 top-3 h-[19px] w-[19px] rounded-full border-2 ${
          day.is_overnight ? 'border-dusk bg-dusk' : 'border-pine bg-paper'
        }`}
      />
      <div className="card p-4">
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">Date Label</label>
                <div className="flex gap-1.5">
                  <input
                    className="input"
                    placeholder="e.g. 26 Aug — Wed"
                    value={editDateLabel}
                    onChange={(e) => setEditDateLabel(e.target.value)}
                  />
                  <input
                    type="date"
                    className="input w-10 px-1 text-center"
                    title="Pick Date"
                    onChange={(e) => {
                      if (e.target.value) setEditDateLabel(formatDateLabel(e.target.value))
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Day Title</label>
                <input
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Day title"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                className="accent-pine"
                checked={editOvernight}
                onChange={(e) => setEditOvernight(e.target.checked)}
              />
              Overnight / travel day
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button type="submit" className="btn btn-primary py-1 px-3 text-xs">
                Save
              </button>
              <button
                type="button"
                className="btn btn-ghost py-1 px-3 text-xs"
                onClick={() => {
                  setEditTitle(day.title)
                  setEditDateLabel(day.date_label)
                  setEditOvernight(day.is_overnight)
                  setIsEditing(false)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow">{day.date_label || 'No date set'}</div>
              <h3 className="mt-1 font-display text-xl font-bold leading-snug text-pine">{day.title}</h3>
            </div>
            {editable && (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit day title & date"
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Move day up"
                    disabled={index === 0}
                    onClick={() => onMoveDay(day.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Move day down"
                    disabled={index === total - 1}
                    onClick={() => onMoveDay(day.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete day"
                    onClick={() => onDeleteDay(day.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {stops.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stops.map((stop) => (
              <span key={stop.id} className={stop.is_stay ? 'chip chip-pine' : 'chip'}>
                {stop.is_stay && <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />}
                {stop.label}
              </span>
            ))}
          </div>
        )}

        {editable && (
          <div className="mt-4 border-t border-sand-dark pt-3">
            {stops.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1">
                {stops.map((stop, i) => (
                  <span key={stop.id} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Move stop up"
                      disabled={i === 0}
                      onClick={() => onMoveStop(stop.id, day.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Move stop down"
                      disabled={i === stops.length - 1}
                      onClick={() => onMoveStop(stop.id, day.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Remove stop"
                      onClick={() => onDeleteStop(stop.id)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form onSubmit={handleStopSubmit} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <label className="field-label">Add activity / stop</label>
                <input
                  className="input"
                  placeholder="e.g. Dhaka → Khulna or Boat Ride"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-xs text-ink">
                <input
                  type="checkbox"
                  className="accent-pine"
                  checked={isStay}
                  onChange={(e) => setIsStay(e.target.checked)}
                />
                overnight stay
              </label>
              <button className="btn btn-ghost" disabled={!label.trim()}>
                Add stop
              </button>
            </form>
          </div>
        )}
      </div>
    </li>
  )
}