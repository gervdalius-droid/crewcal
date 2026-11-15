import { h, icon, avatar, hhmm, fmtDay, iso } from '../util.js';
import { S, me, person, sendMessage, markChatSeen, active } from '../store.js';
import { empty } from '../ui.js';

let stickToBottom = true;

export function chatView() {
  markChatSeen();
  const msgs = S.crew.messages;
  const list = h('div.chat-list', { role: 'log', 'aria-live': 'polite' });
  if (!msgs.length) list.append(empty('chat', 'Say hi to the crew', active().length > 1 ? 'Everyone in ' + (S.groups.find(g => g.id === S.gid)?.name || 'the crew') + ' sees this chat.' : 'Invite people from the Crew tab first.'));
  let lastDay = null, lastUser = null, lastTs = 0;
  for (const m of msgs) {
    const day = iso(new Date(m.created_at));
    if (day !== lastDay) { list.append(h('div.chat-day', h('span', fmtDay(day)))); lastDay = day; lastUser = null; }
    const mine = m.user_id === me();
    const ts = +new Date(m.created_at);
    const cont = m.user_id === lastUser && ts - lastTs < 5 * 60000;
    const p = person(m.user_id);
    list.append(h('div.msg' + (mine ? '.mine' : '') + (cont ? '.cont' : '') + (m.failed ? '.failed' : '') + (m.sending ? '.sending' : ''),
      !mine ? (cont ? h('span.msg-avsp') : avatar(p, 30)) : null,
      h('div.msg-col',
        !mine && !cont ? h('span.msg-name', { style: { color: p.color } }, p.name.split(' ')[0]) : null,
        h('div.bubble', linkify(m.body), h('span.msg-time', m.failed ? 'not sent' : hhmm(m.created_at))))));
    lastUser = m.user_id; lastTs = ts;
  }
  const ta = h('textarea.chat-in', { id: 'chat-in', rows: 1, placeholder: 'Message', value: S.chat.draft, 'aria-label': 'Message', maxlength: 2000,
    oninput: e => { S.chat.draft = e.target.value; grow(e.target); },
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(); } } });
  function send() { const t = S.chat.draft; if (!t.trim()) return; S.chat.draft = ''; ta.value = ''; grow(ta); stickToBottom = true; sendMessage(t); ta.focus(); }
  const composer = h('div.composer', ta, h('button.send', { 'aria-label': 'Send', onclick: send }, icon('send', 20)));
  list.addEventListener('scroll', () => { stickToBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80; });
  const wrap = h('div.view.chat-view', list, composer);
  requestAnimationFrame(() => { if (stickToBottom) list.scrollTop = list.scrollHeight; grow(ta); });
  return wrap;
}
function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
function linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => i % 2 ? h('a', { href: p, target: '_blank', rel: 'noopener' }, p) : p);
}
