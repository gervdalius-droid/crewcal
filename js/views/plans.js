import { h, icon, fmtDay, fmtRange, parseDay, iso, today, addDays, MON, MONTHS, avatar, avatarStack, daysBetween, money, parseJsonArray } from '../util.js';
import { S, render, active, bmap, me, person, rsvpsFor, myRsvp, setRsvp, saveEvent, deleteEvent, attempt, isAdmin, ai, group, toast, friendly } from '../store.js';
import { eventFit, freeWindows, bestDays, tripBudget, bookingLinks, eventsToIcs } from '../logic.js';
import { openSheet, confirmSheet, field, input, select, segmented, chip, empty, spinner, share, download } from '../ui.js';
import { openUpgrade } from './crew.js';
import { openExpenseForm } from './money.js';

export const CATEGORIES = ['Hangout', 'Dinner', 'Nightlife', 'Trip', 'Music', 'Festival', 'Sport', 'Motorsport', 'Outdoors', 'Culture', 'Food', 'Games', 'Other'];
const CAT_EMOJI = { Hangout: '🛋️', Dinner: '🍝', Nightlife: '🍸', Trip: '✈️', Music: '🎧', Festival: '🎪', Sport: '🏟️', Motorsport: '🏁', Outdoors: '🏕️', Culture: '🎭', Food: '🍷', Games: '🎲', Other: '✨' };
export const catEmoji = c => CAT_EMOJI[c] || '✨';
const DISCOVER_CATS = ['Music', 'Festival', 'Sport', 'Motorsport', 'Outdoors', 'Culture', 'Food', 'Nightlife'];

export function plansView() {
  const t = iso(today());
  const planned = S.crew.events.filter(e => e.status === 'planned' && e.ends_on >= t);
  const ideas = S.crew.events.filter(e => e.status === 'idea' && e.ends_on >= t);
  const past = S.crew.events.filter(e => e.status === 'planned' && e.ends_on < t).reverse();
  const P = S.plans;
  const wrap = h('div.view.plans-view');
  wrap.append(h('div.view-head',
    h('h1', 'Plans'),
    h('button.btn.primary', { onclick: () => openEventForm({}) }, icon('plus', 18), h('span.hide-xs', 'New plan'))));
  wrap.append(segmented([['upcoming', 'Upcoming', planned.length || null], ['ideas', 'Ideas', ideas.length || null], ['discover', h('span.row.gap-xs', icon('sparkles', 16, 'iris'), 'Discover')]], P.seg, v => { P.seg = v; render(); }, 'grow mb'));

  if (P.seg === 'upcoming') {
    wrap.append(briefCard(planned, ideas));
    if (!planned.length) wrap.append(empty('calendar', 'Nothing planned yet', 'Pick a day everyone’s free on the calendar, or find something in Discover.',
      h('div.row.gap.center', h('button.btn.primary', { onclick: () => openEventForm({}) }, 'Make a plan'), h('button.btn.soft', { onclick: () => { P.seg = 'discover'; render(); } }, icon('sparkles', 16), 'Discover'))));
    else wrap.append(groupByMonth(planned));
    if (past.length) wrap.append(h('details.past', h('summary', 'Past plans (' + past.length + ')'), h('div.stack', past.slice(0, 30).map(e => eventCard(e)))));
  } else if (P.seg === 'ideas') {
    wrap.append(h('p.muted.mb', 'Ideas are things the crew might do. Each shows how many of you are free — promote the best one to a plan.'));
    if (!ideas.length) wrap.append(empty('star', 'No ideas saved', 'Save ideas from Discover, or add your own.', h('button.btn.soft', { onclick: () => openEventForm({ status: 'idea' }) }, icon('plus', 16), 'Add an idea')));
    else {
      const people = active(), bm = bmap();
      const sorted = ideas.slice().sort((a, b) => eventFit(b, people, bm).ratio - eventFit(a, people, bm).ratio || (a.starts_on < b.starts_on ? -1 : 1));
      wrap.append(h('div.grid-cards', sorted.map(e => eventCard(e))));
      wrap.append(h('button.btn.soft.mt', { onclick: () => openEventForm({ status: 'idea' }) }, icon('plus', 16), 'Add an idea'));
    }
  } else wrap.append(discover());
  return wrap;
}

