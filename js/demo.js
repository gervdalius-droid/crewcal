// In-browser backend with the same interface as SupabaseApi.
// Used by "Try the demo" (?demo=1) and by test.html. Data lives in localStorage
// (or only in memory when persist:false), seeded relative to today.
import { iso, addDays, today, uid, sleep, parseDay, MONTHS } from './util.js';
import { AI_FREE_MONTHLY } from './config.js';

const KEY = 'whossup-demo-v1';
const ME = 'u-me';

function seed() {
  const t = today(), d = n => iso(addDays(t, n));
  const people = [
    { id: ME, name: 'Alex Morgan', color: '#8b7cff' },
    { id: 'u-maya', name: 'Maya Chen', color: '#ff7aa8' },
    { id: 'u-jonas', name: 'Jonas Petraitis', color: '#4fd1c5' },
    { id: 'u-lina', name: 'Lina Novak', color: '#ffb454' },
    { id: 'u-tom', name: 'Tom Byrne', color: '#5eb3ff' },
    { id: 'u-ema', name: 'Ema Kalnina', color: '#7ee08a' },
    { id: 'u-rokas', name: 'Rokas Vaitkus', color: '#ff8f6b' },
  ];
  const g1 = 'g-weekend', g2 = 'g-climb';
  const groups = [
    { id: g1, name: 'Weekend Crew', emoji: '🪩', invite_code: 'DISCO7', require_approval: true, created_by: ME, created_at: d(-120) },
    { id: g2, name: 'Climbing Club', emoji: '🧗', invite_code: 'CRUX42', require_approval: false, created_by: 'u-lina', created_at: d(-60) },
  ];
  const members = [
    ...['u-me', 'u-maya', 'u-jonas', 'u-lina', 'u-tom', 'u-ema'].map((u, i) => ({ group_id: g1, user_id: u, role: i === 0 ? 'admin' : 'member', status: 'active', created_at: d(-100 + i) })),
    { group_id: g1, user_id: 'u-rokas', role: 'member', status: 'pending', created_at: d(-1) },
    ...['u-lina', 'u-me', 'u-tom'].map((u, i) => ({ group_id: g2, user_id: u, role: i === 0 ? 'admin' : 'member', status: 'active', created_at: d(-50 + i) })),
  ];
  // Deterministic "random" busy days, with a couple of weekends left fully open.
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const busy = [];
  const openDays = new Set();
  for (let i = 0; i < 70; i++) { const x = addDays(t, i); if (x.getDay() === 6 && (i > 8 && i < 16 || i > 28 && i < 36)) { openDays.add(iso(x)); openDays.add(iso(addDays(x, 1))); } }
  for (const p of people) for (let i = -10; i < 140; i++) {
    const day = d(i), wd = addDays(t, i).getDay();
    if (openDays.has(day)) continue;
    const pBusy = (wd === 0 || wd === 6) ? 0.22 : 0.34;
    if (rnd() < pBusy) busy.push({ user_id: p.id, day, source: p.id === ME && rnd() < 0.3 ? 'import' : 'manual' });
  }
  const nextDow = (want) => { for (let i = 1; i < 8; i++) if (addDays(t, i).getDay() === want) return i; return 1; };
  const fri = nextDow(5);
  const sat2 = [...openDays].sort()[0];
  const events = [
    { id: 'e1', group_id: g1, created_by: 'u-maya', status: 'planned', title: 'Friday drinks', category: 'Nightlife', starts_on: d(fri), ends_on: d(fri), start_time: '19:30', end_time: null, location: 'Old Town, Vilnius', note: 'First round on Tom — he lost the bet.', url: '', price_min: null, price_max: null, created_at: d(-3) },
    { id: 'e2', group_id: g1, created_by: ME, status: 'planned', title: 'Cabin weekend', category: 'Outdoors', starts_on: sat2, ends_on: iso(addDays(parseDay(sat2), 1)), start_time: null, end_time: null, location: 'Trakai, Lithuania', note: 'Sauna, lake, board games. Bring sleeping bags.', url: '', price_min: 60, price_max: 60, created_at: d(-9) },
    { id: 'e3', group_id: g1, created_by: 'u-jonas', status: 'idea', title: 'Riga Christmas Market', category: 'Festival', starts_on: d(26), ends_on: d(27), start_time: null, end_time: null, location: 'Riga, Latvia', note: '', url: 'https://www.liveriga.com', price_min: 0, price_max: 0, created_at: d(-2) },
    { id: 'e4', group_id: g1, created_by: 'u-lina', status: 'idea', title: 'Ski trip', category: 'Outdoors', starts_on: d(68), ends_on: d(72), start_time: null, end_time: null, location: 'Zakopane, Poland', note: 'Cheap lift passes, good food.', url: '', price_min: 45, price_max: 60, created_at: d(-1) },
    { id: 'e5', group_id: g2, created_by: 'u-lina', status: 'planned', title: 'Bouldering session', category: 'Sport', starts_on: d(nextDow(2)), ends_on: d(nextDow(2)), start_time: '18:00', end_time: '20:30', location: 'Climbing gym', note: '', url: '', price_min: 12, price_max: 12, created_at: d(-4) },
  ];
  const rsvps = [
    { event_id: 'e1', user_id: 'u-maya', status: 'going' }, { event_id: 'e1', user_id: 'u-tom', status: 'going' },
    { event_id: 'e1', user_id: 'u-jonas', status: 'maybe' }, { event_id: 'e1', user_id: 'u-ema', status: 'no' },
    { event_id: 'e2', user_id: ME, status: 'going' }, { event_id: 'e2', user_id: 'u-maya', status: 'going' },
    { event_id: 'e2', user_id: 'u-lina', status: 'going' }, { event_id: 'e2', user_id: 'u-jonas', status: 'going' },
    { event_id: 'e5', user_id: 'u-lina', status: 'going' },
  ];
  const notes = [
    { id: 'n1', group_id: g1, user_id: 'u-tom', day: d(fri), body: 'I can only join after 21:00', created_at: d(-1) },
    { id: 'n2', group_id: g1, user_id: 'u-maya', day: sat2, body: 'I will bring the car — 4 seats', created_at: d(-2) },
  ];
  const ago = m => new Date(Date.now() - m * 60000).toISOString();
  const msgs = [
    ['u-jonas', 'Who is in for the cabin? Need numbers for the booking', 60 * 26],
    ['u-maya', 'Me! Already marked the weekend free 🙌', 60 * 25.5],
    ['u-lina', 'In. Can someone check the sauna is included?', 60 * 25],
    [ME, 'It is — I asked the owner. Deposit is €240, I paid it', 60 * 24],
    ['u-tom', 'legend. Added it to expenses?', 60 * 23.8],
    [ME, 'Yep, split between the four of us going', 60 * 23.7],
    ['u-ema', 'Sorry I am away that weekend 😭 next time', 60 * 5],
    ['u-maya', 'Friday drinks still on?', 42],
    ['u-tom', 'Yes! Old Town, 19:30. First round on me apparently', 35],
  ];
  let mid = 1;
  const messages = msgs.map(([u, b, m]) => ({ id: mid++, group_id: g1, user_id: u, body: b, created_at: ago(m) }));
  messages.push({ id: mid++, group_id: g2, user_id: 'u-lina', body: 'New problems set on the overhang wall 👀', created_at: ago(300) });
  const expenses = [
    { id: 'x1', group_id: g1, event_id: 'e2', created_by: ME, title: 'Cabin deposit', amount: 240, currency: 'EUR', paid_by: ME, split_with: [ME, 'u-maya', 'u-lina', 'u-jonas'], created_at: ago(60 * 24) },
    { id: 'x2', group_id: g1, event_id: 'e2', created_by: 'u-maya', title: 'Groceries & drinks', amount: 86.4, currency: 'EUR', paid_by: 'u-maya', split_with: [ME, 'u-maya', 'u-lina', 'u-jonas'], created_at: ago(60 * 20) },
    { id: 'x3', group_id: g1, event_id: null, created_by: 'u-tom', title: 'Concert tickets', amount: 135, currency: 'EUR', paid_by: 'u-tom', split_with: ['u-tom', ME, 'u-ema'], created_at: ago(60 * 24 * 12) },
  ];
  const settlements = [
    { id: 's1', group_id: g1, from_user: 'u-ema', to_user: 'u-tom', amount: 45, currency: 'EUR', created_by: 'u-ema', created_at: ago(60 * 24 * 10) },
  ];
  return {
    profiles: people.map(p => ({ ...p, plan: 'free' })), groups, members, busy, events, rsvps, notes, messages, expenses, settlements,
    usage: 3, nextMsg: mid, signedIn: true,
  };
}

