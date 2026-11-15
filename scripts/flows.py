#!/usr/bin/env python3
"""Open every sheet/dialog in the demo and screenshot it; fail on console errors.
   ONLY=phone|desktop  python3 scripts/flows.py [outdir]"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome
URL = "http://localhost:8755/"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "shots")
os.makedirs(OUT, exist_ok=True)

def clickText(c, sel, text):
    return c.eval(f"""(() => {{ const b = [...document.querySelectorAll({sel!r})].find(x => x.textContent.includes({text!r}) && x.offsetParent); if (!b) return 'missing'; b.click(); return 'ok'; }})()""")

STEPS = [
  ("day-sheet",     "go('calendar')", ("button.cell.all", None)),
  ("mark-mode",     "closeSheets(); go('calendar')", ("button", "Mark my busy days")),
  ("event-sheet",   "closeSheets(); S.cal.mark=false; go('plans')", (".ev-card", "Cabin weekend")),
  ("trip-sheet",    None, (".action", "Plan the trip")),
  ("trip-ai",       None, ("button", "Get local tips")),
  ("event-form",    "closeSheets(); go('plans')", (".view-head .btn", "")),
  ("ideas",         "closeSheets(); S.plans.seg='ideas'; go('plans'); render()", None),
  ("discover",      "S.plans.seg='discover'; render()", None),
  ("discover-res",  None, (".searchbar .btn", "Search")),
  ("brief-ai",      "S.plans.seg='upcoming'; render()", ("button", "What should we do next")),
  ("expense-form",  "go('money')", (".view-head .btn", "")),
  ("profile",       "closeSheets(); go('calendar')", (".me-btn, .rail-me", "")),
  ("upgrade",       None, ("button", "Go Pro")),
  ("crew-switch",   "closeSheets()", (".crew-switch", "")),
  ("chat-sent",     "closeSheets(); go('chat')", None),
]
fails = []
for name, (w, h, mobile) in {"phone": (390, 844, True), "desktop": (1440, 900, False)}.items():
    if os.environ.get("ONLY") and os.environ["ONLY"] != name: continue
    with Chrome(width=w, height=h, dpr=2 if mobile else 1, mobile=mobile, port=9351 if mobile else 9352) as c:
        c.cmd("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-color-scheme", "value": "dark"}]})
        c.goto(URL + "blank.html", wait=0.3); c.eval("localStorage.clear()")
        c.goto(URL + "?demo=1", wait=1.8)
        c.eval("window.S = __crewcal.S; window.go = __crewcal.go; window.render = __crewcal.render; window.closeSheets = () => document.querySelectorAll('.scrim').forEach(s => s.remove()) || document.body.classList.remove('has-sheet')")
        for step, pre, click in STEPS:
            if pre: c.eval(pre); time.sleep(0.5)
            if click:
                r = clickText(c, click[0], click[1] or "")
                if r != "ok": fails.append(f"{name}/{step}: could not click {click}")
            if step == "chat-sent":
                c.eval("document.getElementById('chat-in').value='See you all Friday 🍻'; document.getElementById('chat-in').dispatchEvent(new Event('input')); document.querySelector('.send').click()")
            time.sleep(1.6 if step in ("trip-ai", "discover-res", "brief-ai") else 0.7)
            c.shot(f"{OUT}/{name}-{step}.png")
        for l in c.drain_logs():
            if "favicon" not in l: fails.append(f"{name}: {l}")
print("\n".join(fails) if fails else "all flows ok, no console errors")