function groupByMonth(list) {
  const out = h('div.months');
  let cur = null, box;
  for (const e of list) {
    const k = e.starts_on.slice(0, 7);
    if (k !== cur) { cur = k; const d = parseDay(e.starts_on); box = h('div.stack'); out.append(h('div.month-group', h('div.month-label', MONTHS[d.getMonth()] + (d.getFullYear() !== today().getFullYear() ? ' ' + d.getFullYear() : '')), box)); }
    box.append(eventCard(e));
  }
  return out;
}

// ── Event card ───────────────────────────────────────────────
export function eventCard(e, { compact = false, onopen } = {}) {
  const d = parseDay(e.starts_on);
  const people = active();
  const fit = eventFit(e, people, bmap());
  const rs = rsvpsFor(e.id);
  const going = rs.filter(r => r.status === 'going').map(r => person(r.user_id));
  const mine = myRsvp(e.id);
  const isIdea = e.status === 'idea';
  const days = daysBetween(e.starts_on, e.ends_on) + 1;
  const card = h('article.ev-card' + (compact ? '.compact' : '') + (isIdea ? '.idea' : ''), { tabindex: 0, role: 'button', 'aria-label': e.title, onclick: () => (onopen || (() => openEventSheet(e.id)))(), onkeydown: k => { if (k.key === 'Enter') card.click(); } },
    h('div.ev-date', h('span.ev-mon', MON[d.getMonth()]), h('span.ev-day', d.getDate()), days > 1 ? h('span.ev-len', days + 'd') : null),
    h('div.ev-body',
      h('div.ev-cat', catEmoji(e.category), ' ', e.category, e.start_time ? h('span', ' · ' + e.start_time.slice(0, 5)) : null),
      h('div.ev-title', e.title),
      e.location ? h('div.ev-loc', icon('pin', 14), e.location) : null,
      !compact ? h('div.ev-foot',
        isIdea
          ? h('span.fit' + (fit.ratio === 1 ? '.full' : fit.ratio >= 0.6 ? '.good' : ''), fit.free.length + '/' + people.length + ' free')
          : (going.length ? h('span.row.gap-xs', avatarStack(going, 22, 4), h('span.muted.small', going.length + ' going')) : h('span.muted.small', 'No one’s confirmed yet')),
        !isIdea ? h('div.rsvp-mini', ['going', 'maybe', 'no'].map(s => h('button.rs.' + s + (mine === s ? '.on' : ''), { 'aria-label': s, title: s, onclick: ev => { ev.stopPropagation(); setRsvp(e.id, s); } }, s === 'going' ? icon('check', 15) : s === 'maybe' ? '?' : icon('x', 15)))) : null,
        e.price_min ? h('span.price', money(+e.price_min) + (e.price_max && +e.price_max !== +e.price_min ? '–' + money(+e.price_max) : '')) : null,
      ) : null));
  return card;
}

