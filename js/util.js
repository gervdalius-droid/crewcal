// Small DOM + date helpers shared by every view.

// Views pass optional children as `cond ? node : null`; native append() would print
// "null"/"false", so drop empty values for every append/replaceChildren call.
for (const m of ['append', 'replaceChildren']) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter(k => k != null && k !== false && k !== true && k !== '')); };
}

// h('div.card.big', {onclick, style:{...}}, child, 'text', [more]) → element
export function h(sel, props, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const e = document.createElement(tag || 'div');
  if (cls.length) e.className = cls.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') { for (const s in v) s.startsWith('--') ? e.style.setProperty(s, v[s]) : (e.style[s] = v[s]); }
    else if (k === 'class') e.className += (e.className ? ' ' : '') + v;
    else if (k === 'html') e.innerHTML = v;
    else if (k in e && k !== 'list' && k !== 'form' && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  append(e, kids);
  return e;
}
function append(e, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(e, c);
    else e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ── Icons (24px stroke set) ─────────────────────────────────
const P = {
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="3.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.4A8.5 8.5 0 1 1 21 12z"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16.5 15h.01"/><path d="M6 6l9-3 1.5 3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M17.5 14.6c2.2.4 3.6 2 4 4.9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>', chevR: '<path d="M9 5l7 7-7 7"/>', chevD: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  plane: '<path d="M10.5 13.5L3 11l1.5-1.5 8 .5 4.5-4.5a2 2 0 0 1 3 3L15.5 13l.5 8L14.5 22.5 12 15l-3 3v2.5L7.5 22l-1-3.5L3 17.5 4.5 16H7z"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-2.5A3.5 3.5 0 0 0 17.5 8H11v6"/><circle cx="7" cy="10.5" r="2"/>',
  ticket: '<path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a3.5 3.5 0 0 0 0 7v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-2a3.5 3.5 0 0 0 0-7z"/><path d="M14 5v14" stroke-dasharray="2 2.5"/>',
  car: '<path d="M5 16.5V12l2-5h10l2 5v4.5"/><path d="M3.5 12h17v4.5h-17z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14"/>',
  logout: '<path d="M15 4h3.5A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5H15"/><path d="M10 16.5L14.5 12 10 7.5M14.5 12H3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L3.5 9M4 13a8 8 0 0 0 14.5 4.5l2-2.5"/><path d="M3.5 4v5h5M20.5 20v-5h-5"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  arrowR: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  repeat: '<path d="M17 2.5l3.5 3.5L17 9.5"/><path d="M3.5 11V9a3 3 0 0 1 3-3h14M7 21.5L3.5 18 7 14.5"/><path d="M20.5 13v2a3 3 0 0 1-3 3h-14"/>',
};
export function icon(name, size = 20, cls = '') {
  const s = document.createElement('span');
  s.className = 'ic ' + cls;
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  return s;
}

// ── Dates (all day-level, local time, ISO yyyy-mm-dd keys) ─────
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MON = MONTHS.map(m => m.slice(0, 3));
export const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const pad = n => String(n).padStart(2, '0');
export const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseDay = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const todayIso = () => iso(today());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dow = d => (d.getDay() + 6) % 7; // Monday = 0
export const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
export function eachDay(from, to) { const out = []; for (let d = parseDay(from); d <= parseDay(to); d = addDays(d, 1)) out.push(iso(d)); return out; }

export function fmtDay(s, opts = {}) {
  const d = typeof s === 'string' ? parseDay(s) : s;
  const t = today(), diff = Math.round((d - t) / 864e5);
  if (opts.relative !== false) {
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
  }
  return DOW[dow(d)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + (opts.year || d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : '');
}
export function fmtRange(a, b) {
  if (!b || a === b) return fmtDay(a, { relative: false });
  const A = parseDay(a), B = parseDay(b);
  if (A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear()) return A.getDate() + '–' + B.getDate() + ' ' + MON[A.getMonth()];
  return A.getDate() + ' ' + MON[A.getMonth()] + ' – ' + B.getDate() + ' ' + MON[B.getMonth()];
}
export function relTime(ts) {
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
export const hhmm = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

// ── Money ────────────────────────────────────────────────────
const SYM = { EUR: '€', USD: '$', GBP: '£', PLN: 'zł', SEK: 'kr', NOK: 'kr', DKK: 'kr', CHF: 'CHF', CZK: 'Kč' };
export function money(n, cur = 'EUR') {
  const v = Math.abs(n) < 0.005 ? 0 : n;
  const s = v.toFixed(Math.abs(v) % 1 < 0.005 ? 0 : 2);
  const sym = SYM[cur] || cur;
  return sym.length === 1 ? sym + s : s + ' ' + sym;
}
export const round2 = n => Math.round(n * 100) / 100;

// ── People ───────────────────────────────────────────────────
export const PALETTE = ['#8b7cff', '#ff7aa8', '#4fd1c5', '#ffb454', '#5eb3ff', '#c38bff', '#7ee08a', '#ff8f6b', '#f2d14b', '#a3b1c6'];
export function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
export function avatar(person, size = 32, extra = '') {
  const a = h('span.av' + (extra ? '.' + extra : ''), { title: person?.name || '', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.4) + 'px', '--c': person?.color || '#8b7cff' } }, size < 28 ? initials(person?.name)[0] : initials(person?.name));
  return a;
}
export function avatarStack(people, size = 26, max = 5) {
  const shown = people.slice(0, max);
  return h('span.avstack', shown.map(p => avatar(p, size)), people.length > max ? h('span.av.more', { style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.36) + 'px' } }, '+' + (people.length - max)) : null);
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Pull the first JSON array out of model output (tolerates ``` fences and a truncated tail).
export function parseJsonArray(text) {
  if (!text) return null;
  const c = String(text).replace(/```(?:json)?/gi, '').trim();
  const s = c.indexOf('['), e = c.lastIndexOf(']');
  if (s >= 0 && e > s) { try { return JSON.parse(c.slice(s, e + 1)); } catch {} }
  if (s >= 0) { const cut = c.lastIndexOf('},'); if (cut > s) { try { return JSON.parse(c.slice(s, cut + 1) + ']'); } catch {} } }
  return null;
}
