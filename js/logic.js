// Pure logic — no DOM, no network. Covered by test.html.
import { iso, parseDay, addDays, today, isWeekend, eachDay, round2 } from './util.js';

// ── Availability ─────────────────────────────────────────────
// busyMap: { 'yyyy-mm-dd': Set(userId) }
export function busyMap(busyRows) {
  const m = {};
  for (const r of busyRows) (m[r.day] ||= new Set()).add(r.user_id);
  return m;
}

// For one day: who is free / busy among `people` (active members).
export function dayStatus(day, people, bmap) {
  const set = bmap[day] || new Set();
  const busy = people.filter(p => set.has(p.user_id));
  const free = people.filter(p => !set.has(p.user_id));
  return { busy, free, ratio: people.length ? free.length / people.length : 1 };
}

// Rank the next `horizon` days by how many people are free.
// Ties prefer weekends, then sooner. Days with a planned event are flagged, not removed.
export function bestDays(people, bmap, { from = today(), horizon = 60, weekendsOnly = false, limit = 6, events = [] } = {}) {
  const out = [];
  for (let i = 0; i < horizon; i++) {
    const d = addDays(from, i);
    if (weekendsOnly && !isWeekend(d)) continue;
    const day = iso(d);
    const st = dayStatus(day, people, bmap);
    const ev = events.filter(e => e.status === 'planned' && e.starts_on <= day && e.ends_on >= day);
    out.push({ day, ...st, weekend: isWeekend(d), offset: i, events: ev });
  }
  out.sort((a, b) => b.free.length - a.free.length || (b.weekend - a.weekend) || a.offset - b.offset);
  return out.slice(0, limit);
}

// Longest runs of consecutive days where everyone (or at least `min`) is free.
export function freeWindows(people, bmap, { from = today(), horizon = 90, min = people.length, minLen = 2, limit = 4 } = {}) {
  const wins = [];
  let start = null, len = 0;
  for (let i = 0; i <= horizon; i++) {
    const day = iso(addDays(from, i));
    const ok = i < horizon && dayStatus(day, people, bmap).free.length >= min;
    if (ok) { if (start == null) start = day; len++; }
    else if (start != null) { if (len >= minLen) wins.push({ from: start, to: iso(addDays(parseDay(start), len - 1)), days: len }); start = null; len = 0; }
  }
  return wins.sort((a, b) => b.days - a.days || (a.from < b.from ? -1 : 1)).slice(0, limit);
}

// How well an event's date range fits the crew: share of people free on every day of it.
export function eventFit(ev, people, bmap) {
  if (!people.length) return { free: [], busy: [], ratio: 1 };
  const days = eachDay(ev.starts_on, ev.ends_on).slice(0, 31);
  const busyIds = new Set();
  for (const d of days) for (const id of bmap[d] || []) busyIds.add(id);
  const free = people.filter(p => !busyIds.has(p.user_id));
  return { free, busy: people.filter(p => busyIds.has(p.user_id)), ratio: free.length / people.length };
}

// ── Money ────────────────────────────────────────────────────
// Net balance per user per currency. Positive = is owed money.
export function balances(expenses, settlements) {
  const b = {}; // cur -> uid -> amount
  const add = (cur, u, v) => { (b[cur] ||= {}); b[cur][u] = round2((b[cur][u] || 0) + v); };
  for (const e of expenses) {
    const n = e.split_with.length; if (!n) continue;
    const share = e.amount / n;
    add(e.currency, e.paid_by, e.amount);
    // Spread rounding so shares always sum exactly to the amount.
    let given = 0;
    e.split_with.forEach((u, i) => {
      const s = i === n - 1 ? round2(e.amount - given) : round2(share);
      given = round2(given + s);
      add(e.currency, u, -s);
    });
  }
  for (const s of settlements) { add(s.currency, s.from_user, s.amount); add(s.currency, s.to_user, -s.amount); }
  return b;
}

// Fewest transfers that settle a currency's balances (greedy largest-first).
export function settleUp(bal) {
  const debt = [], cred = [];
  for (const [u, v] of Object.entries(bal)) { if (v < -0.004) debt.push({ u, v: -v }); else if (v > 0.004) cred.push({ u, v }); }
  debt.sort((a, b) => b.v - a.v); cred.sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = round2(Math.min(debt[i].v, cred[j].v));
    if (amt > 0) out.push({ from: debt[i].u, to: cred[j].u, amount: amt });
    debt[i].v = round2(debt[i].v - amt); cred[j].v = round2(cred[j].v - amt);
    if (debt[i].v < 0.005) i++;
    if (cred[j].v < 0.005) j++;
  }
  return out;
}

