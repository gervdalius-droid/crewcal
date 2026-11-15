#!/usr/bin/env python3
"""End-to-end against the LIVE backend with a throwaway account (delete it afterwards:
   delete from auth.users where email = 'whossup-e2e@example.com')."""
import os, sys, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome
U = sys.argv[1] if len(sys.argv) > 1 else "https://gervdalius-droid.github.io/whossup/"
EMAIL, PW = "whossup-e2e@example.com", "e2e-Test-" + "x7Kq9!pass"
res = {}
def step(name, js, wait=1.5):
    r = c.eval(f"(async () => {{ try {{ {js} }} catch (e) {{ return 'ERR ' + e.message; }} }})()", await_promise=True)
    res[name] = r; print(f"{name:14} {r}"); time.sleep(wait)
with Chrome(width=390, height=844, dpr=2, port=9395) as c:
    c.goto(U, wait=3)
    step("signup", f"const a = __whossup.S.api; const r = await a.signUp('{EMAIL}', '{PW}'); return JSON.stringify(r);")
    step("session", "return (await __whossup.S.api.getSession())?.email")
    step("profile", "const p = await __whossup.S.api.saveProfile({name: 'E2E Tester', color: '#8b7cff'}); return p.name + ' ' + p.plan")
    step("plan-escal", "const {error} = await __whossup.S.api.sb.from('profiles').update({plan: 'pro'}).eq('id', __whossup.S.api.user.id); return error ? 'blocked: ' + error.code : 'NOT BLOCKED'")
    step("create", "const g = await __whossup.S.api.createGroup('E2E Crew', '🎲'); window.G = g; return g.name + ' ' + g.invite_code")
    step("groups", "return JSON.stringify((await __whossup.S.api.myGroups()).map(g => [g.name, g.role, g.status]))")
    step("busy", "const d = new Date(Date.now() + 864e5 * 3).toISOString().slice(0,10); await __whossup.S.api.setBusy(d, true); return (await __whossup.S.api.busy([__whossup.S.api.user.id], d, d)).length")
    step("event", "const e = await __whossup.S.api.saveEvent({group_id: G.id, title: 'E2E dinner', starts_on: '2026-12-12', ends_on: '2026-12-12'}); window.E = e; await __whossup.S.api.setRsvp(e.id, 'going'); return (await __whossup.S.api.rsvps([e.id])).map(r => r.status).join()")
    step("note", "const n = await __whossup.S.api.addNote(G.id, '2026-12-12', 'bring cake'); return n.body")
    step("realtime", "window.RT = []; window.UN = __whossup.S.api.subscribe(G.id, m => RT.push(m.body)); await new Promise(r => setTimeout(r, 2500)); await __whossup.S.api.sendMessage(G.id, 'hello live'); await new Promise(r => setTimeout(r, 3000)); return 'received via realtime: ' + JSON.stringify(RT)", wait=0.5)
    step("expense", "await __whossup.S.api.addExpense({group_id: G.id, title: 'Cake', amount: 12.5, currency: 'EUR', paid_by: __whossup.S.api.user.id, split_with: [__whossup.S.api.user.id]}); return (await __whossup.S.api.expenses(G.id)).map(x => x.amount).join()")
    step("ai", "const r = await __whossup.S.api.ai('trip', {group_id: G.id, title: 'E2E dinner', location: 'Vilnius, Lithuania', starts_on: '2026-12-12', ends_on: '2026-12-13', guests: 2}); return 'used ' + r.used + '/' + r.limit + ': ' + r.text.slice(0, 160)", wait=0.5)
    step("ai-events", "const r = await __whossup.S.api.ai('events', {group_id: G.id, months: ['2027-01'], categories: ['Music'], near: 'Europe'}); const m = r.text.match(/\\[[\\s\\S]*\\]/); const a = m ? JSON.parse(m[0]) : []; return a.length + ' events, e.g. ' + (a[0] ? a[0].title + ' @ ' + a[0].location + ' ' + a[0].starts_on : r.text.slice(0,120))", wait=0.5)
    step("ai-foreign", "try { await __whossup.S.api.ai('trip', {group_id: '00000000-0000-4000-8000-000000000001', title: 'x', location: 'y', starts_on: '2026-12-12', ends_on: '2026-12-12'}); return 'NOT BLOCKED' } catch (e) { return 'blocked: ' + e.message }")
    c.goto(U, wait=4)
    step("ui", "return document.body.dataset.screen + ' / crew loaded: ' + __whossup.S.crew.loaded + ' / ' + document.querySelector('.crew-n')?.textContent")
    c.shot(os.environ.get("SHOT", "/tmp/e2e.png"))
    print("console:", [l for l in c.drain_logs() if 'favicon' not in l])