const REPLIES = ['Haha yes', 'I am in 🙌', 'Works for me', 'Can we do a bit later?', 'Sounds perfect', '👀👀', 'Let me check and get back to you', 'Count me in!'];

export class DemoApi {
  constructor({ persist = true, delay = 90, fresh = false } = {}) {
    this.demo = true; this.persist = persist; this.delay = delay;
    let db = null;
    if (persist && !fresh) { try { db = JSON.parse(localStorage.getItem(KEY)); } catch {} }
    this.db = db || seed();
    this.db.signedIn = true; // the demo always starts signed in
    this.user = { id: ME, email: 'alex@demo.whossup.app' };
    this.subs = {};
    this.save();
  }
  save() { if (this.persist) try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch {} }
  async tick() { if (this.delay) await sleep(this.delay); }
  reset() { this.db = seed(); this.save(); }
  me() { if (!this.user) throw new Error('Sign in first'); return this.user.id; }
  activeIn(gid) { return this.db.members.some(m => m.group_id === gid && m.user_id === this.user?.id && m.status === 'active'); }
  guard(gid) { if (!this.activeIn(gid)) throw new Error('Not a member of this crew'); }
  isAdmin(gid) { return this.db.members.some(m => m.group_id === gid && m.user_id === this.user?.id && m.status === 'active' && m.role === 'admin'); }

