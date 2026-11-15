// Backend interface. Two implementations share it:
//   SupabaseApi — production (this file)
//   DemoApi     — in-browser sandbox for ?demo=1 and tests (demo.js)
import { SB_URL, SB_KEY, AI_FREE_MONTHLY } from './config.js';

const fail = (error) => { if (error) throw new Error(error.message || String(error)); };

export class SupabaseApi {
  constructor() {
    this.demo = false;
    this.sb = window.supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'whossup-auth' },
    });
    this.user = null;
  }

  // ── Auth ──
  async getSession() {
    const { data } = await this.sb.auth.getSession();
    this.user = data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
    return this.user;
  }
  onAuthChange(cb) {
    this.sb.auth.onAuthStateChange((ev, session) => {
      this.user = session ? { id: session.user.id, email: session.user.email } : null;
      cb(ev, this.user);
    });
  }
  async signIn(email, password) { const { error } = await this.sb.auth.signInWithPassword({ email, password }); fail(error); return this.getSession(); }
  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    fail(error);
    if (!data.session) return { needsConfirm: true };
    await this.getSession(); return { needsConfirm: false };
  }
  async magicLink(email) { const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname + location.search } }); fail(error); }
  async resetPassword(email) { const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); fail(error); }
  async updatePassword(password) { const { error } = await this.sb.auth.updateUser({ password }); fail(error); }
  async signOut() { await this.sb.auth.signOut(); this.user = null; }

  // ── Profile ──
  async getProfile() {
    const { data, error } = await this.sb.from('profiles').select('id,name,color,plan').eq('id', this.user.id).maybeSingle(); fail(error);
    return data;
  }
  async saveProfile({ name, color }) {
    const existing = await this.getProfile();
    const q = existing
      ? this.sb.from('profiles').update({ name, color }).eq('id', this.user.id)
      : this.sb.from('profiles').insert({ id: this.user.id, name, color });
    const { error } = await q; fail(error);
    return this.getProfile();
  }

  // ── Crews ──
  async myGroups() {
    const { data, error } = await this.sb.from('members')
      .select('role,status,created_at,group:groups(id,name,emoji,invite_code,require_approval,created_at)')
      .eq('user_id', this.user.id).order('created_at'); fail(error);
    return (data || []).map(r => ({ ...(r.group || { id: null, name: 'Crew', emoji: '🪩' }), role: r.role, status: r.status }))
      .filter(g => g.id || g.status === 'pending');
  }
  async createGroup(name, emoji) { const { data, error } = await this.sb.rpc('create_group', { p_name: name, p_emoji: emoji }); fail(error); return data; }
  async joinGroup(code) { const { data, error } = await this.sb.rpc('join_group', { p_code: code }); fail(error); return data; }
  async previewGroup(code) { const { data, error } = await this.sb.rpc('preview_group', { p_code: code }); fail(error); return data; }
  async updateGroup(id, patch) { const { error } = await this.sb.from('groups').update(patch).eq('id', id); fail(error); }
  async rotateInvite(id) { const { data, error } = await this.sb.rpc('rotate_invite', { g: id }); fail(error); return data; }
  async deleteGroup(id) { const { error } = await this.sb.from('groups').delete().eq('id', id); fail(error); }

  async members(gid) {
    const { data, error } = await this.sb.from('members').select('user_id,role,status,created_at').eq('group_id', gid); fail(error);
    const ids = (data || []).map(m => m.user_id);
    const { data: profs, error: e2 } = ids.length ? await this.sb.from('profiles').select('id,name,color').in('id', ids) : { data: [] }; fail(e2);
    const byId = Object.fromEntries((profs || []).map(p => [p.id, p]));
    return (data || []).map(m => ({ ...m, name: byId[m.user_id]?.name || 'Someone', color: byId[m.user_id]?.color || '#8b7cff' }));
  }
  async setMember(gid, uid, patch) { const { error } = await this.sb.from('members').update(patch).eq('group_id', gid).eq('user_id', uid); fail(error); }
  async removeMember(gid, uid) { const { error } = await this.sb.from('members').delete().eq('group_id', gid).eq('user_id', uid); fail(error); }

  // ── Availability ──
  async busy(userIds, from, to) {
    if (!userIds.length) return [];
    const { data, error } = await this.sb.from('busy_days').select('user_id,day,source').in('user_id', userIds).gte('day', from).lte('day', to); fail(error);
    return data || [];
  }
  async setBusy(day, on) {
    const q = on ? this.sb.from('busy_days').upsert({ user_id: this.user.id, day, source: 'manual' })
                 : this.sb.from('busy_days').delete().eq('user_id', this.user.id).eq('day', day);
    const { error } = await q; fail(error);
  }
  async addBusyDays(days, source = 'import') {
    if (!days.length) return;
    const rows = days.map(day => ({ user_id: this.user.id, day, source }));
    const { error } = await this.sb.from('busy_days').upsert(rows, { ignoreDuplicates: true }); fail(error);
  }
  async clearImported() { const { error } = await this.sb.from('busy_days').delete().eq('user_id', this.user.id).eq('source', 'import'); fail(error); }

  // ── Events ──
  async events(gid) { const { data, error } = await this.sb.from('events').select('*').eq('group_id', gid).order('starts_on'); fail(error); return data || []; }
  async saveEvent(ev) {
    const row = { ...ev }; delete row.created_at;
    const q = ev.id ? this.sb.from('events').update(row).eq('id', ev.id).select().single()
                    : this.sb.from('events').insert(row).select().single();
    let { data, error } = await q;
    // Database not migrated yet (004_trip_plan.sql): save the event without the plan rather than failing.
    if (error && /trip_plan/.test(error.message || '') && 'trip_plan' in row) { const r2 = { ...ev }; delete r2.trip_plan; return this.saveEvent(r2); }
    fail(error); return data;
  }
  async deleteEvent(id) { const { error } = await this.sb.from('events').delete().eq('id', id); fail(error); }
  async rsvps(eventIds) {
    if (!eventIds.length) return [];
    const { data, error } = await this.sb.from('rsvps').select('*').in('event_id', eventIds); fail(error); return data || [];
  }
  async setRsvp(eventId, status) {
    const q = status ? this.sb.from('rsvps').upsert({ event_id: eventId, user_id: this.user.id, status })
                     : this.sb.from('rsvps').delete().eq('event_id', eventId).eq('user_id', this.user.id);
    const { error } = await q; fail(error);
  }

  // ── Day notes ──
  async notes(gid) { const { data, error } = await this.sb.from('day_notes').select('*').eq('group_id', gid).order('created_at'); fail(error); return data || []; }
  async addNote(gid, day, body) { const { data, error } = await this.sb.from('day_notes').insert({ group_id: gid, day, body }).select().single(); fail(error); return data; }
  async deleteNote(id) { const { error } = await this.sb.from('day_notes').delete().eq('id', id); fail(error); }

  // ── Chat ──
  async messages(gid, limit = 150) {
    const { data, error } = await this.sb.from('messages').select('*').eq('group_id', gid).order('id', { ascending: false }).limit(limit); fail(error);
    return (data || []).reverse();
  }
  async sendMessage(gid, body) { const { data, error } = await this.sb.from('messages').insert({ group_id: gid, body }).select().single(); fail(error); return data; }
  subscribe(gid, onMessage) {
    const ch = this.sb.channel('chat-' + gid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'group_id=eq.' + gid }, p => onMessage(p.new))
      .subscribe();
    return () => this.sb.removeChannel(ch);
  }

  // ── Money ──
  async expenses(gid) { const { data, error } = await this.sb.from('expenses').select('*').eq('group_id', gid).order('created_at', { ascending: false }); fail(error); return (data || []).map(e => ({ ...e, amount: +e.amount })); }
  async addExpense(e) { const { data, error } = await this.sb.from('expenses').insert(e).select().single(); fail(error); return data; }
  async deleteExpense(id) { const { error } = await this.sb.from('expenses').delete().eq('id', id); fail(error); }
  async settlements(gid) { const { data, error } = await this.sb.from('settlements').select('*').eq('group_id', gid).order('created_at', { ascending: false }); fail(error); return (data || []).map(s => ({ ...s, amount: +s.amount })); }
  async addSettlement(s) { const { data, error } = await this.sb.from('settlements').insert(s).select().single(); fail(error); return data; }
  async deleteSettlement(id) { const { error } = await this.sb.from('settlements').delete().eq('id', id); fail(error); }

  // ── Pro waitlist ──
  async joinWaitlist(email, period) { const { error } = await this.sb.from('waitlist').upsert({ user_id: this.user.id, email, period }); fail(error); }

  // ── AI ──
  async ai(kind, params) {
    const { data: { session } } = await this.sb.auth.getSession();
    const r = await fetch(SB_URL + '/functions/v1/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + session?.access_token },
      body: JSON.stringify({ kind, ...params }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 402) { const e = new Error('quota'); e.quota = d; throw e; }
    if (!r.ok) throw new Error(d.error || 'AI request failed (' + r.status + ')');
    return d;
  }
  async aiUsage() {
    const month = new Date().toISOString().slice(0, 7);
    const { data } = await this.sb.from('ai_usage').select('count').eq('user_id', this.user.id).eq('month', month).maybeSingle();
    return { used: data?.count || 0, limit: AI_FREE_MONTHLY };
  }
}
