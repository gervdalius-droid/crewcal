// App state + every action that talks to the backend.
// Views read `S` and call actions; actions mutate `S` and call render().
import { iso, today, addDays, parseDay, todayIso } from './util.js';
import { busyMap } from './logic.js';

export const S = {
  api: null,
  user: null, profile: null,
  groups: [], gid: null,
  screen: 'boot',          // boot | welcome | auth | profile | crew | pending | app
  tab: 'calendar',         // calendar | plans | chat | money | crew
  crew: emptyCrew(),
  cal: { y: today().getFullYear(), m: today().getMonth(), mark: false, weekendsOnly: false },
  plans: { seg: 'upcoming', mode: 'events', query: '', months: [], cats: [], near: '', results: [], places: [], loading: false, error: '', searched: false },
  chat: { draft: '', unread: 0 },
  usage: { used: 0, limit: 25 },
  pendingInvite: null,     // invite code from ?join= waiting for sign-in
  online: navigator.onLine,
  syncing: false,
};

function emptyCrew() { return { gid: null, loaded: false, members: [], busy: [], events: [], rsvps: [], notes: [], messages: [], expenses: [], settlements: [] }; }

let renderFn = () => {};
export function setRender(fn) { renderFn = fn; }
export function render() { renderFn(); }

// ── Toasts ───────────────────────────────────────────────────
let toastTimer;
export function toast(msg, kind = '') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast show ' + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast ' + kind), 2600);
}
// Run an action, surfacing any error as a toast. Returns the result or undefined.
export async function attempt(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg, 'ok'); return r; }
  catch (e) { console.warn(e); toast(friendly(e), 'err'); }
}
export function friendly(e) {
  const m = String(e?.message || e || 'Something went wrong');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'You seem to be offline — try again in a moment';
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first — check your inbox';
  if (/User already registered/i.test(m)) return 'That email already has an account — sign in instead';
  if (/row-level security|permission denied/i.test(m)) return "You don't have permission to do that";
  if (/rate limit/i.test(m)) return 'Too many attempts — wait a minute and try again';
  return m;
}

// ── Derived ──────────────────────────────────────────────────
export const me = () => S.user?.id;
export const group = () => S.groups.find(g => g.id === S.gid);
export const isAdmin = () => group()?.role === 'admin';
export const active = () => S.crew.members.filter(m => m.status === 'active');
export const pending = () => S.crew.members.filter(m => m.status === 'pending');
export const person = id => S.crew.members.find(m => m.user_id === id) || (id === me() && S.profile ? { user_id: id, name: S.profile.name, color: S.profile.color } : { user_id: id, name: 'Former member', color: '#6b6b78' });
let bmCache = { src: null, map: {} };
export function bmap() { if (bmCache.src !== S.crew.busy) bmCache = { src: S.crew.busy, map: busyMap(S.crew.busy) }; return bmCache.map; }
export const iAmBusy = day => !!bmap()[day]?.has(me());
export const rsvpsFor = id => S.crew.rsvps.filter(r => r.event_id === id);
export const myRsvp = id => S.crew.rsvps.find(r => r.event_id === id && r.user_id === me())?.status || null;

// ── Boot / session ───────────────────────────────────────────
export async function boot(api) {
  S.api = api;
  const q = new URLSearchParams(location.search);
  const join = q.get('join');
  if (join) { S.pendingInvite = join.toUpperCase(); try { sessionStorage.setItem('whossup-join', S.pendingInvite); } catch {} }
  else try { S.pendingInvite = sessionStorage.getItem('whossup-join'); } catch {}
  const tab = q.get('tab'); if (['calendar', 'plans', 'chat', 'money', 'crew'].includes(tab)) S.tab = tab;
  if (join || tab) history.replaceState(null, '', location.pathname + (q.get('demo') ? '?demo=1' : ''));

  api.onAuthChange((ev, user) => {
    if (ev === 'SIGNED_OUT') { S.user = null; S.screen = 'welcome'; render(); }
    if (ev === 'PASSWORD_RECOVERY') { S.recovery = true; render(); }
  });
  S.user = await api.getSession().catch(() => null);
  if (!S.user) { S.screen = 'welcome'; render(); return; }
  await afterSignIn();
}

export async function afterSignIn() {
  S.user = await S.api.getSession();
  S.profile = await S.api.getProfile().catch(() => null);
  if (!S.profile) { S.screen = 'profile'; render(); return; }
  await refreshGroups();
  if (S.pendingInvite) { render(); return; } // app.js shows the join sheet
  route();
}

