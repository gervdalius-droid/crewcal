import { h, icon, avatar, PALETTE, iso, today, addDays, DOW } from '../util.js';
import { S, render, afterSignIn, refreshGroups, route, createCrew, joinCrew, toast, friendly, attempt, group } from '../store.js';
import { crewCreateForm, joinForm } from './crew.js';
import { segmented } from '../ui.js';

const auth = { mode: 'signin', email: '', password: '', busy: false, sent: '', err: '' };

export function welcomeScreen() {
  // The same availability grid as the share image: gradient days = everyone's free.
  const grid = h('div.hero-grid', { 'aria-hidden': 'true' });
  ['_m_maa_', 'm___aam', '_mm_maa', '__maaa_', 'm__m_aa'].join('').split('').forEach((v, i) =>
    grid.append(h('span.hg' + (v === 'a' ? '.all' : v === 'm' ? '.most' : ''), { style: { animationDelay: (i * 28) + 'ms' } })));
  const go = mode => () => { auth.mode = mode; S.screen = 'auth'; render(); };
  return h('div.onb.welcome',
    h('div.onb-glow'),
    h('div.welcome-in',
      h('section.welcome-hero',
        h('div.welcome-copy',
          h('div.brand-row', h('img.brand-mark', { src: 'img/mark.png', alt: '', width: 64, height: 64 }), h('span.brand-name', 'whos', h('span.wm-sup', 'sup'))),
          h('h1.welcome-h', 'Find the day', h('br'), h('span.disco-text', 'everyone’s free.')),
          h('p.welcome-p', 'Shared availability, plans, AI trip ideas and bill splitting for your crew.'),
          h('div.welcome-cta',
            h('button.btn.disco.lg', { onclick: go('signup') }, 'Get started — it’s free'),
            h('button.btn.ghost.lg', { onclick: go('signin') }, 'I already have an account')),
          h('a.demo-link', { href: '?demo=1' }, icon('sparkles', 15), 'Try the demo crew — no sign-up'),
          S.pendingInvite ? h('div.invite-note', icon('link', 16), 'You’ve been invited to a crew — sign in to join.') : null),
        grid),
      h('ol.welcome-steps',
        [['calendar', 'Mark your busy days', 'One tap per day — or import your calendar'],
         ['sparkles', 'See when everyone’s free', 'The best dates light up for the whole crew'],
         ['check', 'Make it happen', 'Plan it, RSVP, split the bill, chat']].map(([ic, t, d], i) =>
          h('li.wstep', { style: { animationDelay: (120 + i * 110) + 'ms' } },
            h('span.wstep-n', i + 1), h('span.wstep-ic', icon(ic, 18)),
            h('span.wstep-txt', h('b', t), h('span', d)))))));
}

export function authScreen() {
  const a = auth;
  const email = h('input', { id: 'auth-email', type: 'email', autocomplete: 'email', placeholder: 'you@email.com', value: a.email, required: true, oninput: e => (a.email = e.target.value), autofocus: true });
  const pw = h('input', { id: 'auth-pw', type: 'password', autocomplete: a.mode === 'signup' ? 'new-password' : 'current-password', placeholder: a.mode === 'signup' ? 'At least 8 characters' : 'Password', value: a.password, oninput: e => (a.password = e.target.value) });
  const form = h('form.auth-form', { onsubmit: e => { e.preventDefault(); submit(); } });
  if (a.sent) {
    form.append(h('div.sent', h('div.sent-ic', icon('mail', 28)), h('h2', 'Check your inbox'), h('p.muted', a.sent), h('button.btn.ghost.block', { type: 'button', onclick: () => { a.sent = ''; render(); } }, 'Back')));
  } else {
    form.append(
      segmented([['signin', 'Sign in'], ['signup', 'Create account'], ['magic', 'Email link']], a.mode, v => { a.mode = v; a.err = ''; render(); }, 'grow mb'),
      h('label.field', h('span.flabel', 'Email'), email),
      a.mode !== 'magic' ? h('label.field', h('span.flabel', 'Password'), pw) : h('p.muted.small.mb', 'We’ll email you a link that signs you in — no password needed.'),
      a.err ? h('div.err-box', a.err) : null,
      h('button.btn.iris.lg.block', { type: 'submit', disabled: a.busy }, a.busy ? 'One moment…' : a.mode === 'signup' ? 'Create account' : a.mode === 'magic' ? 'Send me a link' : 'Sign in'),
      a.mode === 'signin' ? h('button.linkish.center.mt', { type: 'button', onclick: forgot }, 'Forgot password?') : null,
      a.mode === 'signup' ? h('p.tiny.muted.center.mt', 'By continuing you agree to the ', h('a', { href: 'legal.html#terms', target: '_blank' }, 'Terms'), ' and ', h('a', { href: 'legal.html#privacy', target: '_blank' }, 'Privacy Policy'), '.') : null);
  }
  return h('div.onb',
    h('div.onb-glow'),
    h('div.onb-card',
      h('button.iconbtn.ghost.back', { 'aria-label': 'Back', onclick: () => { S.screen = 'welcome'; render(); } }, icon('chevL')),
      h('img.onb-mark', { src: 'img/mark.png', alt: '', width: 56, height: 56 }),
      h('h1.onb-h', a.mode === 'signup' ? 'Create your account' : 'Welcome back'),
      form));

  async function submit() {
    if (a.busy) return;
    const em = a.email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { a.err = 'Enter a valid email'; return render(); }
    if (a.mode === 'signup' && a.password.length < 8) { a.err = 'Use at least 8 characters for the password'; return render(); }
    if (a.mode === 'signin' && !a.password) { a.err = 'Enter your password'; return render(); }
    a.busy = true; a.err = ''; render();
    try {
      if (a.mode === 'magic') { await S.api.magicLink(em); a.sent = 'We sent a sign-in link to ' + em + '. Open it on this device.'; }
      else if (a.mode === 'signup') {
        const r = await S.api.signUp(em, a.password);
        if (r.needsConfirm) a.sent = 'We sent a confirmation link to ' + em + '. Click it, then come back here.';
        else { a.busy = false; a.password = ''; await afterSignIn(); return; }
      } else { await S.api.signIn(em, a.password); a.busy = false; a.password = ''; await afterSignIn(); return; }
    } catch (e) { a.err = friendly(e); }
    a.busy = false; render();
  }
  async function forgot() {
    const em = a.email.trim();
    if (!em) { a.err = 'Type your email first'; return render(); }
    await attempt(() => S.api.resetPassword(em));
    a.sent = 'If an account exists for ' + em + ', a password reset link is on its way.'; render();
  }
}