// ── Event sheet ──────────────────────────────────────────────
export function openEventSheet(id) {
  openSheet({ title: '' }, (body, sheet) => {
    const e = S.crew.events.find(x => x.id === id);
    if (!e) { body.append(empty('calendar', 'This plan was deleted')); return; }
    sheet.setTitle(e.status === 'idea' ? 'Idea' : 'Plan');
    const people = active();
    const fit = eventFit(e, people, bmap());
    const rs = rsvpsFor(e.id);
    const mine = myRsvp(e.id);
    const canEdit = e.created_by === me() || isAdmin();
    const creator = person(e.created_by);

    body.append(h('div.ev-hero',
      h('div.ev-hero-cat', catEmoji(e.category), ' ', e.category),
      h('h2.ev-hero-title', e.title),
      h('div.ev-hero-meta',
        h('span', icon('calendar', 16), fmtRange(e.starts_on, e.ends_on) + (e.start_time ? ' · ' + e.start_time.slice(0, 5) + (e.end_time ? '–' + e.end_time.slice(0, 5) : '') : '')),
        e.location ? h('a', { href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location), target: '_blank', rel: 'noopener' }, icon('pin', 16), e.location) : null,
        e.price_min != null && e.price_min !== '' ? h('span', icon('ticket', 16), +e.price_min ? money(+e.price_min) + (e.price_max && +e.price_max !== +e.price_min ? '–' + money(+e.price_max) : '') : 'Free') : null),
      e.note ? h('p.ev-note', e.note) : null,
      e.url ? h('a.link', { href: e.url, target: '_blank', rel: 'noopener' }, icon('link', 15), new URL(e.url, location.href).hostname.replace(/^www\./, '')) : null,
      h('div.muted.small.mt-s', 'Added by ' + (creator.user_id === me() ? 'you' : creator.name))));

    if (e.status === 'idea') {
      body.append(h('div.section', h('div.sec-head', h('h4', fit.free.length + ' of ' + people.length + ' are free then')),
        h('div.who', fit.free.map(p => h('div.who-row', avatar(p, 28), p.name, h('span.tag.ok', 'free'))), fit.busy.map(p => h('div.who-row.dim', avatar(p, 28), p.name, h('span.tag.no', 'busy'))))));
      body.append(h('button.btn.primary.block', { onclick: () => attempt(async () => { await saveEvent({ ...e, status: 'planned' }); sheet.redraw(); }, 'It’s a plan! 🎉') }, icon('check', 18), 'Make it a plan'));
    } else {
      body.append(h('div.section', h('div.sec-head', h('h4', 'Are you in?')),
        h('div.rsvp-big', [['going', 'I’m in', 'check'], ['maybe', 'Maybe', null], ['no', 'Can’t', 'x']].map(([s, l, ic]) =>
          h('button.' + s + (mine === s ? '.on' : ''), { onclick: async () => { await setRsvp(e.id, s); sheet.redraw(); } }, ic ? icon(ic, 18) : h('b', '?'), h('span', l))))));
      const by = s => rs.filter(r => r.status === s).map(r => person(r.user_id));
      const noAnswer = people.filter(p => !rs.some(r => r.user_id === p.user_id));
      body.append(h('div.section', h('div.who',
        by('going').map(p => h('div.who-row', avatar(p, 28), p.name, h('span.tag.ok', 'going'))),
        by('maybe').map(p => h('div.who-row', avatar(p, 28), p.name, h('span.tag.warn', 'maybe'))),
        by('no').map(p => h('div.who-row.dim', avatar(p, 28), p.name, h('span.tag.no', 'can’t'))),
        noAnswer.map(p => h('div.who-row.dim', avatar(p, 28), p.name, h('span.tag', fit.busy.includes(p) ? 'busy then' : 'no answer'))))));
    }

    const spend = S.crew.expenses.filter(x => x.event_id === e.id);
    body.append(h('div.action-grid',
      h('button.action', { onclick: () => { openTripSheet(e); } }, icon('plane', 20), 'Plan the trip'),
      h('button.action', { onclick: () => openExpenseForm({ event_id: e.id, title: '' }) }, icon('wallet', 20), spend.length ? 'Expenses (' + spend.length + ')' : 'Add expense'),
      h('button.action', { onclick: () => download(slug(e.title) + '.ics', eventsToIcs([e], group()?.name), 'text/calendar') }, icon('download', 20), 'Add to calendar'),
      h('button.action', { onclick: () => share({ title: e.title, text: e.title + ' — ' + fmtRange(e.starts_on, e.ends_on) + (e.location ? ' · ' + e.location : ''), url: location.origin + location.pathname + '?tab=plans' }).then(r => r === 'copied' && toast('Copied to clipboard', 'ok')) }, icon('share', 20), 'Share')));

    if (canEdit) body.append(h('div.row.gap.mt',
      h('button.btn.soft.grow', { onclick: () => { sheet.close(true); openEventForm(e); } }, icon('edit', 16), 'Edit'),
      h('button.btn.ghost.danger-text', { onclick: async () => {
        if (await confirmSheet({ title: 'Delete “' + e.title + '”?', text: 'This removes it for the whole crew.', ok: 'Delete', danger: true })) { await attempt(() => deleteEvent(e.id), 'Deleted'); sheet.close(); }
      } }, icon('trash', 16), 'Delete')));
  });
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';

