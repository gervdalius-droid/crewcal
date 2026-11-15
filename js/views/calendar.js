import { h, icon, MONTHS, DOW, iso, parseDay, today, addDays, dow, fmtDay, fmtRange, avatar, avatarStack, isWeekend } from '../util.js';
import { S, render, active, bmap, me, iAmBusy, toggleBusy, person, addNote, deleteNote, attempt, isAdmin, toast } from '../store.js';
import { dayStatus, bestDays, freeWindows } from '../logic.js';
import { openSheet, chip, segmented } from '../ui.js';
import { openEventSheet, openEventForm, eventCard } from './plans.js';

export function calendarView() {
  const { y, m } = S.cal;
  const people = active();
  const wrap = h('div.view.cal-view' + (S.cal.mark ? '.marking' : ''));

  // Header
  const head = h('div.cal-head',
    h('div.cal-title', h('span.cal-month', MONTHS[m]), h('span.cal-year', y)),
    h('div.row.gap-s',
      h('button.btn.sm.ghost', { onclick: () => { S.cal.y = today().getFullYear(); S.cal.m = today().getMonth(); render(); } }, 'Today'),
      h('button.iconbtn', { 'aria-label': 'Previous month', onclick: () => shift(-1) }, icon('chevL')),
      h('button.iconbtn', { 'aria-label': 'Next month', onclick: () => shift(1) }, icon('chevR'))));

  const modeBar = h('div.cal-mode',
    segmented([['view', 'Browse'], ['mark', 'Mark my busy days']], S.cal.mark ? 'mark' : 'view', v => { S.cal.mark = v === 'mark'; render(); }, 'grow'),
  );
  const hint = S.cal.mark
    ? h('div.hint.mark-hint', icon('edit', 16), 'Tap every day you can’t make it. Saved instantly — your crew sees it live.')
    : null;

  const grid = monthGrid(y, m, people);
  const legend = h('div.legend',
    h('span', h('i.lg.lg-all'), 'Everyone free'),
    h('span', h('i.lg.lg-most'), 'Most free'),
    h('span', h('i.lg.lg-me'), 'You’re busy'),
    h('span', h('i.lg.lg-ev'), 'Plan'));

  const main = h('div.cal-main', head, modeBar, hint, h('div.card.cal-card', grid, legend));
  const side = h('div.cal-side', bestDaysCard(people), freeTodayCard(people), windowsCard(people));
  wrap.append(main, side);
  attachSwipe(grid);
  return wrap;
}

function shift(n) {
  const d = new Date(S.cal.y, S.cal.m + n, 1);
  S.cal.y = d.getFullYear(); S.cal.m = d.getMonth(); render();
}
function attachSwipe(el) {
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive: true });
}