const prof = { name: '', color: PALETTE[Math.floor(Math.random() * PALETTE.length)] };
export function profileScreen() {
  const preview = h('div.prof-preview');
  const upd = () => preview.replaceChildren(avatar({ name: prof.name || '?', color: prof.color }, 72));
  upd();
  const name = h('input', { placeholder: 'e.g. Alex', maxlength: 40, value: prof.name, autofocus: true, autocomplete: 'given-name', oninput: e => { prof.name = e.target.value; upd(); }, onkeydown: e => e.key === 'Enter' && save() });
  return h('div.onb', h('div.onb-glow'), h('div.onb-card',
    h('div.steps', h('i.on'), h('i'), h('i')),
    preview,
    h('h1.onb-h', 'What should your crew call you?'),
    h('label.field', h('span.flabel', 'Your name'), name),
    h('div.field', h('span.flabel', 'Pick your colour'), h('div.color-pick', PALETTE.map(c => h('button' + (prof.color === c ? '.on' : ''), { style: { '--c': c }, 'aria-label': c, onclick: e => { prof.color = c; e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); upd(); } })))),
    h('button.btn.iris.lg.block.mt', { onclick: save }, 'Continue')));
  async function save() {
    if (!prof.name.trim()) return toast('Enter your name', 'err');
    const p = await attempt(() => S.api.saveProfile({ name: prof.name.trim(), color: prof.color }));
    if (!p) return;
    S.profile = p; await refreshGroups();
    if (S.pendingInvite) { render(); return; }
    route();
  }
}

const cf = { tab: 'create', name: '', emoji: '🪩', code: '' };
export function crewScreen() {
  const card = h('div.onb-card',
    h('div.steps', h('i.done'), h('i.on'), h('i')),
    h('h1.onb-h', 'Start a crew'),
    h('p.muted.center.mb', 'A crew is your group of friends, team or family. You can be in several.'),
    segmented([['create', 'Create a crew'], ['join', 'I have a code']], cf.tab, v => { cf.tab = v; render(); }, 'grow mb'));
  if (cf.tab === 'create') card.append(crewCreateForm(cf, null, async () => { const g = await attempt(() => createCrew(cf.name.trim(), cf.emoji)); if (g) { S.tab = 'crew'; render(); toast('Crew created — now invite your friends 🎉', 'ok'); } }));
  else card.append(joinForm(cf, async () => { const r = await attempt(() => joinCrew(cf.code)); if (r && r.status === 'active') toast('Welcome to ' + r.name + ' 🎉', 'ok'); }));
  card.append(h('button.linkish.center.mt', { onclick: () => S.api.signOut() }, 'Sign out'));
  return h('div.onb', h('div.onb-glow'), card);
}

export function pendingScreen() {
  const g = group();
  const others = S.groups.filter(x => x.status === 'active');
  return h('div.onb', h('div.onb-glow'), h('div.onb-card.center',
    h('div.steps', h('i.done'), h('i.done'), h('i.on')),
    h('div.crew-emoji.xl.pulse', g?.emoji || '🪩'),
    h('h1.onb-h', 'Waiting to join ' + (g?.name || 'the crew')),
    h('p.muted', 'An admin needs to let you in. You’ll get access as soon as they approve — usually within minutes.'),
    h('button.btn.soft.block.mt', { onclick: async () => { await attempt(refreshGroups); route(); if (group()?.status === 'pending') toast('Still waiting for approval'); } }, icon('refresh', 16), 'Check again'),
    others.length ? h('button.btn.ghost.block', { onclick: () => { S.gid = others[0].id; route(); } }, 'Open ' + others[0].name + ' instead') : null,
    h('button.linkish.center.mt', { onclick: () => S.api.signOut() }, 'Sign out')));
}