// ── Create / edit form ───────────────────────────────────────
export function openEventForm(pre) {
  const t = iso(today());
  const f = { status: 'planned', title: '', category: 'Hangout', starts_on: t, ends_on: '', start_time: '', end_time: '', location: '', note: '', url: '', price_min: '', ...pre };
  if (!f.ends_on) f.ends_on = f.starts_on;
  f.start_time = f.start_time ? f.start_time.slice(0, 5) : ''; f.end_time = f.end_time ? f.end_time.slice(0, 5) : '';
  let busy = false;
  const s = openSheet({ title: f.id ? 'Edit ' + (f.status === 'idea' ? 'idea' : 'plan') : f.status === 'idea' ? 'New idea' : 'New plan' }, body => {
    const people = active();
    const fitBox = h('div.fit-live');
    const updFit = () => {
      if (!f.starts_on) return fitBox.replaceChildren();
      const ends = f.ends_on && f.ends_on >= f.starts_on ? f.ends_on : f.starts_on;
      const fit = eventFit({ starts_on: f.starts_on, ends_on: ends }, people, bmap());
      fitBox.replaceChildren(people.length > 1 ? h('div.fit-line' + (fit.ratio === 1 ? '.full' : ''), avatarStack(fit.free, 22, 6),
        h('span', fit.ratio === 1 ? 'Everyone’s free then' : fit.free.length + ' of ' + people.length + ' free' + (fit.busy.length ? ' — ' + fit.busy.map(p => p.name.split(' ')[0]).join(', ') + ' busy' : ''))) : '');
    };
    const startIn = input([f, 'starts_on'], { type: 'date', required: true, onchange_: () => { if (!f.ends_on || f.ends_on < f.starts_on) { f.ends_on = f.starts_on; endIn.value = f.ends_on; } updFit(); } });
    const endIn = input([f, 'ends_on'], { type: 'date', onchange_: updFit });
    updFit();
    body.append(
      field('What', input([f, 'title'], { placeholder: f.status === 'idea' ? 'e.g. Road trip to the coast' : 'e.g. Dinner at Maya’s', maxlength: 120, autofocus: true })),
      h('div.cat-pick', CATEGORIES.map(c => h('button.chip' + (f.category === c ? '.on' : ''), { type: 'button', onclick: ev => { f.category = c; ev.currentTarget.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === ev.currentTarget)); } }, catEmoji(c) + ' ' + c))),
      h('div.two', field('From', startIn), field('To', endIn)),
      fitBox,
      h('div.two', field('Starts at', input([f, 'start_time'], { type: 'time' }), 'optional'), field('Ends at', input([f, 'end_time'], { type: 'time' }), 'optional')),
      field('Where', input([f, 'location'], { placeholder: 'Place or city', maxlength: 200 })),
      field('Details', input([f, 'note'], { multiline: true, rows: 3, placeholder: 'What to bring, who books what…', maxlength: 2000 })),
      h('div.two', field('Link', input([f, 'url'], { type: 'url', placeholder: 'https://…' })), field('Cost per person (€)', input([f, 'price_min'], { type: 'number', min: 0, step: '0.01', inputmode: 'decimal', placeholder: '—' }))),
      h('label.check', h('input', { type: 'checkbox', checked: f.status === 'idea', onchange: ev => { f.status = ev.target.checked ? 'idea' : 'planned'; } }), h('span', 'Just an idea for now — don’t ask people to RSVP yet')),
      h('button.btn.primary.block.mt', { onclick: async ev => {
        const btn = ev.currentTarget;
        if (busy) return;
        if (!f.title.trim()) return toast('Give it a name', 'err');
        if (!f.starts_on) return toast('Pick a date', 'err');
        if (f.ends_on < f.starts_on) return toast('End date is before the start', 'err');
        let url = f.url.trim(); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
        busy = true; btn.disabled = true;
        const row = await attempt(() => saveEvent({
          ...(f.id ? { id: f.id } : {}), status: f.status, title: f.title.trim(), category: f.category,
          starts_on: f.starts_on, ends_on: f.ends_on || f.starts_on, start_time: f.start_time || null, end_time: f.end_time || null,
          location: f.location.trim(), note: f.note.trim(), url, price_min: f.price_min === '' ? null : +f.price_min, price_max: f.price_max ?? (f.price_min === '' ? null : +f.price_min),
        }), f.id ? 'Saved' : f.status === 'idea' ? 'Idea saved' : 'Plan created — the crew can RSVP now');
        busy = false;
        if (row) { s.close(); if (!f.id) openEventSheet(row.id); } else btn.disabled = false;
      } }, f.id ? 'Save changes' : f.status === 'idea' ? 'Save idea' : 'Create plan'));
  });
}