function monthGrid(y, m, people) {
  const grid = h('div.mgrid', { role: 'grid', 'aria-label': MONTHS[m] + ' ' + y });
  DOW.forEach((d, i) => grid.append(h('div.dow' + (i > 4 ? '.we' : ''), d)));
  const first = new Date(y, m, 1), lead = dow(first);
  const start = addDays(first, -lead);
  const weeks = Math.ceil((lead + new Date(y, m + 1, 0).getDate()) / 7);
  const t = iso(today());
  const bm = bmap();
  const planned = S.crew.events.filter(e => e.status === 'planned');
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), day = iso(d);
    const out = d.getMonth() !== m, past = day < t;
    const st = dayStatus(day, people, bm);
    const mine = bm[day]?.has(me());
    const evs = planned.filter(e => e.starts_on <= day && e.ends_on >= day);
    const notes = S.crew.notes.filter(n => n.day === day);
    const all = people.length > 1 && st.free.length === people.length;
    const most = !all && people.length > 1 && st.ratio >= 0.7;
    const cls = ['cell', out && 'out', past && 'past', day === t && 'today', mine && 'mine', all && !past && 'all', most && !past && 'most', isWeekend(d) && 'we', S.cal.flash === day && 'flash'].filter(Boolean).join('.');
    const cell = h('button.' + cls, {
      role: 'gridcell', 'data-day': day,
      'aria-label': fmtDay(day, { relative: false }) + ' — ' + st.free.length + ' of ' + people.length + ' free' + (mine ? ', you are busy' : '') + (evs.length ? ', ' + evs.length + ' plan' : ''),
      onclick: () => {
        if (S.cal.mark) {
          if (past) toast('That day has already passed — tap today or later');
          else { S.cal.flash = day; setTimeout(() => { if (S.cal.flash === day) S.cal.flash = null; }, 400); toggleBusy(day); }
        }
        else openDaySheet(day);
      },
    },
      h('span.dnum', d.getDate()),
      people.length > 1 ? h('span.meter', { style: { '--r': st.ratio } }) : null,
      h('span.cevs', evs.slice(0, 2).map(e => h('span.cev', { style: { '--c': person(e.created_by).color } }, h('span.cev-t', e.title))), evs.length > 2 ? h('span.cev.more', '+' + (evs.length - 2)) : null),
      notes.length ? h('span.cnote', { title: notes.length + ' note' + (notes.length > 1 ? 's' : '') }) : null,
      !past && people.length > 1 && st.busy.length && st.busy.length < people.length ? h('span.cbusy', st.free.length + '/' + people.length) : null,
    );
    grid.append(cell);
  }
  return grid;
}

function bestDaysCard(people) {
  const card = h('div.card.side-card');
  const list = bestDays(people, bmap(), { weekendsOnly: S.cal.weekendsOnly, limit: 5, horizon: 75, events: S.crew.events });
  card.append(h('div.card-head', h('h3', icon('sparkles', 18, 'iris'), 'Best days to meet'),
    chip('Weekends', S.cal.weekendsOnly, () => { S.cal.weekendsOnly = !S.cal.weekendsOnly; render(); }, 'sm')));
  if (people.length < 2) {
    card.append(h('p.muted.small', 'Invite your crew — best days appear once two or more people share their calendars.'));
    return card;
  }
  card.append(h('div.best', list.map((b, i) => h('button.best-row', { onclick: () => openDaySheet(b.day) },
    h('span.best-rank' + (i === 0 ? '.top' : ''), i + 1),
    h('span.best-main', h('span.best-day', fmtDay(b.day)), h('span.best-sub', b.free.length === people.length ? 'Everyone’s free' : b.busy.map(p => p.name.split(' ')[0]).join(', ') + ' busy')),
    b.events.length ? h('span.pill.sm', b.events[0].title) : null,
    h('span.best-score' + (b.free.length === people.length ? '.full' : ''), b.free.length + '/' + people.length)))));
  return card;
}

function freeTodayCard(people) {
  const t = iso(today());
  const st = dayStatus(t, people, bmap());
  const card = h('div.card.side-card');
  card.append(h('div.card-head', h('h3', h('span.live-dot'), 'Free today'), h('span.muted.small', st.free.length + ' of ' + people.length)));
  card.append(st.free.length
    ? h('div.people-row', st.free.map(p => h('span.person-chip', avatar(p, 24), p.user_id === me() ? 'You' : p.name.split(' ')[0])))
    : h('p.muted.small', 'Nobody’s free today.'));
  if (st.free.length > 1) card.append(h('button.btn.sm.soft.mt', { onclick: () => openEventForm({ starts_on: t, ends_on: t }) }, icon('plus', 16), 'Plan something tonight'));
  return card;
}

