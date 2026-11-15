#!/usr/bin/env python3
"""Screenshot every main screen of the demo at phone and desktop size.
   python3 scripts/shots.py [outdir]   (server: python3 serve.py)"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome

URL = "http://localhost:8755/"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "shots")
os.makedirs(OUT, exist_ok=True)
TABS = ["calendar", "plans", "chat", "money", "crew"]

def fresh(c, q="?demo=1"):
    c.goto(URL + "blank.html", wait=0.3)
    c.eval("localStorage.clear(); sessionStorage.clear()")
    c.goto(URL + q, wait=1.8)

def tab(c, t):
    c.eval(f"window.__crewcal.go('{t}')")
    time.sleep(0.6)

errors = []
CONF = {"phone": (390, 844, True, "light"), "phone-dark": (390, 844, True, "dark"), "desktop": (1440, 900, False, "dark"), "desktop-light": (1440, 900, False, "light")}
only = os.environ.get("ONLY")
for i, (name, (w, h, mobile, scheme)) in enumerate(CONF.items()):
    if only and only != name: continue
    with Chrome(width=w, height=h, dpr=2 if mobile else 1, mobile=mobile, port=9341 + i) as c:
        c.cmd("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-color-scheme", "value": scheme}]})
        fresh(c, "")
        c.shot(f"{OUT}/{name}-welcome.png")
        fresh(c)
        for t in TABS:
            tab(c, t)
            c.shot(f"{OUT}/{name}-{t}.png")
        for l in c.drain_logs():
            if "favicon" not in l: errors.append(f"{name}: {l}")
print("\n".join(errors) if errors else "no console errors")
print("shots in", os.path.abspath(OUT))