// ── Crew brief ───────────────────────────────────────────────
let briefText = { gid: null, text: '' };
function briefCard(planned, ideas) {
  const people = active();
  if (people.length < 2) return h('div.card.brief', h('div.brief-t', 'Your crew is just you so far'), h('p.muted', 'Invite friends from the Crew tab — Whossup gets useful once everyone shares their busy days.'));
  const bm = bmap();
  const wins = freeWindows(people, bm, { horizon: 60, minLen: 1, limit: 3 });
  const next = planned[0];
  const best = bestDays(people, bm, { horizon: 45, limit: 1, weekendsOnly: true })[0];
  const bestIdea = ideas.map(e => ({ e, fit: eventFit(e, people, bm) })).sort((a, b) => b.fit.ratio - a.fit.ratio)[0];
  const card = h('div.card.brief');
  card.append(h('div.brief-head', h('span.brief-badge', icon('sparkles', 14), 'Crew brief'), h('span.muted.small', fmtDay(iso(today()), { relative: false }))));
  const lines = h('div.brief-lines');
  if (next) lines.append(h('div.bl', h('span.bl-k', 'Next up'), h('button.bl-v.linkish', { onclick: () => openEventSheet(next.id) }, next.title + ' · ' + fmtDay(next.starts_on))));
  if (best) lines.append(h('div.bl', h('span.bl-k', 'Best weekend day'), h('span.bl-v', fmtDay(best.day) + ' — ' + best.free.length + '/' + people.length + ' free')));
  if (wins[0] && wins[0].days > 1) lines.append(h('div.bl', h('span.bl-k', 'Longest window'), h('span.bl-v', fmtRange(wins[0].from, wins[0].to) + ' · everyone')));
  if (bestIdea) lines.append(h('div.bl', h('span.bl-k', 'Best-fitting idea'), h('button.bl-v.linkish', { onclick: () => openEventSheet(bestIdea.e.id) }, bestIdea.e.title + ' · ' + bestIdea.fit.free.length + '/' + people.length)));
  card.append(lines);
  const out = h('div.brief-ai');
  if (briefText.gid === S.gid && briefText.text) out.append(h('p', briefText.text));
  const btn = h('button.btn.sm.soft', { onclick: async () => {
    btn.disabled = true; out.replaceChildren(spinner('Thinking…'));
    try {
      const facts = {
        crewSize: people.length, today: iso(today()),
        windows: bestDays(people, bm, { horizon: 45, limit: 4 }).map(b => ({ label: fmtDay(b.day, { relative: false }), free: b.free.length })),
        planned: planned.slice(0, 3).map(e => ({ title: e.title, when: fmtRange(e.starts_on, e.ends_on) })),
        ideas: ideas.slice(0, 5).map(e => ({ title: e.title, when: fmtRange(e.starts_on, e.ends_on), free: eventFit(e, people, bm).free.length })),
      };
      briefText = { gid: S.gid, text: await ai('brief', { facts }) };
      out.replaceChildren(h('p', briefText.text));
    } catch (e) { out.replaceChildren(); aiError(e); }
    btn.disabled = false;
  } }, icon('sparkles', 15, 'iris'), briefText.text && briefText.gid === S.gid ? 'Ask again' : 'What should we do next?');
  card.append(out, btn);
  return card;
}

export function aiError(e) {
  if (e?.message === 'quota') openUpgrade('You’ve used all ' + (e.quota?.limit || S.usage.limit) + ' AI searches this month.');
  else toast(friendly(e), 'err');
}

// ── Discover (AI) ────────────────────────────────────────────
function looksLikeRequest(t) {
  t = (t || '').trim();
  return t.split(/\s+/).length > 3 || /\d|event|race|concert|festival|match|gig|show|grand prix|\bf1\b/i.test(t);
}