  // ── Auth ──
  async getSession() { return this.user; }
  onAuthChange(cb) { this._authCb = cb; }
  async signIn() { await this.tick(); this.db.signedIn = true; this.save(); this.user = { id: ME, email: 'alex@demo.whossup.app' }; this._authCb?.('SIGNED_IN', this.user); return this.user; }
  async signUp() { await this.signIn(); return { needsConfirm: false }; }
  async magicLink() { await this.tick(); }
  async resetPassword() { await this.tick(); }
  async updatePassword() { await this.tick(); }
  async signOut() { this.db.signedIn = false; this.save(); this.user = null; this._authCb?.('SIGNED_OUT', null); }

  // ── Profile ──
  async getProfile() { await this.tick(); return this.db.profiles.find(p => p.id === this.me()) || null; }
  async saveProfile({ name, color }) {
    await this.tick();
    let p = this.db.profiles.find(p => p.id === this.me());
    if (!p) this.db.profiles.push(p = { id: this.me(), plan: 'free' });
    Object.assign(p, { name: String(name).slice(0, 40), color }); this.save(); return { ...p };
  }

  // ── Crews ──
  async myGroups() {
    await this.tick();
    return this.db.members.filter(m => m.user_id === this.me()).map(m => ({ ...this.db.groups.find(g => g.id === m.group_id), role: m.role, status: m.status })).filter(g => g.id);
  }
  async createGroup(name, emoji) {
    await this.tick();
    const g = { id: uid(), name: String(name).trim().slice(0, 50), emoji: emoji || '🪩', invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(), require_approval: true, created_by: this.me(), created_at: iso(today()) };
    this.db.groups.push(g);
    this.db.members.push({ group_id: g.id, user_id: this.me(), role: 'admin', status: 'active', created_at: iso(today()) });
    this.save(); return g;
  }
  async joinGroup(code) {
    await this.tick();
    const g = this.db.groups.find(g => g.invite_code === String(code).trim().toUpperCase());
    if (!g) throw new Error('No crew with that code');
    let m = this.db.members.find(m => m.group_id === g.id && m.user_id === this.me());
    if (!m) this.db.members.push(m = { group_id: g.id, user_id: this.me(), role: 'member', status: g.require_approval ? 'pending' : 'active', created_at: iso(today()) });
    this.save(); return { group_id: g.id, name: g.name, emoji: g.emoji, status: m.status };
  }
  async previewGroup(code) {
    const g = this.db.groups.find(g => g.invite_code === String(code).trim().toUpperCase());
    return g ? { name: g.name, emoji: g.emoji, members: this.db.members.filter(m => m.group_id === g.id && m.status === 'active').length } : null;
  }
  async updateGroup(id, patch) {
    await this.tick(); if (!this.isAdmin(id)) throw new Error('Admins only');
    const g = this.db.groups.find(g => g.id === id);
    for (const k of ['name', 'emoji', 'require_approval']) if (k in patch) g[k] = patch[k];
    this.save();
  }
  async rotateInvite(id) { await this.tick(); if (!this.isAdmin(id)) throw new Error('Admins only'); const g = this.db.groups.find(g => g.id === id); g.invite_code = Math.random().toString(36).slice(2, 8).toUpperCase(); this.save(); return g.invite_code; }
  async deleteGroup(id) {
    await this.tick(); if (!this.isAdmin(id)) throw new Error('Admins only');
    const db = this.db;
    db.groups = db.groups.filter(g => g.id !== id);
    for (const t of ['members', 'events', 'notes', 'messages', 'expenses', 'settlements']) db[t] = db[t].filter(r => r.group_id !== id);
    this.save();
  }
  async members(gid) {
    await this.tick();
    const mine = this.db.members.find(m => m.group_id === gid && m.user_id === this.me());
    if (!mine) throw new Error('Not a member of this crew');
    return this.db.members.filter(m => m.group_id === gid && (mine.status === 'active' || m.user_id === this.me()))
      .map(m => { const p = this.db.profiles.find(p => p.id === m.user_id) || {}; return { ...m, name: p.name || 'Someone', color: p.color || '#8b7cff' }; });
  }
  async setMember(gid, u, patch) {
    await this.tick(); if (!this.isAdmin(gid)) throw new Error('Admins only');
    const m = this.db.members.find(m => m.group_id === gid && m.user_id === u);
    if (m) { if (patch.role) m.role = patch.role; if (patch.status) m.status = patch.status; }
    this.save();
  }
  async removeMember(gid, u) {
    await this.tick();
    if (u !== this.me() && !this.isAdmin(gid)) throw new Error('Admins only');
    this.db.members = this.db.members.filter(m => !(m.group_id === gid && m.user_id === u)); this.save();
  }