// ── Calendar files (.ics) ────────────────────────────────────
// Returns the set of busy days (yyyy-mm-dd) covered by VEVENTs, clipped to [from, to].
export function icsBusyDays(text, { from = iso(today()), to = iso(addDays(today(), 366)) } = {}) {
  const unfolded = String(text).replace(/\r?\n[ \t]/g, '');
  const days = new Set();
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);
  for (const b of blocks) {
    const body = b.split(/END:VEVENT/i)[0];
    if (/^TRANSP:TRANSPARENT/im.test(body)) continue;        // "free" events don't block
    if (/^STATUS:CANCELLED/im.test(body)) continue;
    const ds = icsDate(body, 'DTSTART'); if (!ds) continue;
    let de = icsDate(body, 'DTEND');
    const allDay = /DTSTART[^:\n]*VALUE=DATE[:;]/i.test(body) || /DTSTART[^:\n]*:\d{8}\s*$/im.test(body);
    if (!de) de = ds;
    else if (allDay && de > ds) de = iso(addDays(parseDay(de), -1)); // DTEND is exclusive for all-day
    const rr = (body.match(/^RRULE:(.*)$/im) || [])[1];
    const span = Math.max(0, Math.round((parseDay(de) - parseDay(ds)) / 864e5));
    for (const start of expandRRule(ds, rr, to)) {
      const end = iso(addDays(parseDay(start), span));
      for (const d of eachDay(start, end)) if (d >= from && d <= to) days.add(d);
    }
  }
  return [...days].sort();
}
function icsDate(body, prop) {
  const m = body.match(new RegExp('^' + prop + '[^:\\n]*:(\\d{8})(T\\d{6}Z?)?', 'im'));
  if (!m) return null;
  const s = m[1];
  if (m[2] && m[2].endsWith('Z')) { // UTC time → local day
    const t = m[2];
    const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +t.slice(1, 3), +t.slice(3, 5)));
    return iso(d);
  }
  return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
}
// Supports the common cases: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, COUNT, UNTIL, BYDAY (weekly).
function expandRRule(start, rule, limit) {
  if (!rule) return [start];
  const p = Object.fromEntries(rule.split(';').map(kv => kv.split('=')));
  const freq = p.FREQ, iv = Math.max(1, +p.INTERVAL || 1);
  const count = p.COUNT ? +p.COUNT : Infinity;
  const until = p.UNTIL ? p.UNTIL.slice(0, 4) + '-' + p.UNTIL.slice(4, 6) + '-' + p.UNTIL.slice(6, 8) : limit;
  const end = until < limit ? until : limit;
  const out = [];
  const s = parseDay(start);
  const BD = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
  const byday = freq === 'WEEKLY' && p.BYDAY ? p.BYDAY.split(',').map(x => BD[x.slice(-2)]).filter(x => x != null) : null;
  for (let i = 0, n = 0; n < count && i < 2000; i++) {
    let d;
    if (freq === 'DAILY') d = addDays(s, i * iv);
    else if (freq === 'WEEKLY') {
      if (byday) {
        const wk = addDays(s, -((s.getDay() + 6) % 7) + Math.floor(i / 7) * 7 * iv);
        d = addDays(wk, i % 7);
        if (!byday.includes(d.getDay()) || d < s) { if (iso(d) > end) break; continue; }
      } else d = addDays(s, i * 7 * iv);
    }
    else if (freq === 'MONTHLY') d = new Date(s.getFullYear(), s.getMonth() + i * iv, s.getDate());
    else if (freq === 'YEARLY') d = new Date(s.getFullYear() + i * iv, s.getMonth(), s.getDate());
    else return [start];
    const k = iso(d);
    if (k > end) break;
    out.push(k); n++;
  }
  return out;
}