function discover() {
  const P = S.plans;
  if (!P.months.length) { const m = today().getMonth(); P.months = [m, (m + 1) % 12, (m + 2) % 12]; }
  const box = h('div.discover');
  const quota = h('div.quota', h('span', icon('sparkles', 14, 'iris'), (S.usage.limit - S.usage.used) + ' AI searches left this month'), S.profile?.plan !== 'pro' ? h('button.linkish', { onclick: () => openUpgrade() }, 'Go Pro') : null);
  box.append(h('div.row.between.wrap.gap', segmented([['events', 'Events & trips'], ['places', 'Places nearby']], P.mode, v => { P.mode = v; P.error = ''; render(); }), quota));

  const q = h('input.search-in', { id: 'q-search', placeholder: P.mode === 'events' ? 'Anything — “techno in Berlin”, “F1”, “Christmas markets”…' : 'e.g. “bars for 8 people in Vilnius”', value: P.query, oninput: e => (P.query = e.target.value), onkeydown: e => { if (e.key === 'Enter') run(); } });
  box.append(h('div.searchbar', icon('search', 20), q, h('button.btn.primary', { onclick: run, disabled: P.loading }, P.loading ? 'Searching…' : 'Search')));

  if (P.mode === 'events') {
    const yNow = today().getFullYear(), mNow = today().getMonth();
    box.append(h('div.filter-row', h('span.flabel', 'When'), h('div.chips', Array.from({ length: 12 }, (_, i) => (mNow + i) % 12).map(m =>
      chip(MON[m] + (m < mNow ? ' ’' + String(yNow + 1).slice(2) : ''), P.months.includes(m), () => { P.months = P.months.includes(m) ? P.months.filter(x => x !== m) : [...P.months, m]; render(); })))));
    box.append(h('div.filter-row', h('span.flabel', 'Into'), h('div.chips', DISCOVER_CATS.map(c => chip(catEmoji(c) + ' ' + c, P.cats.includes(c), () => { P.cats = P.cats.includes(c) ? P.cats.filter(x => x !== c) : [...P.cats, c]; render(); })))));
    box.append(h('div.filter-row', h('span.flabel', 'Where'), h('input.near-in', { id: 'q-near', placeholder: 'Optional — a city or country, e.g. Europe, Berlin', value: P.near, oninput: e => (P.near = e.target.value) })));
  }

  if (P.loading) box.append(h('div.skel-list', Array.from({ length: 4 }, () => h('div.skel'))));
  else if (P.error) box.append(h('div.err-box', P.error));
  else if (P.mode === 'events' && P.results.length) box.append(h('div.results', P.results.map(resultCard)));
  else if (P.mode === 'places' && P.places.length) box.append(h('div.results', P.places.map(placeCard)));
  else if (!P.searched) box.append(h('div.discover-empty', icon('compass', 32), h('p', P.mode === 'events' ? 'Find concerts, races, festivals and city breaks — then see instantly which ones your crew is free for.' : 'Find a bar, restaurant or activity that works for a group.')));
  if (S.api.demo && (P.results.length || P.places.length)) box.append(h('p.muted.small.center', 'Demo mode: sample results. Real searches use live web data.'));
  return box;

  async function run() {
    if (P.loading) return;
    if (P.mode === 'places' && !P.query.trim()) return toast('Say what you’re looking for', 'err');
    // A whole request typed into "Where" (e.g. "f1 events in spring 2027 in europe") is really the search.
    if (P.mode === 'events' && !P.query.trim() && looksLikeRequest(P.near)) { P.query = P.near.trim(); P.near = ''; }
    P.loading = true; P.error = ''; P.searched = true; render();
    try {
      const mNow = today().getMonth(), yNow = today().getFullYear();
      if (P.mode === 'events') {
        // Month chips run from this month forward, so earlier month numbers mean next year.
        const months = (P.months.length ? P.months : [mNow]).map(m => (m < mNow ? yNow + 1 : yNow) + '-' + String(m + 1).padStart(2, '0')).sort();
        const text = await ai('events', { query: P.query, months, categories: P.cats, near: P.near });
        const arr = parseJsonArray(text);
        if (!arr?.length) throw new Error('No results — try different words');
        const t = iso(today());
        P.results = arr.map(normalizeResult).filter(r => r && r.ends_on >= t).sort((a, b) => a.starts_on < b.starts_on ? -1 : 1);
        if (!P.results.length) throw new Error('Nothing upcoming found — try other months');
      } else {
        const arr = parseJsonArray(await ai('places', { query: P.query }));
        if (!arr?.length) throw new Error('No places found — try rephrasing');
        P.places = arr.slice(0, 12);
      }
    } catch (e) { if (e.message === 'quota') aiError(e); else P.error = friendly(e); }
    P.loading = false; render();
  }
}