  // ── Availability ──
  sharesWith(u) {
    const mine = new Set(this.db.members.filter(m => m.user_id === this.me() && m.status === 'active').map(m => m.group_id));
    return u === this.me() || this.db.members.some(m => m.user_id === u && mine.has(m.group_id));
  }
  async busy(ids, from, to) {
    await this.tick();
    const set = new Set(ids.filter(u => this.sharesWith(u)));
    return this.db.busy.filter(b => set.has(b.user_id) && b.day >= from && b.day <= to);
  }
  async setBusy(day, on) {
    const me = this.me();
    this.db.busy = this.db.busy.filter(b => !(b.user_id === me && b.day === day));
    if (on) this.db.busy.push({ user_id: me, day, source: 'manual' });
    this.save(); await this.tick();
  }
  async addBusyDays(days, source = 'import') {
    const me = this.me(), have = new Set(this.db.busy.filter(b => b.user_id === me).map(b => b.day));
    for (const day of days) if (!have.has(day)) this.db.busy.push({ user_id: me, day, source });
    this.save(); await this.tick();
  }
  async clearImported() { const me = this.me(); this.db.busy = this.db.busy.filter(b => !(b.user_id === me && b.source === 'import')); this.save(); }

  // ── Events ──
  async events(gid) { await this.tick(); this.guard(gid); return this.db.events.filter(e => e.group_id === gid).sort((a, b) => a.starts_on < b.starts_on ? -1 : 1).map(e => ({ ...e })); }
  async saveEvent(ev) {
    await this.tick(); this.guard(ev.group_id);
    if (!ev.title?.trim()) throw new Error('Give it a name');
    if (ev.ends_on < ev.starts_on) throw new Error('End date is before the start');
    if (ev.id) {
      const cur = this.db.events.find(e => e.id === ev.id);
      if (!cur) throw new Error('Event not found');
      if (cur.created_by !== this.me() && !this.isAdmin(cur.group_id)) throw new Error('Only the creator or an admin can edit this');
      Object.assign(cur, ev); this.save(); return { ...cur };
    }
    const row = { location: '', note: '', url: '', category: 'Hangout', status: 'planned', start_time: null, end_time: null, price_min: null, price_max: null, ...ev, id: uid(), created_by: this.me(), created_at: new Date().toISOString() };
    this.db.events.push(row); this.save(); return { ...row };
  }
  async deleteEvent(id) {
    await this.tick();
    const cur = this.db.events.find(e => e.id === id);
    if (cur && cur.created_by !== this.me() && !this.isAdmin(cur.group_id)) throw new Error('Only the creator or an admin can delete this');
    this.db.events = this.db.events.filter(e => e.id !== id);
    this.db.rsvps = this.db.rsvps.filter(r => r.event_id !== id); this.save();
  }
  async rsvps(ids) { await this.tick(); const s = new Set(ids); return this.db.rsvps.filter(r => s.has(r.event_id)).map(r => ({ ...r })); }
  async setRsvp(eventId, status) {
    const me = this.me();
    this.db.rsvps = this.db.rsvps.filter(r => !(r.event_id === eventId && r.user_id === me));
    if (status) this.db.rsvps.push({ event_id: eventId, user_id: me, status });
    this.save(); await this.tick();
  }

