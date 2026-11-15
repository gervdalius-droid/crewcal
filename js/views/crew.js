import { h, icon, avatar, PALETTE, iso, today, addDays, fmtDay } from '../util.js';
import { S, render, me, group, isAdmin, active, pending, approve, decline, setRole, removeMember, leaveCrew, deleteCrew, updateCrew, rotateInvite, inviteLink, createCrew, joinCrew, switchCrew, attempt, toast, importBusy, clearImported, bmap } from '../store.js';
import { icsBusyDays, eventsToIcs } from '../logic.js';
import { openSheet, confirmSheet, field, input, share, copy, download, segmented } from '../ui.js';
import { PRO_PRICE, SUPPORT_EMAIL } from '../config.js';

export const EMOJIS = ['🪩', '🎉', '🍻', '🏕️', '🏁', '🎧', '⚽', '🧗', '🏂', '✈️', '🍕', '🎲', '🌊', '🔥', '💜', '🦄'];

export function crewView() {
  const g = group(); if (!g) return h('div');
  const admin = isAdmin();
  const wrap = h('div.view.crew-view');
  wrap.append(h('div.crew-hero',
    h('div.crew-emoji', g.emoji),
    h('div', h('h1', g.name), h('div.muted', active().length + ' member' + (active().length !== 1 ? 's' : '') + (admin ? ' · you’re an admin' : ''))),
    admin ? h('button.iconbtn.ghost.mlauto', { 'aria-label': 'Edit crew', onclick: openCrewEdit }, icon('edit')) : null));

  const link = inviteLink(g.invite_code);
  wrap.append(h('div.card.invite',
    h('div.inv-top', h('div', h('h3', 'Invite friends'), h('p.muted.small', g.require_approval ? 'They’ll appear below for you to approve.' : 'Anyone with the link joins straight away.')),
      h('div.code', { title: 'Invite code' }, g.invite_code)),
    h('div.inv-link', h('span.inv-url', link.replace(/^https?:\/\//, '')),
      h('button.btn.sm.soft', { onclick: async () => { await copy(link); toast('Invite link copied', 'ok'); } }, icon('copy', 15), 'Copy')),
    h('div.row.gap',
      h('button.btn.primary.grow', { onclick: () => share({ title: 'Join ' + g.name + ' on Whossup', text: 'Join ' + g.emoji + ' ' + g.name + ' on Whossup so we can find a day everyone’s free:', url: link }).then(r => r === 'copied' && toast('Invite link copied', 'ok')) }, icon('share', 17), 'Share invite'),
      admin ? h('button.btn.ghost', { title: 'Make a new link — the old one stops working', onclick: async () => { if (await confirmSheet({ title: 'Reset invite link?', text: 'The current link and code stop working. Members stay in the crew.', ok: 'Reset' })) attempt(rotateInvite, 'New invite link ready'); } }, icon('refresh', 16)) : null)));

  const pend = pending();
  if (admin && pend.length) wrap.append(h('div.card.pending-card',
    h('div.card-head', h('h3', 'Waiting for you'), h('span.badge', pend.length)),
    h('div.stack-s', pend.map(p => h('div.member', avatar(p, 36), h('div.m-main', h('div.m-name', p.name), h('div.m-sub', 'wants to join')),
      h('button.btn.sm.ghost', { onclick: () => attempt(() => decline(p.user_id)) }, 'Decline'),
      h('button.btn.sm.primary', { onclick: () => attempt(() => approve(p.user_id), p.name.split(' ')[0] + ' is in 🎉') }, 'Approve'))))));

  const t = iso(today()), bm = bmap();
  const next14 = Array.from({ length: 14 }, (_, i) => iso(addDays(today(), i)));
  wrap.append(h('div.card',
    h('div.card-head', h('h3', 'Members'), h('span.muted.small', 'next 2 weeks')),
    h('div.stack-s', active().sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || a.name.localeCompare(b.name)).map(p => {
      const busyToday = bm[t]?.has(p.user_id);
      return h('div.member',
        avatar(p, 38),
        h('div.m-main', h('div.m-name', p.name, p.user_id === me() ? h('span.muted', ' (you)') : null, p.role === 'admin' ? h('span.tag.sm', 'admin') : null),
          h('div.m-strip', { title: 'Next 14 days' }, next14.map(d => h('i' + (bm[d]?.has(p.user_id) ? '.b' : '')))),
          h('div.m-sub', busyToday ? 'Busy today' : 'Free today')),
        admin && p.user_id !== me() ? h('button.iconbtn.ghost', { 'aria-label': 'Manage ' + p.name, onclick: () => openMemberMenu(p) }, icon('dots')) : null);
    }))));

  wrap.append(h('div.card',
    h('div.card-head', h('h3', 'Your crews')),
    h('div.stack-s', S.groups.map(x => h('button.crew-row' + (x.id === S.gid ? '.on' : ''), { onclick: () => x.id !== S.gid && switchCrew(x.id) },
      h('span.crew-e', x.emoji), h('span.grow', x.name), x.status === 'pending' ? h('span.tag.warn', 'pending') : x.id === S.gid ? h('span.tag.ok', 'current') : icon('chevR', 18)))),
    h('div.row.gap.mt', h('button.btn.soft.grow', { onclick: () => openCreateCrew() }, icon('plus', 16), 'New crew'), h('button.btn.soft.grow', { onclick: () => openJoinCrew() }, icon('link', 16), 'Join with code'))));

  wrap.append(h('div.danger-zone',
    h('button.btn.ghost.danger-text', { onclick: async () => {
      const lastAdmin = admin && active().filter(m => m.role === 'admin').length === 1 && active().length > 1;
      if (lastAdmin) return toast('Make someone else an admin before you leave', 'err');
      if (await confirmSheet({ title: 'Leave ' + g.name + '?', text: active().length === 1 ? 'You’re the last member — the crew stays empty until someone joins with the code.' : 'You can rejoin later with the invite link.', ok: 'Leave', danger: true })) attempt(leaveCrew);
    } }, icon('logout', 16), 'Leave crew'),
    admin ? h('button.btn.ghost.danger-text', { onclick: async () => {
      if (await confirmSheet({ title: 'Delete ' + g.name + ' for everyone?', text: 'All plans, chat and expenses in this crew are deleted. This can’t be undone.', ok: 'Delete crew', danger: true })) attempt(deleteCrew, 'Crew deleted');
    } }, icon('trash', 16), 'Delete crew') : null));
  return wrap;
}

function openMemberMenu(p) {
  const s = openSheet({ title: p.name }, body => {
    body.append(h('div.menu',
      p.role === 'admin'
        ? h('button.menu-i', { onclick: () => { s.close(); attempt(() => setRole(p.user_id, 'member'), 'Admin removed'); } }, icon('users'), 'Remove admin rights')
        : h('button.menu-i', { onclick: () => { s.close(); attempt(() => setRole(p.user_id, 'admin'), p.name.split(' ')[0] + ' is now an admin'); } }, icon('crown'), 'Make admin'),
      h('button.menu-i.danger-text', { onclick: async () => { s.close(); if (await confirmSheet({ title: 'Remove ' + p.name + '?', text: 'They lose access to this crew’s plans and chat.', ok: 'Remove', danger: true })) attempt(() => removeMember(p.user_id), 'Removed'); } }, icon('logout'), 'Remove from crew')));
  });
}

function openCrewEdit() {
  const g = group(); const f = { name: g.name, emoji: g.emoji, require_approval: g.require_approval };
  const s = openSheet({ title: 'Crew settings' }, (body, sheet) => {
    body.append(
      field('Name', input([f, 'name'], { maxlength: 50 })),
      h('div.field', h('span.flabel', 'Emoji'), h('div.emoji-pick', EMOJIS.map(e => h('button' + (f.emoji === e ? '.on' : ''), { onclick: () => { f.emoji = e; sheet.redraw(); } }, e)))),
      h('label.check', h('input', { type: 'checkbox', checked: f.require_approval, onchange: e => (f.require_approval = e.target.checked) }), h('span', 'New members need an admin’s approval')),
      h('button.btn.primary.block.mt', { onclick: async () => { if (!f.name.trim()) return toast('Name your crew', 'err'); if (await attempt(() => updCrew().then(() => true), 'Saved')) s.close(); } }, 'Save'));
  });
  const updCrew = () => updateCrew({ name: f.name.trim(), emoji: f.emoji, require_approval: f.require_approval });
}

export function openCreateCrew(onDone) {
  const f = { name: '', emoji: '🪩' };
  const s = openSheet({ title: 'New crew' }, (body, sheet) => {
    body.append(crewCreateForm(f, sheet, async () => { const g = await attempt(() => createCrew(f.name.trim(), f.emoji), 'Crew created — now invite your friends'); if (g) { s.close(); S.tab = 'crew'; render(); onDone?.(); } }));
  });
}
export function crewCreateForm(f, sheet, submit) {
  return h('div',
    field('Crew name', input([f, 'name'], { placeholder: 'e.g. Weekend Crew, Uni friends, Team 5-a-side', maxlength: 50, autofocus: true, onkeydown: e => e.key === 'Enter' && go() })),
    h('div.field', h('span.flabel', 'Pick an emoji'), h('div.emoji-pick', EMOJIS.map(e => h('button' + (f.emoji === e ? '.on' : ''), { type: 'button', onclick: ev => { f.emoji = e; ev.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === ev.currentTarget)); } }, e)))),
    h('button.btn.primary.block.mt', { onclick: go }, 'Create crew'));
  function go() { if (!f.name.trim()) return toast('Name your crew', 'err'); submit(); }
}

