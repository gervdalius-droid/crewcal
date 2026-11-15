// Shared UI building blocks: bottom sheets, confirm dialog, fields, chips.
import { h, icon } from './util.js';

const stack = [];

// openSheet({title, wide}, (body, sheet) => {...}) — body is rebuilt by sheet.redraw().
// Sheets own their local state, so global re-renders never steal input focus.
export function openSheet(opts, build) {
  const root = document.getElementById('sheets');
  const prevFocus = document.activeElement;
  const sheet = { opts, redraw, close, el: null, onClose: opts.onClose };
  const body = h('div.sheet-body');
  const titleEl = h('h2.sheet-title', opts.title || '');
  const head = h('div.sheet-head', h('div.grab'), h('div.sheet-headrow', titleEl, opts.action || null,
    h('button.iconbtn.ghost', { 'aria-label': 'Close', onclick: () => close() }, icon('x', 20))));
  const panel = h('div.sheet' + (opts.wide ? '.wide' : '') + (opts.cls ? '.' + opts.cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' }, head, body);
  const scrim = h('div.scrim', { onclick: e => { if (e.target === scrim) close(); } }, panel);
  sheet.el = scrim; sheet.body = body; sheet.setTitle = t => (titleEl.textContent = t);
  function redraw() {
    const st = body.scrollTop;
    body.replaceChildren();
    build(body, sheet);
    body.scrollTop = st;
  }
  function close(silent) {
    const i = stack.indexOf(sheet); if (i < 0) return;
    stack.splice(i, 1);
    scrim.classList.remove('in'); scrim.classList.add('out');
    setTimeout(() => scrim.remove(), 220);
    if (!silent) sheet.onClose?.();
    if (!stack.length) document.body.classList.remove('has-sheet');
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    if (history.state?.sheet && !silent) { skipPop = true; history.back(); }
  }
  redraw();
  root.appendChild(scrim);
  stack.push(sheet);
  document.body.classList.add('has-sheet');
  try { history.pushState({ sheet: true }, ''); } catch {}
  requestAnimationFrame(() => { scrim.classList.add('in'); const f = panel.querySelector('[autofocus]'); if (f && matchMedia('(pointer:fine)').matches) f.focus(); });
  dragToClose(panel, head, () => close());
  return sheet;
}
export const topSheet = () => stack.at(-1);
export function closeAllSheets() { while (stack.length) stack.at(-1).close(true); }

// Back button / gesture closes the top sheet instead of leaving the app.
let skipPop = false;
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  const s = stack.at(-1); if (s) { s.close(true); s.onClose?.(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack.at(-1).close(); });

function dragToClose(panel, handle, close) {
  let y0 = null, dy = 0;
  handle.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; y0 = e.clientY; dy = 0; panel.style.transition = 'none'; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (y0 == null) return; panel.style.transition = ''; panel.style.transform = ''; if (dy > 90) close(); y0 = null; };
  handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
}

export function confirmSheet({ title, text, ok = 'Confirm', danger = false }) {
  return new Promise(res => {
    let done = false;
    const s = openSheet({ title, cls: 'confirm', onClose: () => { if (!done) res(false); } }, body => {
      body.append(
        text ? h('p.muted.mb', text) : null,
        h('div.row.gap.end',
          h('button.btn.ghost', { onclick: () => { done = true; s.close(); res(false); } }, 'Cancel'),
          h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => { done = true; s.close(); res(true); } }, ok)),
      );
    });
  });
}

// Labelled input. `bind` = [obj, key] keeps a plain object in sync without re-rendering.
export function field(label, input, hint) {
  return h('label.field', h('span.flabel', label), input, hint ? h('span.fhint', hint) : null);
}
export function input(bind, attrs = {}) {
  const [obj, key] = bind;
  const el = h(attrs.multiline ? 'textarea' : 'input', { ...attrs, multiline: null, value: obj[key] ?? '' });
  el.addEventListener('input', () => { obj[key] = attrs.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value; attrs.onchange_?.(); });
  return el;
}
export function select(bind, options, attrs = {}) {
  const [obj, key] = bind;
  const el = h('select', attrs, options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(obj[key]) === String(v) }, l); }));
  el.addEventListener('change', () => { obj[key] = el.value; attrs.onpick?.(el.value); });
  return el;
}
export function segmented(options, value, onpick, cls = '') {
  return h('div.seg' + (cls ? '.' + cls : ''), { role: 'tablist' }, options.map(([v, label, badge]) =>
    h('button' + (v === value ? '.on' : ''), { role: 'tab', 'aria-selected': String(v === value), onclick: () => onpick(v) }, label, badge ? h('span.segbadge', badge) : null)));
}
export function chip(label, on, onclick, extra = '') {
  return h('button.chip' + (on ? '.on' : '') + (extra ? '.' + extra : ''), { onclick, 'aria-pressed': String(!!on) }, label);
}
export function empty(iconName, title, text, action) {
  return h('div.empty', h('div.empty-ic', icon(iconName, 28)), h('div.empty-t', title), text ? h('p.empty-p', text) : null, action || null);
}
export function spinner(label) { return h('div.loading', h('span.spin'), label ? h('span', label) : null); }

export async function share({ title, text, url }) {
  if (navigator.share) { try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; } }
  await copy(url || text); return 'copied';
}
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = h('textarea', { value: text, style: { position: 'fixed', opacity: 0 } }); document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
}
export function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
