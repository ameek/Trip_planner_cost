import { supabase } from '../src/lib/supabase'
import * as api from '../src/lib/api'
import { computeBalances, minimumSettlements, round2 } from '../src/lib/settle'
import type { Category } from '../src/lib/types'

const SHORT_ID = 'teknaf'
const PIN = '1111'

async function main() {
  // Trip lifecycle only: api.ts has no "create with a specific short_id" or delete-trip
  // endpoint, so the trip row itself is upserted directly. Everything else goes through
  // the app's own api.ts functions, exactly as the running app calls them.
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .upsert(
      { short_id: SHORT_ID, name: 'Teknaf Retreat', edit_code: PIN, currency: 'BDT' },
      { onConflict: 'short_id' },
    )
    .select('id')
    .single()
  if (tripErr) throw new Error(`trip: ${tripErr.message}`)
  const tripId = trip.id

  // Reset any prior demo data through the app's own deletion APIs.
  for (const entry of await api.fetchEntries(tripId)) await api.deleteEntry(entry.id)
  for (const member of await api.fetchMembers(tripId)) await api.deleteMember(tripId, member.id)

  // Members + contribution through the app's API.
  for (const name of ['AMeek', 'Sajid', 'Fahim', 'Farab']) await api.addMember(tripId, name)
  const members = await api.fetchMembers(tripId)
  const byName = Object.fromEntries(members.map((m) => [m.name, m.id]))
  await api.updateMemberContribution(byName.Farab, 4020)

  const shared = [byName.AMeek, byName.Sajid, byName.Fahim]
  const farabOnly = [byName.Farab]

  type Row = [string, number, string, Category, string[]]
  const entries: Row[] = [
    // Sajid (total 6988) — shared pool
    ['Main tickets (booked ahead)', 4400, 'Sajid', 'transport', shared],
    ['Bus ticket', 2000, 'Sajid', 'transport', shared],
    ['Minor group expense', 300, 'Sajid', 'other', shared],
    ['Minor group expense', 100, 'Sajid', 'other', shared],
    ['Minor group expense', 188, 'Sajid', 'other', shared],
    // Fahim (total 4570) — shared pool
    ['Uber to the meetup point', 400, 'Fahim', 'transport', shared],
    ['Bus ticket', 2400, 'Fahim', 'transport', shared],
    ['Minor group expense', 90, 'Fahim', 'other', shared],
    ['Minor group expense', 80, 'Fahim', 'other', shared],
    ['Minor group expense', 200, 'Fahim', 'other', shared],
    ['Minor group expense', 1300, 'Fahim', 'other', shared],
    ['Minor group expense', 100, 'Fahim', 'other', shared],
    // AMeek (total 11040) — shared pool
    ['Breakfast', 640, 'AMeek', 'food', shared],
    ['Resort stay', 9000, 'AMeek', 'accommodation', shared],
    ['Group expense', 1200, 'AMeek', 'other', shared],
    ['Group expense', 100, 'AMeek', 'other', shared],
    ['Group expense', 100, 'AMeek', 'other', shared],
    // Farab (total 4020) — borne by Farab alone (capped contribution)
    ['Car from D to T', 1400, 'Farab', 'transport', farabOnly],
    ['Big lunch', 1800, 'Farab', 'food', farabOnly],
    ['Mangoes', 50, 'Farab', 'food', farabOnly],
    ['Auto ride', 50, 'Farab', 'transport', farabOnly],
    ['Misty (sweets)', 520, 'Farab', 'food', farabOnly],
    ['Out-of-pocket group expense', 200, 'Farab', 'other', farabOnly],
  ]

  for (const [description, amount, payerName, category, splitDetails] of entries) {
    await api.addEntry(tripId, {
      description,
      amount,
      paid_by: [{ member_id: byName[payerName], amount }],
      category,
      tag_id: null,
      split_type: 'even',
      split_details: splitDetails,
    })
  }

  // Verify through the app's own read path + settlement math (same as the Settle tab).
  const readMembers = await api.fetchMembers(tripId)
  const readEntries = await api.fetchEntries(tripId)
  const balances = computeBalances(readEntries, readMembers)
  const paid = Object.fromEntries(balances.map((b) => [b.member.name, b.paid]))
  const grand = round2(balances.reduce((sum, b) => sum + b.paid, 0))
  const transactions = minimumSettlements(balances)

  console.log('Trip seeded: /t/' + SHORT_ID + '  PIN ' + PIN)
  console.log('Paid:', Object.entries(paid).map(([k, v]) => `${k}=${v}`).join('  '))
  console.log('Grand total:', grand)
  for (const b of balances) {
    console.log(`  target ${b.member.name}=${round2(b.target)}  balance=${round2(b.balance)}`)
  }
  console.log('Settlements:')
  for (const t of transactions) {
    console.log(`  ${t.from.name} pays ${t.to.name} ${round2(t.amount)}`)
  }
  console.log('Entries inserted:', readEntries.length)
}

main().catch((e) => {
  console.error('FAILED:', e && e.message ? e.message : e)
  process.exit(1)
})