function windowsCard(people) {
  if (people.length < 2) return null;
  const wins = freeWindows(people, bmap(), { horizon: 120, min: people.length, minLen: 2, limit: 3 });
  const near = wins.length ? wins : freeWindows(people, bmap(), { horizon: 120, min: Math.max(2, people.length - 1), minLen: 2, limit: 3 });
  const card = h('div.card.side-card');
  card.append(h('div.card-head', h('h3', icon('plane', 18), 'Trip windows'), h('span.muted.small', wins.length ? 'everyone free' : 'all but one')));
  if (!near.length) { card.append(h('p.muted.small', 'No 2+ day stretch where the crew is free in the next 4 months.')); return card; }
  card.append(h('div.wins', near.map(w => h('button.win', { onclick: () => openEventForm({ starts_on: w.from, ends_on: w.to, category: 'Trip' }) },
    h('span.win-d', fmtRange(w.from, w.to)), h('span.win-n', w.days + ' days'), icon('plus', 16)))));
  return card;
}

// ── Day sheet ────────────────────────────────────────────────
export function openDaySheet(day) {
  const st0 = { note: '' };
  openSheet({ title: fmtDay(day, { relative: false }) }, (body, sheet) => {
    const people = active();
    const st = dayStatus(day, people, bmap());
    const past = day < iso(today());
    const busy = iAmBusy(day);
    const evs = S.crew.events.filter(e => e.starts_on <= day && e.ends_on >= day);
    const notes = S.crew.notes.filter(n => n.day === day);

    if (!past) body.append(h('div.avail-toggle',
      h('button' + (!busy ? '.on.free' : ''), { onclick: async () => { await toggleBusy(day, false); sheet.redraw(); } }, icon('check', 18), 'I’m free'),
      h('button' + (busy ? '.on.busy' : ''), { onclick: async () => { await toggleBusy(day, true); sheet.redraw(); } }, icon('x', 18), 'I’m busy')));

    const all = st.free.length === people.length && people.length > 1;
    body.append(h('div.section',
      h('div.sec-head', h('h4', all ? 'Everyone’s free ✨' : st.free.length + ' of ' + people.length + ' free')),
      h('div.who', st.free.map(p => h('div.who-row', avatar(p, 30), h('span', p.user_id === me() ? p.name + ' (you)' : p.name), h('span.tag.ok', 'free'))),
        st.busy.map(p => h('div.who-row.dim', avatar(p, 30), h('span', p.user_id === me() ? p.name + ' (you)' : p.name), h('span.tag.no', 'busy'))))));

    body.append(h('div.section',
      h('div.sec-head', h('h4', 'Plans'), !past ? h('button.btn.sm.soft', { onclick: () => { sheet.close(); openEventForm({ starts_on: day, ends_on: day }); } }, icon('plus', 16), 'Plan something') : null),
      evs.length ? h('div.stack', evs.map(e => eventCard(e, { compact: true, onopen: () => { sheet.close(); openEventSheet(e.id); } }))) : h('p.muted.small', past ? 'Nothing was planned.' : 'Nothing planned yet.')));

    const noteInput = h('input', { placeholder: 'Add a note for the crew…', maxlength: 500, value: st0.note, oninput: e => (st0.note = e.target.value),
      onkeydown: e => { if (e.key === 'Enter') submit(); } });
    async function submit() {
      const text = st0.note.trim(); if (!text) return;
      await attempt(() => addNote(day, text)); st0.note = ''; sheet.redraw();
    }
    body.append(h('div.section',
      h('div.sec-head', h('h4', 'Notes')),
      notes.length ? h('div.stack-s', notes.map(n => { const p = person(n.user_id); return h('div.note', avatar(p, 24), h('div.note-b', h('b', p.name.split(' ')[0]), ' ', n.body),
        (n.user_id === me() || isAdmin()) ? h('button.iconbtn.xs.ghost', { 'aria-label': 'Delete note', onclick: async () => { await attempt(() => deleteNote(n.id)); sheet.redraw(); } }, icon('x', 14)) : null); })) : null,
      h('div.inline-form', noteInput, h('button.btn.sm.primary', { onclick: submit }, 'Add'))));
  });
}

