import { h, icon, avatar, money, relTime, fmtDay, iso } from '../util.js';
import { S, render, me, person, active, addExpense, deleteExpense, addSettlement, deleteSettlement, attempt, isAdmin, toast } from '../store.js';
import { balances, settleUp } from '../logic.js';
import { openSheet, confirmSheet, field, input, select, empty } from '../ui.js';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'PLN', 'SEK', 'NOK', 'DKK', 'CHF', 'CZK'];

export function moneyView() {
  const { expenses, settlements } = S.crew;
  const bal = balances(expenses, settlements);
  const curs = Object.keys(bal).length ? Object.keys(bal) : ['EUR'];
  const wrap = h('div.view.money-view');
  wrap.append(h('div.view-head', h('h1', 'Money'), h('button.btn.primary', { onclick: () => openExpenseForm({}) }, icon('plus', 18), h('span.hide-xs', 'Add expense'))));

  for (const cur of curs) {
    const b = bal[cur] || {};
    const mine = b[me()] || 0;
    const plan = settleUp(b);
    const card = h('div.card.money-hero' + (mine > 0.004 ? '.pos' : mine < -0.004 ? '.neg' : ''),
      h('div.mh-label', curs.length > 1 ? 'Your balance · ' + cur : 'Your balance'),
      h('div.mh-amt', mine > 0.004 ? '+' + money(mine, cur) : mine < -0.004 ? '−' + money(-mine, cur) : money(0, cur)),
      h('div.mh-sub', mine > 0.004 ? 'The crew owes you' : mine < -0.004 ? 'You owe the crew' : 'You’re all square ✨'));
    wrap.append(card);

    if (plan.length) {
      wrap.append(h('div.card',
        h('div.card-head', h('h3', 'Settle up'), h('span.muted.small', plan.length + (plan.length > 1 ? ' payments clear' : ' payment clears') + ' everything')),
        h('div.stack-s', plan.map(t => {
          const from = person(t.from), to = person(t.to), involved = t.from === me() || t.to === me();
          return h('div.settle' + (involved ? '.me' : ''),
            avatar(from, 30), h('span.settle-t', h('b', t.from === me() ? 'You' : from.name.split(' ')[0]), t.from === me() ? ' pay ' : ' pays ', h('b', t.to === me() ? 'you' : to.name.split(' ')[0])),
            h('span.grow'), h('b.settle-amt', money(t.amount, cur)),
            h('button.btn.sm.soft', { onclick: async () => {
              if (await confirmSheet({ title: 'Mark as paid?', text: (t.from === me() ? 'You' : from.name) + ' paid ' + (t.to === me() ? 'you' : to.name) + ' ' + money(t.amount, cur) + '.', ok: 'Mark paid' }))
                attempt(() => addSettlement({ from_user: t.from, to_user: t.to, amount: t.amount, currency: cur }), 'Recorded');
            } }, 'Paid'));
        }))));
    }
  }

  const people = active();
  if (expenses.length) {
    const b = bal[curs[0]] || {};
    wrap.append(h('div.card', h('div.card-head', h('h3', 'Balances'), curs.length > 1 ? h('span.muted.small', curs[0]) : null),
      h('div.stack-s', people.map(p => { const v = b[p.user_id] || 0; return h('div.bal-row', avatar(p, 28), h('span', p.user_id === me() ? 'You' : p.name), h('span.grow'),
        h('span.bal-v' + (v > 0.004 ? '.pos' : v < -0.004 ? '.neg' : ''), v > 0.004 ? '+' + money(v, curs[0]) : v < -0.004 ? '−' + money(-v, curs[0]) : '—')); }))));
  }

  const feed = [...expenses.map(e => ({ t: e.created_at, e })), ...settlements.map(s => ({ t: s.created_at, s }))].sort((a, b) => a.t < b.t ? 1 : -1);
  wrap.append(h('h3.list-title', 'Activity'));
  if (!feed.length) wrap.append(empty('wallet', 'No expenses yet', 'Paid for the cabin, the tickets or the taxi? Add it here and CrewCal works out who owes whom.', h('button.btn.primary', { onclick: () => openExpenseForm({}) }, 'Add the first expense')));
  else wrap.append(h('div.card.flush', feed.map(({ e, s }) => e ? expenseRow(e) : settleRow(s))));
  return wrap;
}