export function eventsToIcs(events, crewName = 'CrewCal') {
  const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CrewCal//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(crewName)];
  for (const e of events) {
    const ds = e.starts_on.replace(/-/g, '');
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '@crewcal', 'DTSTAMP:' + stamp);
    if (e.start_time && e.starts_on === e.ends_on) {
      const t = e.start_time.slice(0, 5).replace(':', '') + '00';
      const t2 = (e.end_time || e.start_time).slice(0, 5).replace(':', '') + '00';
      L.push('DTSTART:' + ds + 'T' + t, 'DTEND:' + ds + 'T' + (t2 > t ? t2 : t));
    } else {
      L.push('DTSTART;VALUE=DATE:' + ds, 'DTEND;VALUE=DATE:' + iso(addDays(parseDay(e.ends_on), 1)).replace(/-/g, ''));
    }
    L.push('SUMMARY:' + esc(e.title));
    if (e.location) L.push('LOCATION:' + esc(e.location));
    const desc = [e.note, e.url].filter(Boolean).join('\n');
    if (desc) L.push('DESCRIPTION:' + esc(desc));
    if (e.url) L.push('URL:' + e.url);
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

// ── Trip planning ────────────────────────────────────────────
export function tripBudget(location, nights, guests, ticket = 0) {
  const loc = String(location || '').toLowerCase();
  let tier = 2;
  if (/monaco|paris|zurich|geneva|oslo|stockholm|copenhagen|london|amsterdam|reykjavik|dublin|new york|tokyo/.test(loc)) tier = 3;
  else if (/prague|warsaw|krak|budapest|zagreb|lisbon|porto|madrid|rome|berlin|barcelona|vilnius|riga|tallinn|athens|seville|valencia/.test(loc)) tier = 1;
  else if (/morocco|turkey|istanbul|albania|serbia|georgia|tbilisi|bulgaria|sofia|romania|bucharest/.test(loc)) tier = 0;
  const n = Math.max(1, nights), g = Math.max(1, guests);
  const perNight = [55, 85, 120, 190][tier];
  const rooms = Math.ceil(g / 2);
  const stay = Math.round((perNight * rooms * n) / g);
  const food = [25, 40, 55, 85][tier] * n;
  const fun = [25, 45, 70, 110][tier];
  const travel = [90, 130, 170, 230][tier];
  return { travel, stay, food, fun, ticket: ticket || 0, total: travel + stay + food + fun + (ticket || 0), tier };
}

export function bookingLinks({ location, starts_on, ends_on, guests = 2, origin = '' }) {
  const city = String(location || '').split(',')[0].trim();
  const ci = starts_on, co = ends_on > starts_on ? ends_on : iso(addDays(parseDay(starts_on), 1));
  const flat = s => s.replace(/-/g, '').slice(2);
  const links = [
    { key: 'flights', label: 'Flights', sub: 'Skyscanner', icon: 'plane',
      url: `https://www.skyscanner.net/transport/flights/${encodeURIComponent(origin || 'anywhere')}/${encodeURIComponent(city || 'anywhere')}/${flat(ci)}/${flat(co)}/?adults=${guests}` },
    { key: 'stay', label: 'Hotels', sub: 'Booking.com', icon: 'bed',
      url: 'https://www.booking.com/searchresults.html?' + new URLSearchParams({ ss: location || city, checkin: ci, checkout: co, group_adults: guests, no_rooms: Math.ceil(guests / 2) }) },
    { key: 'airbnb', label: 'Apartments', sub: 'Airbnb', icon: 'bed',
      url: `https://www.airbnb.com/s/${encodeURIComponent(location || city)}/homes?` + new URLSearchParams({ checkin: ci, checkout: co, adults: guests }) },
    { key: 'car', label: 'Car hire', sub: 'Rentalcars', icon: 'car',
      url: 'https://www.rentalcars.com/search-results?' + new URLSearchParams({ location: city, puDay: ci.slice(8), puMonth: ci.slice(5, 7), puYear: ci.slice(0, 4), doDay: co.slice(8), doMonth: co.slice(5, 7), doYear: co.slice(0, 4) }) },
    { key: 'todo', label: 'Things to do', sub: 'GetYourGuide', icon: 'ticket',
      url: 'https://www.getyourguide.com/s/?q=' + encodeURIComponent(city) },
    { key: 'trains', label: 'Trains & buses', sub: 'Omio', icon: 'compass',
      url: 'https://www.omio.com/search?' + new URLSearchParams({ arrival: city, departure_date: ci, ...(origin ? { departure: origin } : {}) }) },
  ];
  return links;
}