function normalizeResult(r) {
  const ok = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  if (!r?.title || !ok(r.starts_on)) return null;
  const ends = ok(r.ends_on) && r.ends_on >= r.starts_on ? r.ends_on : r.starts_on;
  let url = String(r.url || ''); if (url && !/^https?:\/\//.test(url)) url = 'https://' + url;
  if (/example\.com/.test(url)) url = '';
  const num = v => (v == null || v === '' || isNaN(+v)) ? null : +v;
  return { title: String(r.title).slice(0, 120), category: CATEGORIES.includes(r.category) ? r.category : 'Other', location: String(r.location || '').slice(0, 200), starts_on: r.starts_on, ends_on: ends, price_min: num(r.price_min), price_max: num(r.price_max), url, note: String(r.blurb || '').slice(0, 400) };
}

function resultCard(r) {
  const people = active(), fit = eventFit(r, people, bmap());
  const saved = S.crew.events.find(e => e.title === r.title && e.starts_on === r.starts_on);
  const d = parseDay(r.starts_on);
  return h('article.res-card',
    h('div.ev-date', h('span.ev-mon', MON[d.getMonth()]), h('span.ev-day', d.getDate())),
    h('div.res-body',
      h('div.ev-cat', catEmoji(r.category), ' ', r.category),
      h('div.ev-title', r.title),
      h('div.ev-loc', icon('pin', 14), r.location, ' · ', fmtRange(r.starts_on, r.ends_on)),
      r.note ? h('p.res-blurb', r.note) : null,
      h('div.res-foot',
        h('span.fit' + (fit.ratio === 1 ? '.full' : fit.ratio >= 0.6 ? '.good' : ''), fit.free.length + '/' + people.length + ' free'),
        r.price_min != null ? h('span.price', r.price_min ? money(r.price_min) + (r.price_max && r.price_max !== r.price_min ? '–' + money(r.price_max) : '') : 'Free') : null,
        r.url ? h('a.linkish', { href: r.url, target: '_blank', rel: 'noopener' }, 'Website') : null,
        h('span.grow'),
        saved ? h('button.btn.sm.ghost', { onclick: () => openEventSheet(saved.id) }, icon('check', 15), 'Saved')
              : h('button.btn.sm.soft', { onclick: async () => { const row = await attempt(() => saveEvent({ ...r, status: 'idea' }), 'Saved to Ideas'); if (row) render(); } }, icon('star', 15), 'Save idea'),
        h('button.btn.sm.ghost', { 'aria-label': 'Plan the trip', onclick: () => openTripSheet(r) }, icon('plane', 16)))));
}

function placeCard(p) {
  const q = encodeURIComponent([p.name, p.address, p.city].filter(Boolean).join(', '));
  return h('article.res-card.place',
    h('div.place-ic', icon(p.type === 'bar' || p.type === 'club' ? 'star' : p.type === 'activity' ? 'bolt' : 'pin', 22)),
    h('div.res-body',
      h('div.ev-cat', String(p.type || 'place'), p.price ? ' · ' + p.price : '', p.rating ? ' · ★ ' + p.rating : ''),
      h('div.ev-title', p.name),
      p.address ? h('div.ev-loc', icon('pin', 14), p.address) : null,
      p.blurb ? h('p.res-blurb', p.blurb) : null,
      h('div.res-foot',
        p.hours ? h('span.muted.small', icon('clock', 13), ' ', p.hours) : null,
        h('span.grow'),
        h('a.btn.sm.ghost', { href: 'https://www.google.com/maps/search/?api=1&query=' + q, target: '_blank', rel: 'noopener' }, 'Map'),
        h('a.btn.sm.ghost', { href: 'https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=' + q, target: '_blank', rel: 'noopener' }, 'Ride'),
        h('button.btn.sm.soft', { onclick: () => openEventForm({ title: p.name, location: [p.address, p.city].filter(Boolean).join(', '), category: p.type === 'restaurant' ? 'Dinner' : p.type === 'bar' || p.type === 'club' ? 'Nightlife' : 'Hangout', note: p.blurb || '' }) }, icon('plus', 15), 'Plan it'))));
}

// ── Trip planner ─────────────────────────────────────────────
export function openTripSheet(ev) {
  const going = ev.id ? rsvpsFor(ev.id).filter(r => r.status === 'going').length : 0;
  const t = { origin: localStorage.getItem('whossup-origin') || '', guests: Math.max(2, going || active().length || 2), summary: null, loading: false, error: '' };
  const nights = Math.max(1, daysBetween(ev.starts_on, ev.ends_on) || 1);
  openSheet({ title: 'Plan the trip', wide: true }, (body, sheet) => {
    const b = tripBudget(ev.location, nights, t.guests, ev.price_min ? +ev.price_min : 0);
    body.append(h('div.trip-head', h('div.ev-cat', catEmoji(ev.category), ' ', ev.title), h('div.trip-where', icon('pin', 16), ev.location || 'Somewhere great', ' · ', fmtRange(ev.starts_on, ev.ends_on), ' · ', nights + ' night' + (nights > 1 ? 's' : ''))));
    const originIn = h('input', { placeholder: 'e.g. Vilnius', value: t.origin, oninput: e => { t.origin = e.target.value; try { localStorage.setItem('whossup-origin', t.origin); } catch {} }, onchange: () => sheet.redraw() });
    body.append(h('div.two', field('Flying from', originIn), field('People', h('div.stepper', h('button', { 'aria-label': 'Fewer', onclick: () => { t.guests = Math.max(1, t.guests - 1); sheet.redraw(); } }, '−'), h('span', t.guests), h('button', { 'aria-label': 'More', onclick: () => { t.guests = Math.min(30, t.guests + 1); sheet.redraw(); } }, '+')))));

    body.append(h('div.budget',
      h('div.budget-total', h('span.muted.small', 'Rough cost per person'), h('span.big', '≈ ' + money(b.total))),
      h('div.budget-rows', [['Travel', b.travel, 'plane'], ['Stay', b.stay, 'bed'], ['Food & drinks', b.food, 'star'], ['Activities', b.fun, 'bolt'], b.ticket ? ['Tickets', b.ticket, 'ticket'] : null].filter(Boolean).map(([k, v, ic]) =>
        h('div.brow', icon(ic, 16), h('span', k), h('span.grow'), h('b', money(v))))),
      h('p.muted.tiny', 'Estimate from typical prices for the destination. Check the links for real prices.')));

    body.append(h('div.links-grid', bookingLinks({ location: ev.location, starts_on: ev.starts_on, ends_on: ev.ends_on, guests: t.guests, origin: t.origin }).map(l =>
      h('a.link-card', { href: l.url, target: '_blank', rel: 'noopener sponsored' }, icon(l.icon, 20), h('span.lc-t', l.label), h('span.lc-s', l.sub)))));

    const aiBox = h('div.ai-box');
    if (t.summary) aiBox.append(h('div.ai-head', icon('sparkles', 15, 'iris'), 'Local tips'), h('p', t.summary));
    else if (t.loading) aiBox.append(spinner('Writing your trip brief…'));
    else aiBox.append(h('button.btn.soft.block', { onclick: async () => {
      t.loading = true; sheet.redraw();
      try { t.summary = await ai('trip', { title: ev.title, location: ev.location, starts_on: ev.starts_on, ends_on: ev.ends_on, origin: t.origin, guests: t.guests }); }
      catch (e) { aiError(e); }
      t.loading = false; sheet.redraw();
    } }, icon('sparkles', 16, 'iris'), 'Get local tips from AI'));
    body.append(aiBox);
    if (!ev.id) body.append(h('button.btn.primary.block.mt', { onclick: async () => { const row = await attempt(() => saveEvent({ ...ev, status: 'idea' }), 'Saved to Ideas'); if (row) sheet.close(); } }, icon('star', 16), 'Save as idea for the crew'));
  });
}