  // ── Notes ──
  async notes(gid) { await this.tick(); this.guard(gid); return this.db.notes.filter(n => n.group_id === gid).map(n => ({ ...n })); }
  async addNote(gid, day, body) { await this.tick(); this.guard(gid); const n = { id: uid(), group_id: gid, user_id: this.me(), day, body: String(body).slice(0, 500), created_at: new Date().toISOString() }; this.db.notes.push(n); this.save(); return { ...n }; }
  async deleteNote(id) { await this.tick(); this.db.notes = this.db.notes.filter(n => !(n.id === id && (n.user_id === this.me() || this.isAdmin(n.group_id)))); this.save(); }

  // ── Chat ──
  async messages(gid) { await this.tick(); this.guard(gid); return this.db.messages.filter(m => m.group_id === gid).map(m => ({ ...m })); }
  async sendMessage(gid, body) {
    this.guard(gid);
    const m = { id: this.db.nextMsg++, group_id: gid, user_id: this.me(), body: String(body).slice(0, 2000), created_at: new Date().toISOString() };
    this.db.messages.push(m); this.save(); await this.tick();
    // A crewmate answers now and then, so the demo feels alive.
    if (this.persist && Math.random() < 0.7) setTimeout(() => {
      const others = this.db.members.filter(x => x.group_id === gid && x.status === 'active' && x.user_id !== this.me());
      if (!others.length) return;
      const who = others[Math.floor(Math.random() * others.length)].user_id;
      const r = { id: this.db.nextMsg++, group_id: gid, user_id: who, body: REPLIES[Math.floor(Math.random() * REPLIES.length)], created_at: new Date().toISOString() };
      this.db.messages.push(r); this.save();
      (this.subs[gid] || []).forEach(cb => cb({ ...r }));
    }, 1600 + Math.random() * 1800);
    return { ...m };
  }
  subscribe(gid, cb) { (this.subs[gid] ||= []).push(cb); return () => { this.subs[gid] = (this.subs[gid] || []).filter(x => x !== cb); }; }

