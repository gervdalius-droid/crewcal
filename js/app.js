import { h, icon, avatar } from './util.js';
import { S, setRender, boot, group, isAdmin, pending, markChatSeen, refreshGroups, route, loadCrew, toast, attempt } from './store.js';
import { SupabaseApi } from './api.js';
import { DemoApi } from './demo.js';
import { welcomeScreen, authScreen, profileScreen, crewScreen, pendingScreen } from './views/onboarding.js';
import { calendarView } from './views/calendar.js';
import { plansView } from './views/plans.js';
import { chatView } from './views/chat.js';
import { moneyView } from './views/money.js';
import { crewView, openProfile, openCrewSwitcher, openInviteSheet, applyTheme } from './views/crew.js';
import { openSheet, topSheet, field } from './ui.js';

const TABS = [
  ['calendar', 'Calendar', 'calendar'],
  ['plans', 'Plans', 'sparkles'],
  ['chat', 'Chat', 'chat'],
  ['money', 'Money', 'wallet'],
  ['crew', 'Crew', 'users'],
];
const scrollMem = {};
let lastTab = null, inviteShown = null, recoveryShown = false;

function render() {
  const root = document.getElementById('app');
  // Keep focus + caret on the element being typed into across re-renders.
  const ae = document.activeElement, keepId = ae && root.contains(ae) && ae.id;
  const sel = keepId && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;
  const mainEl = root.querySelector('.main');
  if (mainEl && lastTab) scrollMem[lastTab] = mainEl.scrollTop;

  root.replaceChildren(screen());
  document.body.dataset.screen = S.screen;

  const main = root.querySelector('.main');
  if (main && S.tab !== 'chat') main.scrollTop = lastTab === S.tab ? (scrollMem[S.tab] || 0) : 0;
  lastTab = S.screen === 'app' ? S.tab : null;
  if (keepId) { const el = document.getElementById(keepId); if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch {} } }

  // Invite link: show the join sheet once the user is signed in with a profile.
  if (S.pendingInvite && S.profile && S.user && inviteShown !== S.pendingInvite && !topSheet()) {
    inviteShown = S.pendingInvite; openInviteSheet(S.pendingInvite);
    if (S.screen === 'boot' || S.screen === 'profile') route();
  }
  if (S.recovery && !recoveryShown) { recoveryShown = true; openNewPassword(); }
  pendingPoll();
}
setRender(render);

function screen() {
  switch (S.screen) {
    case 'boot': return h('div.boot', h('img.boot-logo', { src: 'img/mark.png', alt: 'Whossup', width: 88, height: 88 }));
    case 'welcome': return welcomeScreen();
    case 'auth': return authScreen();
    case 'profile': return profileScreen();
    case 'crew': return crewScreen();
    case 'pending': return pendingScreen();
    default: return shell();
  }
}

function shell() {
  const g = group();
  const badge = { chat: S.chat.unread || null, crew: isAdmin() && pending().length || null };
  const nav = (cls) => h('nav.' + cls, { 'aria-label': 'Main' }, TABS.map(([k, label, ic]) =>
    h('button.nav-i' + (S.tab === k ? '.on' : ''), { 'aria-current': S.tab === k ? 'page' : null, onclick: () => go(k) },
      h('span.nav-ic', icon(ic, 22), badge[k] ? h('span.nav-badge', badge[k] > 99 ? '99+' : badge[k]) : null), h('span.nav-l', label))));

  const crewBtn = h('button.crew-switch', { onclick: openCrewSwitcher, 'aria-label': 'Switch crew' }, h('span.crew-e', g?.emoji || '🪩'), h('span.crew-n', g?.name || 'Crew'), icon('chevD', 16));
  const meBtn = h('button.me-btn', { onclick: openProfile, 'aria-label': 'Your profile' }, avatar({ name: S.profile?.name, color: S.profile?.color }, 34));

  const top = h('header.topbar',
    h('img.top-mark', { src: 'img/mark.png', alt: 'Whossup', width: 32, height: 32 }),
    crewBtn,
    h('div.top-r',
      S.syncing ? h('span.sync', { title: 'Syncing' }, h('span.spin.sm')) : null,
      !S.online ? h('span.offline', 'Offline') : null,
      S.api.demo ? h('span.demo-tag', 'Demo') : null,
      meBtn));

  const side = h('aside.rail',
    h('div.rail-logo', h('img', { src: 'img/mark.png', alt: '', width: 36, height: 36 }), h('span.wordmark', 'whos', h('span.wm-sup', 'sup'))),
    h('button.crew-switch.rail-crew', { onclick: openCrewSwitcher }, h('span.crew-e', g?.emoji || '🪩'), h('span.crew-n', g?.name || 'Crew'), icon('chevD', 16)),
    nav('rail-nav'),
    h('div.rail-foot', !S.online ? h('div.offline.mb-s', 'Offline — changes will fail') : null, h('button.rail-me', { onclick: openProfile }, avatar({ name: S.profile?.name, color: S.profile?.color }, 32), h('span', S.profile?.name || ''), S.api.demo ? h('span.demo-tag', 'Demo') : null)));

  let view;
  if (!S.crew.loaded) view = skeleton();
  else view = ({ calendar: calendarView, plans: plansView, chat: chatView, money: moneyView, crew: crewView })[S.tab]();
  const main = h('main.main' + (S.tab === 'chat' ? '.is-chat' : ''), { id: 'main' }, view);
  return h('div.shell', side, h('div.col', top, main, nav('tabbar')));
}

function go(tab) {
  if (S.tab === tab) { const m = document.querySelector('.main'); if (m) m.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.tab = tab;
  if (tab === 'chat') markChatSeen();
  render();
}

function skeleton() {
  return h('div.view', h('div.skel.h1'), h('div.skel.big'), h('div.skel'), h('div.skel'));
}

// Auto-check approval while waiting on the pending screen.
let pollT = null;
function pendingPoll() {
  if (S.screen === 'pending' && !pollT) pollT = setInterval(async () => {
    try { await refreshGroups(); if (group()?.status === 'active') { toast('You’re in! 🎉', 'ok'); route(); } } catch {}
  }, 15000);
  if (S.screen !== 'pending' && pollT) { clearInterval(pollT); pollT = null; }
}

function openNewPassword() {
  const f = { pw: '' };
  const s = openSheet({ title: 'Set a new password' }, body => {
    const inp = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters', oninput: e => (f.pw = e.target.value), autofocus: true });
    body.append(field('New password', inp), h('button.btn.primary.block.mt', { onclick: async () => {
      if (f.pw.length < 8) return toast('Use at least 8 characters', 'err');
      if (await attempt(() => S.api.updatePassword(f.pw).then(() => true), 'Password updated')) { S.recovery = false; s.close(); }
    } }, 'Save password'));
  });
}

// ── Start ────────────────────────────────────────────────────
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
const isDemo = new URLSearchParams(location.search).has('demo');
let api;
try { api = isDemo || !window.supabase ? new DemoApi() : new SupabaseApi(); }
catch (e) { console.error(e); api = new DemoApi(); }
if (!isDemo && !window.supabase) toast('Could not reach the server — showing the demo', 'err');
boot(api).catch(e => { console.error(e); S.screen = 'welcome'; render(); toast('Could not connect — check your internet', 'err'); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // When a new version takes over, reload once so people see the update straight away
  // (otherwise the old cached files show until the next visit). Not on the very first install.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true; location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
window.__whossup = { S, loadCrew, go, render };