export function openJoinCrew(code = '') {
  const f = { code };
  const s = openSheet({ title: 'Join a crew' }, body => {
    body.append(joinForm(f, async () => {
      const r = await attempt(() => joinCrew(f.code));
      if (r) { s.close(); toast(r.status === 'active' ? 'Welcome to ' + r.name + ' 🎉' : 'Request sent to ' + r.name, 'ok'); }
    }));
  });
}
export function joinForm(f, submit) {
  const inp = input([f, 'code'], { placeholder: 'ABC123', maxlength: 12, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', class: 'code-in', autofocus: true, onkeydown: e => e.key === 'Enter' && go() });
  function go() { if (!f.code.trim()) return toast('Enter the invite code', 'err'); submit(); }
  return h('div', field('Invite code', inp, 'Ask a crew member for the code, or open their invite link.'), h('button.btn.primary.block.mt', { onclick: go }, 'Join'));
}

// Invite link landing: "Join Weekend Crew?" with a live preview.
export function openInviteSheet(code) {
  const s = openSheet({ title: 'You’re invited', onClose: () => { S.pendingInvite = null; try { sessionStorage.removeItem('whossup-join'); } catch {} } }, async (body) => {
    body.append(h('div.loading', h('span.spin')));
    const pv = await S.api.previewGroup(code).catch(() => null);
    body.replaceChildren();
    if (!pv) { body.append(h('p.muted', 'This invite link doesn’t work any more. Ask for a new one.'), h('button.btn.soft.block.mt', { onclick: () => s.close() }, 'OK')); return; }
    const already = S.groups.find(g => g.invite_code === code);
    body.append(h('div.invite-pv', h('div.crew-emoji.xl', pv.emoji), h('h2', pv.name), h('p.muted', pv.members + ' member' + (pv.members !== 1 ? 's' : ''))),
      already ? h('button.btn.primary.block', { onclick: () => { s.close(); switchCrew(already.id); } }, 'Open crew')
        : h('button.btn.primary.block', { onclick: async () => { const r = await attempt(() => joinCrew(code)); if (r) { s.close(true); toast(r.status === 'active' ? 'Welcome to ' + r.name + ' 🎉' : 'Request sent — an admin will let you in', 'ok'); } } }, 'Join ' + pv.name));
  });
}

export function openCrewSwitcher() {
  const s = openSheet({ title: 'Your crews' }, body => {
    body.append(h('div.stack-s', S.groups.map(x => h('button.crew-row' + (x.id === S.gid ? '.on' : ''), { onclick: () => { s.close(); if (x.id !== S.gid) switchCrew(x.id); } },
      h('span.crew-e', x.emoji), h('span.grow', x.name), x.status === 'pending' ? h('span.tag.warn', 'pending') : x.id === S.gid ? icon('check', 18) : null))),
      h('div.row.gap.mt', h('button.btn.soft.grow', { onclick: () => { s.close(); openCreateCrew(); } }, icon('plus', 16), 'New crew'), h('button.btn.soft.grow', { onclick: () => { s.close(); openJoinCrew(); } }, icon('link', 16), 'Join')));
  });
}

// ── Profile & settings ───────────────────────────────────────
export function openProfile() {
  const f = { name: S.profile.name, color: S.profile.color };
  openSheet({ title: 'You' }, (body, sheet) => {
    const theme = localStorage.getItem('whossup-theme') || 'auto';
    const importedCount = S.crew.busy.filter(b => b.user_id === me() && b.source === 'import').length;
    const fileIn = h('input', { type: 'file', accept: '.ics,text/calendar', hidden: true, onchange: async e => {
      const file = e.target.files[0]; if (!file) return;
      const days = icsBusyDays(await file.text());
      if (!days.length) return toast('No upcoming events found in that file', 'err');
      if (await attempt(() => importBusy(days).then(() => true))) { toast(days.length + ' busy days imported', 'ok'); sheet.redraw(); }
    } });
    body.append(
      h('div.me-head', avatar({ name: f.name, color: f.color }, 64), h('div', h('div.me-name', S.profile.name), h('div.muted.small', S.user.guest ? 'Guest account on this device' : (S.user.email || '')))),
      S.user.guest && !S.api.demo ? saveAccountCard() : null,
      field('Display name', input([f, 'name'], { maxlength: 40 })),
      h('div.field', h('span.flabel', 'Your colour'), h('div.color-pick', PALETTE.map(c => h('button' + (f.color === c ? '.on' : ''), { style: { '--c': c }, 'aria-label': c, onclick: () => { f.color = c; sheet.redraw(); } })))),
      h('button.btn.primary.block', { onclick: async () => {
        if (!f.name.trim()) return toast('Name can’t be empty', 'err');
        const p = await attempt(() => S.api.saveProfile({ name: f.name.trim(), color: f.color }), 'Saved');
        if (p) { S.profile = p; const m = S.crew.members.find(m => m.user_id === me()); if (m) Object.assign(m, { name: p.name, color: p.color }); render(); sheet.redraw(); }
      } }, 'Save profile'),

      h('div.section', h('div.sec-head', h('h4', 'Plan')),
        h('div.plan-row', h('div', h('b', S.profile.plan === 'pro' ? 'Whossup Pro' : 'Free'), h('div.muted.small', S.usage.used + ' of ' + (S.profile.plan === 'pro' ? '∞' : S.usage.limit) + ' AI searches used this month')),
          S.profile.plan !== 'pro' ? h('button.btn.sm.iris', { onclick: () => openUpgrade() }, icon('crown', 15), 'Go Pro') : null)),

      h('div.section', h('div.sec-head', h('h4', 'Calendar sync')),
        h('div.menu',
          h('button.menu-i', { onclick: () => fileIn.click() }, icon('upload'), h('span.grow', 'Import busy days from .ics', h('span.menu-sub', 'Google, Apple or Outlook calendar export')), fileIn),
          importedCount ? h('button.menu-i', { onclick: async () => { if (await confirmSheet({ title: 'Remove imported days?', text: importedCount + ' imported busy days will be cleared. Days you marked by hand stay.', ok: 'Remove' })) { await attempt(clearImported, 'Imported days removed'); sheet.redraw(); } } }, icon('trash'), h('span.grow', 'Clear ' + importedCount + ' imported days')) : null,
          h('button.menu-i', { onclick: () => { const evs = S.crew.events.filter(e => e.status === 'planned' && S.crew.rsvps.some(r => r.event_id === e.id && r.user_id === me() && r.status !== 'no')); if (!evs.length) return toast('RSVP to a plan first', 'err'); download('whossup.ics', eventsToIcs(evs, group()?.name), 'text/calendar'); } }, icon('download'), h('span.grow', 'Export my plans (.ics)')))),

      h('div.section', h('div.sec-head', h('h4', 'Appearance')),
        segmented([['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']], theme, v => { try { localStorage.setItem('whossup-theme', v); } catch {} applyTheme(); sheet.redraw(); }, 'grow')),

      h('div.section', h('div.menu',
        S.api.demo ? h('button.menu-i', { onclick: () => { S.api.reset(); location.reload(); } }, icon('refresh'), h('span.grow', 'Reset demo data')) : null,
        h('a.menu-i', { href: 'mailto:' + SUPPORT_EMAIL + '?subject=Whossup%20feedback' }, icon('mail'), h('span.grow', 'Send feedback')),
        h('button.menu-i.danger-text', { onclick: signOutFlow }, icon('logout'), h('span.grow', S.api.demo ? 'Leave demo' : 'Sign out')))));
  });
}

// Guests have no email: offer to add one so the account survives a new phone.
function saveAccountCard() {
  const st = { email: '', sent: '' };
  const box = h('div.save-acc');
  const draw = () => box.replaceChildren(
    h('div.save-acc-h', icon('shield', 18), h('b', 'Save your account')),
    st.sent ? h('p.small', 'Check ', h('b', st.sent), ' and tap the link. After that you can sign in on any device with an email link.')
      : h('div',
        h('p.small.muted', 'You’re using Whossup without an email. Add one so you can log in on another phone — otherwise this account lives only on this device.'),
        h('div.row.gap-s.mt-s',
          h('input.grow', { type: 'email', placeholder: 'you@email.com', autocomplete: 'email', oninput: e => (st.email = e.target.value) }),
          h('button.btn.soft', { onclick: async () => {
            const em = st.email.trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast('Enter a valid email', 'err');
            if (await attempt(() => S.api.saveEmail(em).then(() => true))) { st.sent = em; draw(); }
          } }, 'Save'))));
  draw();
  return box;
}

export async function signOutFlow() {
  const guest = S.user?.guest && !S.api.demo;
  const ok = await confirmSheet(guest
    ? { title: 'Sign out of a guest account?', text: 'You haven’t added an email, so you won’t be able to get back into this account or your crews. Add an email in your profile first to keep it.', ok: 'Sign out anyway', danger: true }
    : { title: 'Sign out?', ok: 'Sign out' });
  if (!ok) return;
  await S.api.signOut();
  if (S.api.demo) location.href = location.pathname;
}

export function applyTheme() {
  let t = 'auto'; try { t = localStorage.getItem('whossup-theme') || 'auto'; } catch {}
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#07070b' : '#f6f5f9');
}

// ── Pro ──────────────────────────────────────────────────────
export function openUpgrade(reason) {
  const st = { period: 'year', sent: false, email: S.user?.email || '' };
  openSheet({ title: 'Whossup Pro', cls: 'pro-sheet' }, (body, sheet) => {
    body.append(
      h('div.pro-hero', h('div.pro-ball', '🪩'), h('h2', 'Plan more, argue less'), reason ? h('p.pro-reason', reason) : h('p.muted', 'Everything in Free, plus:')),
      h('ul.pro-list', [
        ['sparkles', 'Unlimited AI', 'Discover events, places and trip tips without limits'],
        ['calendar', 'Live calendar sync', 'Busy days update from Google / Apple / Outlook automatically'],
        ['users', 'Bigger crews', 'Up to 50 people per crew, unlimited crews'],
        ['wallet', 'Multi-currency', 'Settle up across currencies at today’s rates'],
      ].map(([ic, t, d]) => h('li', icon(ic, 20, 'iris'), h('div', h('b', t), h('span', d))))),
      segmented([['month', 'Monthly · ' + PRO_PRICE.month], ['year', 'Yearly · ' + PRO_PRICE.year + ' (save 35%)']], st.period, v => { st.period = v; sheet.redraw(); }, 'grow mb'),
      st.sent ? h('div.ok-box', icon('check', 18), 'You’re on the list — we’ll email you the moment Pro opens, with founder pricing.')
        : h('div', h('p.muted.small.mb-s', 'Pro is launching soon. Join the early list and lock in founder pricing.'),
          h('div.inline-form', h('input', { type: 'email', value: st.email, placeholder: 'you@email.com', oninput: e => (st.email = e.target.value) }),
            h('button.btn.iris', { onclick: async () => { if (!/.+@.+\..+/.test(st.email)) return toast('Enter your email', 'err'); if (await attempt(() => S.api.joinWaitlist(st.email.trim(), st.period).then(() => true))) { st.sent = true; sheet.redraw(); } } }, 'Notify me'))));
  });
}