  // ── Money ──
  async expenses(gid) { await this.tick(); this.guard(gid); return this.db.expenses.filter(e => e.group_id === gid).sort((a, b) => a.created_at < b.created_at ? 1 : -1).map(e => ({ ...e })); }
  async addExpense(e) {
    await this.tick(); this.guard(e.group_id);
    if (!(e.amount > 0)) throw new Error('Amount must be more than zero');
    if (!e.split_with?.length) throw new Error('Split it with at least one person');
    const row = { event_id: null, currency: 'EUR', ...e, id: uid(), created_by: this.me(), created_at: new Date().toISOString() };
    this.db.expenses.push(row); this.save(); return { ...row };
  }
  async deleteExpense(id) { await this.tick(); this.db.expenses = this.db.expenses.filter(e => !(e.id === id && (e.created_by === this.me() || this.isAdmin(e.group_id)))); this.save(); }
  async settlements(gid) { await this.tick(); this.guard(gid); return this.db.settlements.filter(s => s.group_id === gid).map(s => ({ ...s })); }
  async addSettlement(s) { await this.tick(); this.guard(s.group_id); const row = { currency: 'EUR', ...s, id: uid(), created_by: this.me(), created_at: new Date().toISOString() }; this.db.settlements.push(row); this.save(); return { ...row }; }
  async deleteSettlement(id) { await this.tick(); this.db.settlements = this.db.settlements.filter(s => s.id !== id); this.save(); }

  async joinWaitlist(email, period) { await this.tick(); this.db.waitlist = { email, period }; this.save(); }

  // ── AI (canned, shaped like the real edge function's output) ──
  async ai(kind, p) {
    this.guard(p.group_id);
    if (this.db.usage >= AI_FREE_MONTHLY) { const e = new Error('quota'); e.quota = { used: this.db.usage, limit: AI_FREE_MONTHLY }; throw e; }
    await sleep(this.delay ? 1100 : 0);
    this.db.usage++; this.save();
    return { text: demoAi(kind, p), used: this.db.usage, limit: AI_FREE_MONTHLY };
  }
  async aiUsage() { return { used: this.db.usage, limit: AI_FREE_MONTHLY }; }
}