export async function refreshGroups() {
  S.groups = await S.api.myGroups();
  let saved; try { saved = localStorage.getItem('whossup-gid'); } catch {}
  const usable = S.groups.filter(g => g.status === 'active');
  if (!S.groups.find(g => g.id === S.gid)) S.gid = (usable.find(g => g.id === saved) || usable[0] || S.groups[0])?.id || null;
}

// Decide which screen to show from groups + membership status.
export function route() {
  const g = group();
  if (!S.groups.length) S.screen = 'crew';
  else if (g?.status === 'pending') S.screen = 'pending';
  else { S.screen = 'app'; if (S.crew.gid !== S.gid) loadCrew(); }
  render();
}

export async function switchCrew(gid) {
  S.gid = gid; try { localStorage.setItem('whossup-gid', gid); } catch {}
  S.crew = emptyCrew(); S.plans.results = []; S.plans.places = []; S.chat.unread = 0;
  route();
}

// ── Crew data ────────────────────────────────────────────────
let unsub = null;
export async function loadCrew(quiet = false) {
  const gid = S.gid; if (!gid) return;
  if (!quiet) { S.syncing = true; render(); }
  try {
    const api = S.api;
    const [members, events, notes, messages, expenses, settlements, usage] = await Promise.all([
      api.members(gid), api.events(gid), api.notes(gid), api.messages(gid), api.expenses(gid), api.settlements(gid), api.aiUsage().catch(() => S.usage),
    ]);
    const from = iso(addDays(today(), -45)), to = iso(addDays(today(), 400));
    const [busy, rsvps] = await Promise.all([
      api.busy(members.filter(m => m.status === 'active').map(m => m.user_id), from, to),
      api.rsvps(events.map(e => e.id)),
    ]);
    if (gid !== S.gid) return; // crew switched mid-load
    const firstLoad = S.crew.gid !== gid;
    Object.assign(S.crew, { gid, loaded: true, members, events, notes, messages, expenses, settlements, busy, rsvps });
    S.usage = usage;
    if (firstLoad) {
      if (unsub) unsub();
      unsub = api.subscribe(gid, onMessage);
      S.chat.unread = countUnread();
    }
  } catch (e) { toast(friendly(e), 'err'); }
  S.syncing = false; render();
}

function seenKey() { return 'whossup-seen-' + S.gid; }
function countUnread() {
  let seen = 0; try { seen = +localStorage.getItem(seenKey()) || 0; } catch {}
  return S.crew.messages.filter(m => m.id > seen && m.user_id !== me()).length;
}
export function markChatSeen() {
  const last = S.crew.messages.at(-1); if (!last) return;
  try { localStorage.setItem(seenKey(), String(last.id)); } catch {}
  S.chat.unread = 0;
}
function onMessage(m) {
  if (m.group_id !== S.gid || S.crew.messages.some(x => x.id === m.id)) return;
  S.crew.messages.push(m);
  if (S.tab === 'chat' && document.visibilityState === 'visible') markChatSeen();
  else if (m.user_id !== me()) S.chat.unread++;
  render();
}

// ── Availability actions ─────────────────────────────────────
export async function toggleBusy(day, force) {
  const on = force ?? !iAmBusy(day);
  const before = S.crew.busy;
  S.crew.busy = on ? [...before.filter(b => !(b.user_id === me() && b.day === day)), { user_id: me(), day, source: 'manual' }]
                   : before.filter(b => !(b.user_id === me() && b.day === day));
  render(); // optimistic
  try { await S.api.setBusy(day, on); }
  catch (e) { S.crew.busy = before; render(); toast(friendly(e), 'err'); }
}
export async function importBusy(days) {
  await S.api.addBusyDays(days, 'import');
  await loadCrew(true);
}
export async function clearImported() { await S.api.clearImported(); await loadCrew(true); }

// ── Events ───────────────────────────────────────────────────
export async function saveEvent(ev) {
  const row = await S.api.saveEvent({ ...ev, group_id: S.gid });
  const i = S.crew.events.findIndex(e => e.id === row.id);
  if (i >= 0) S.crew.events[i] = row; else S.crew.events.push(row);
  S.crew.events.sort((a, b) => a.starts_on < b.starts_on ? -1 : 1);
  if (!ev.id && row.status === 'planned' && !myRsvp(row.id)) await setRsvp(row.id, 'going');
  render(); return row;
}
export async function deleteEvent(id) {
  await S.api.deleteEvent(id);
  S.crew.events = S.crew.events.filter(e => e.id !== id);
  S.crew.rsvps = S.crew.rsvps.filter(r => r.event_id !== id);
  render();
}
export async function setRsvp(eventId, status) {
  const before = S.crew.rsvps;
  const next = myRsvp(eventId) === status ? null : status;
  S.crew.rsvps = before.filter(r => !(r.event_id === eventId && r.user_id === me()));
  if (next) S.crew.rsvps.push({ event_id: eventId, user_id: me(), status: next });
  render();
  try { await S.api.setRsvp(eventId, next); } catch (e) { S.crew.rsvps = before; render(); toast(friendly(e), 'err'); }
}