function expenseRow(e) {
  const payer = person(e.paid_by);
  const share = e.split_with.includes(me()) ? e.amount / e.split_with.length : 0;
  const ev = e.event_id && S.crew.events.find(x => x.id === e.event_id);
  const canDel = e.created_by === me() || isAdmin();
  return h('div.tx',
    h('div.tx-ic', icon('wallet', 18)),
    h('div.tx-main', h('div.tx-t', e.title), h('div.tx-s', (e.paid_by === me() ? 'You' : payer.name.split(' ')[0]) + ' paid · split ' + e.split_with.length + ' ways' + (ev ? ' · ' + ev.title : '') + ' · ' + relTime(e.created_at))),
    h('div.tx-r', h('b', money(e.amount, e.currency)),
      e.paid_by === me() ? h('span.tx-me.pos', 'you lent ' + money(e.amount - share, e.currency)) : share ? h('span.tx-me.neg', 'your share ' + money(share, e.currency)) : h('span.tx-me', 'not involved')),
    canDel ? h('button.iconbtn.xs.ghost', { 'aria-label': 'Delete expense', onclick: async () => { if (await confirmSheet({ title: 'Delete “' + e.title + '”?', ok: 'Delete', danger: true })) attempt(() => deleteExpense(e.id), 'Deleted'); } }, icon('trash', 15)) : null);
}
function settleRow(s) {
  const f = person(s.from_user), t = person(s.to_user);
  return h('div.tx.settled',
    h('div.tx-ic.ok', icon('check', 18)),
    h('div.tx-main', h('div.tx-t', (s.from_user === me() ? 'You' : f.name.split(' ')[0]) + ' paid ' + (s.to_user === me() ? 'you' : t.name.split(' ')[0])), h('div.tx-s', 'Settlement · ' + relTime(s.created_at))),
    h('div.tx-r', h('b', money(s.amount, s.currency))),
    (s.created_by === me() || isAdmin()) ? h('button.iconbtn.xs.ghost', { 'aria-label': 'Undo settlement', onclick: async () => { if (await confirmSheet({ title: 'Undo this payment?', ok: 'Undo', danger: true })) attempt(() => deleteSettlement(s.id)); } }, icon('x', 15)) : null);
}

export function openExpenseForm(pre) {
  const people = active();
  let lastCur; try { lastCur = localStorage.getItem('crewcal-cur'); } catch {}
  const f = { title: '', amount: '', currency: lastCur || 'EUR', paid_by: me(), event_id: '', ...pre };
  const ev = f.event_id && S.crew.events.find(e => e.id === f.event_id);
  const going = ev ? S.crew.rsvps.filter(r => r.event_id === ev.id && r.status === 'going').map(r => r.user_id) : [];
  const split = new Set(going.length > 1 ? going : people.map(p => p.user_id));
  const s = openSheet({ title: 'Add expense' }, (body, sheet) => {
    const per = h('div.per');
    const updPer = () => per.textContent = f.amount > 0 && split.size ? money(f.amount / split.size, f.currency) + ' each · ' + split.size + ' people' : '';
    body.append(
      field('What for', input([f, 'title'], { placeholder: ev ? ev.title + ' — tickets' : 'e.g. Cabin deposit', maxlength: 120, autofocus: true })),
      h('div.two.amt', field('Amount', input([f, 'amount'], { type: 'number', min: 0, step: '0.01', inputmode: 'decimal', placeholder: '0.00', onchange_: updPer })),
        field('Currency', select([f, 'currency'], CURRENCIES, { onpick: updPer }))),
      field('Paid by', select([f, 'paid_by'], people.map(p => [p.user_id, p.user_id === me() ? 'You' : p.name]))),
      h('div.field', h('div.row.between', h('span.flabel', 'Split between'), h('button.linkish.small', { onclick: () => { if (split.size === people.length) split.clear(); else people.forEach(p => split.add(p.user_id)); sheet.redraw(); } }, split.size === people.length ? 'None' : 'Everyone')),
        h('div.split-pick', people.map(p => h('button.split-p' + (split.has(p.user_id) ? '.on' : ''), { onclick: e => { split.has(p.user_id) ? split.delete(p.user_id) : split.add(p.user_id); e.currentTarget.classList.toggle('on'); updPer(); } }, avatar(p, 26), p.user_id === me() ? 'You' : p.name.split(' ')[0])))),
      per,
      field('For a plan', select([f, 'event_id'], [['', '— none —'], ...S.crew.events.filter(e => e.status === 'planned').slice(-20).map(e => [e.id, e.title + ' · ' + fmtDay(e.starts_on, { relative: false })])])),
      h('button.btn.primary.block.mt', { onclick: async evt => {
        const btn = evt.currentTarget;
        const amount = Math.round(+f.amount * 100) / 100;
        if (!f.title.trim()) return toast('What was it for?', 'err');
        if (!(amount > 0)) return toast('Enter an amount', 'err');
        if (!split.size) return toast('Pick who shares it', 'err');
        btn.disabled = true;
        try { localStorage.setItem('crewcal-cur', f.currency); } catch {}
        const ok = await attempt(() => addExpense({ title: f.title.trim(), amount, currency: f.currency, paid_by: f.paid_by, split_with: [...split], event_id: f.event_id || null }).then(() => true), 'Expense added');
        if (ok) { s.close(); if (S.tab !== 'money') toast('Added — see it in Money', 'ok'); } else btn.disabled = false;
      } }, 'Add expense'));
    updPer();
  });
}