function demoAi(kind, p) {
  if (kind === 'events') {
    const months = p.months?.length ? p.months : [iso(today()).slice(0, 7)];
    const pool = [
      ['Winter Jazz Weekend', 'Music', 'Copenhagen, Denmark', 70, 140, 'Intimate club gigs across the city.'],
      ['Christmas Market', 'Festival', 'Vienna, Austria', 0, 0, 'Mulled wine, lights and stalls in front of the Rathaus.'],
      ['Indoor Rally Show', 'Motorsport', 'Birmingham, UK', 45, 95, 'Rally cars on a tight indoor stage — loud and close.'],
      ['Electronic Music Festival', 'Music', 'Berlin, Germany', 60, 120, 'Three nights of techno across warehouse venues.'],
      ['Ski Opening Party', 'Outdoors', 'Ischgl, Austria', 0, 90, 'Season opener with a big open-air concert on the slopes.'],
      ['Food & Wine Week', 'Food', 'Lisbon, Portugal', 25, 60, 'Tasting menus and natural-wine bars all over town.'],
      ['Light Festival', 'Culture', 'Amsterdam, Netherlands', 0, 25, 'Art installations along the canals, best by boat.'],
      ['Basketball Derby', 'Sport', 'Kaunas, Lithuania', 30, 110, 'Žalgiris at home — the arena is unreal.'],
      ['Comedy Festival', 'Culture', 'Edinburgh, UK', 15, 40, 'Stand-up marathon in tiny basement venues.'],
      ['Northern Lights Trip Week', 'Outdoors', 'Tromsø, Norway', 90, 180, 'Peak aurora season with guided chases.'],
      ['Craft Beer Festival', 'Food', 'Prague, Czechia', 15, 30, 'Dozens of local breweries under one roof.'],
      ['Formula E Season Opener', 'Motorsport', 'São Paulo, Brazil', 80, 220, 'Street race with a festival around it.'],
    ];
    const q = String(p.query || '').toLowerCase();
    const cats = (p.categories || []).map(c => c.toLowerCase());
    let list = pool.filter(x => !cats.length || cats.includes(x[1].toLowerCase()));
    if (q) list = pool.filter(x => (x.join(' ')).toLowerCase().split(/\W+/).some(w => w.length > 3 && q.includes(w))).concat(list).slice(0, 10);
    if (!list.length) list = pool;
    return JSON.stringify(list.slice(0, 10).map((x, i) => {
      const ym = months[i % months.length], day = 3 + (i * 5) % 22, len = i % 3;
      const y = +ym.slice(0, 4), m = +ym.slice(5) - 1;
      const s = new Date(y, m, day), e = new Date(y, m, day + len);
      return { title: x[0], category: x[1], location: x[2], starts_on: iso(s), ends_on: iso(e), price_min: x[3], price_max: x[4], url: '', blurb: x[5] };
    }));
  }
  if (kind === 'places') {
    const city = (String(p.query).match(/in ([A-Za-zÀ-ž ]+)/) || [])[1]?.trim() || 'Vilnius';
    const names = [['The Copper Fox', 'bar', '€€', 'Cocktail bar with a big back room you can book for groups.'], ['Nine Tables', 'restaurant', '€€€', 'Shared tasting menu — perfect for 6-10 people.'], ['Basement Arcade', 'activity', '€€', 'Retro arcade, pinball and craft beer.'], ['Riverside Sauna Club', 'activity', '€€', 'Wood-fired sauna rafts you can rent by the hour.'], ['Late Noodle', 'restaurant', '€', 'Open late, cheap, very good.'], ['Vinyl & Vino', 'bar', '€€', 'Natural wine and a DJ who takes requests.'], ['Escape Room Kvest', 'activity', '€€', 'Two rooms you can race against each other.'], ['Rooftop 21', 'bar', '€€€', 'Best view in town, book a table at sunset.']];
    return JSON.stringify(names.map((n, i) => ({ name: n[0], type: n[1], city, address: (10 + i * 7) + ' Main Street, ' + city, blurb: n[3], price: n[2], hours: i % 2 ? '17:00–02:00' : '12:00–23:00', rating: 4.2 + (i % 4) / 10 })));
  }
  if (kind === 'trip') return `${p.location || 'The city'} in ${MONTHS[parseDay(p.starts_on).getMonth()]} is lively and busy around ${p.title} — book your stay early, prices climb in the last two weeks. Stay central so you can walk to the venue and to the bars after. Public transport is easy and cheap; grab a day pass on arrival. Pack layers: evenings get cold. (Demo answer — the real one is written by AI for your exact trip.)`;
  if (kind === 'brief') {
    const f = p.facts || {};
    const w = f.windows?.[0];
    return `${w ? `Your best shot is ${w.label} — ${w.free} of ${f.crewSize} of you are free.` : 'Pick a weekend soon — calendars are filling up.'} ${f.ideas?.length ? `"${f.ideas[0].title}" is the idea that fits best, so lock it in this week before people make other plans.` : 'Try Discover to find something worth travelling for.'} Whoever books first gets to pick the restaurant. (Demo answer.)`;
  }
  return '';
}