// ── Notes ────────────────────────────────────────────────────
export async function addNote(day, body) { const n = await S.api.addNote(S.gid, day, body); S.crew.notes.push(n); render(); }
export async function deleteNote(id) { await S.api.deleteNote(id); S.crew.notes = S.crew.notes.filter(n => n.id !== id); render(); }

// ── Chat ─────────────────────────────────────────────────────
export async function sendMessage(body) {
  const text = body.trim(); if (!text) return;
  const temp = { id: 1e15 + Date.now(), group_id: S.gid, user_id: me(), body: text, created_at: new Date().toISOString(), sending: true };
  S.crew.messages.push(temp); render();
  try {
    const m = await S.api.sendMessage(S.gid, text);
    const i = S.crew.messages.indexOf(temp);
    if (S.crew.messages.some(x => x.id === m.id)) S.crew.messages.splice(i, 1); // realtime beat us to it
    else S.crew.messages[i] = m;
    markChatSeen();
  } catch (e) { temp.failed = true; temp.sending = false; toast(friendly(e), 'err'); }
  render();
}

// ── Money ────────────────────────────────────────────────────
export async function addExpense(e) { const row = await S.api.addExpense({ ...e, group_id: S.gid }); S.crew.expenses.unshift({ ...row, amount: +row.amount }); render(); }
export async function deleteExpense(id) { await S.api.deleteExpense(id); S.crew.expenses = S.crew.expenses.filter(e => e.id !== id); render(); }
export async function addSettlement(s) { const row = await S.api.addSettlement({ ...s, group_id: S.gid }); S.crew.settlements.unshift({ ...row, amount: +row.amount }); render(); }
export async function deleteSettlement(id) { await S.api.deleteSettlement(id); S.crew.settlements = S.crew.settlements.filter(s => s.id !== id); render(); }

// ── Crew admin ───────────────────────────────────────────────
export async function approve(uid) { await S.api.setMember(S.gid, uid, { status: 'active' }); await loadCrew(true); }
export async function decline(uid) { await S.api.removeMember(S.gid, uid); await loadCrew(true); }
export async function setRole(uid, role) { await S.api.setMember(S.gid, uid, { role }); await loadCrew(true); }
export async function removeMember(uid) { await S.api.removeMember(S.gid, uid); await loadCrew(true); }
export async function leaveCrew() {
  await S.api.removeMember(S.gid, me());
  S.gid = null; S.crew = emptyCrew(); await refreshGroups(); route();
}
export async function deleteCrew() {
  await S.api.deleteGroup(S.gid);
  S.gid = null; S.crew = emptyCrew(); await refreshGroups(); route();
}
export async function updateCrew(patch) { await S.api.updateGroup(S.gid, patch); Object.assign(group(), patch); render(); }
export async function rotateInvite() { const c = await S.api.rotateInvite(S.gid); group().invite_code = c; render(); return c; }
export async function createCrew(name, emoji) {
  const g = await S.api.createGroup(name, emoji);
  await refreshGroups(); await switchCrew(g.id); return g;
}
export async function joinCrew(code) {
  const r = await S.api.joinGroup(code);
  S.pendingInvite = null; try { sessionStorage.removeItem('whossup-join'); } catch {}
  await refreshGroups(); await switchCrew(r.group_id); return r;
}
export function inviteLink(code = group()?.invite_code) {
  return location.origin + location.pathname + '?join=' + code;
}

// ── AI ───────────────────────────────────────────────────────
export async function ai(kind, params) {
  const r = await S.api.ai(kind, { ...params, group_id: S.gid });
  if (r.used != null) S.usage = { used: r.used, limit: r.limit ?? S.usage.limit };
  return r.text;
}

// ── Refresh when the app comes back to the foreground ────────
let lastRefresh = 0;
export function wakeRefresh() {
  if (S.screen !== 'app' || Date.now() - lastRefresh < 20000) return;
  lastRefresh = Date.now(); loadCrew(true);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeRefresh(); });
window.addEventListener('online', () => { S.online = true; render(); wakeRefresh(); });
window.addEventListener('offline', () => { S.online = false; render(); });
setInterval(() => { if (document.visibilityState === 'visible') wakeRefresh(); }, 60000);

export { parseDay, todayIso };
