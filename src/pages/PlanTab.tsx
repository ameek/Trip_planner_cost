import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTrip } from '../lib/TripContext'
import * as api from '../lib/api'
import type { PlanDay, PlanStop } from '../lib/types'
import { EmptyState } from '../components/EmptyState'

export default function PlanTab() {
  const { trip, days, stops, editable, mutate, refresh } = useTrip()
  const [dateLabel, setDateLabel] = useState('')
  const [title, setTitle] = useState('')
  const [overnight, setOvernight] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const orderedDays = useMemo(
    () => [...days].sort((a, b) => a.sort_order - b.sort_order),
    [days],
  )

  const stopsByDay = useMemo(() => {
    const map = new Map<string, PlanStop[]>()
    const ordered = [...stops].sort((a, b) => a.sort_order - b.sort_order)
    for (const stop of ordered) {
      const list = map.get(stop.day_id) ?? []
      list.push(stop)
      map.set(stop.day_id, list)
    }
    return map
  }, [stops])

  async function submitDay(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setErr('Give the day a title.')
      return
    }
    setErr(null)
    const ok = await mutate(async () => {
      await api.addDay(trip.id, {
        date_label: dateLabel.trim(),
        title: title.trim(),
        is_overnight: overnight,
      })
      await refresh()
    })
    if (ok) {
      setDateLabel('')
      setTitle('')
      setOvernight(false)
    }
  }

  async function moveDay(dayId: string, direction: -1 | 1) {
    await mutate(async () => {
      await api.moveDay(dayId, direction, orderedDays)
      await refresh()
    })
  }

  async function moveStop(stopId: string, dayId: string, direction: -1 | 1) {
    const ordered = stopsByDay.get(dayId) ?? []
    await mutate(async () => {
      await api.moveStop(stopId, direction, ordered)
      await refresh()
    })
  }

  async function removeDay(dayId: string) {
    await mutate(async () => {
      await api.deleteDay(dayId)
      await refresh()
    })
  }

  async function removeStop(stopId: string) {
    await mutate(async () => {
      await api.deleteStop(stopId)
      await refresh()
    })
  }

  return (
    <div>
      {editable && (
        <form onSubmit={submitDay} className="card p-4">
          <h3 className="font-display text-lg font-bold text-pine">Add a day</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Date label</label>
              <input
                className="input"
                placeholder="e.g. 26 Aug — Wed"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Day title</label>
              <input
                className="input"
                placeholder="e.g. Bliss Eco Resort"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="accent-pine"
              checked={overnight}
              onChange={(e) => setOvernight(e.target.checked)}
            />
            Overnight / travel day
          </label>
          {err && <p className="mt-2 font-mono text-xs text-clay">{err}</p>}
          <div className="mt-4">
            <button className="btn btn-primary">Add day</button>
          </div>
        </form>
      )}

      {orderedDays.length === 0 ? (
        <EmptyState
          title="The trail is empty"
          body={
            editable
              ? 'Add a day and start plotting stops.'
              : 'No days have been plotted yet — check back once the group plans the route.'
          }
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
              onMoveDay={moveDay}
              onMoveStop={moveStop}
              onDeleteDay={removeDay}
              onDeleteStop={removeStop}
            />
          ))}
        </ol>
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
}) {
  const { mutate, refresh } = useTrip()
  const [label, setLabel] = useState('')
  const [isStay, setIsStay] = useState(false)

  async function submitStop(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    const ok = await mutate(async () => {
      await api.addStop(day.id, label.trim(), isStay)
      await refresh()
    })
    if (ok) {
      setLabel('')
      setIsStay(false)
    }
  }

  return (
    <li className="relative pb-10 pl-9">
      <span className="trail-line absolute bottom-0 left-[9px] top-3 w-px" aria-hidden />
      <span
        aria-hidden
        className={`absolute left-0 top-3 h-[19px] w-[19px] rounded-full border-2 ${day.is_overnight ? 'border-dusk bg-dusk' : 'border-pine bg-paper'}`}
      />
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">{day.date_label || 'No date yet'}</div>
            <h3 className="mt-1 font-display text-xl font-bold leading-snug text-pine">
              {day.title}
            </h3>
          </div>
          {editable && (
            <div className="flex shrink-0 flex-col gap-1">
              <div className="flex gap-1">
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
              </div>
              <button
                type="button"
                className="icon-btn danger"
                title="Delete day"
                onClick={() => onDeleteDay(day.id)}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {stops.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stops.map((stop) => (
              <span key={stop.id} className={stop.is_stay ? 'chip chip-pine' : 'chip'}>
                {stop.is_stay && (
                  <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                )}
                {stop.label}
              </span>
            ))}
          </div>
        )}

        {editable && (
          <div className="mt-4">
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
            <form onSubmit={submitStop} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <label className="field-label">Stop</label>
                <input
                  className="input"
                  placeholder="e.g. Dhaka → Khulna"
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