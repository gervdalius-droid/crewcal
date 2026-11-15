#!/usr/bin/env python3
"""Import each module on its own to pinpoint syntax errors (leaves first)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome
MODS = ["util", "config", "logic", "ui", "demo", "api", "store", "views/chat", "views/money", "views/crew", "views/plans", "views/calendar", "views/onboarding", "app"]
with Chrome(port=9343) as c:
    c.goto("http://localhost:8755/blank.html", wait=0.5)
    for m in MODS:
        r = c.eval(f"import('/js/{m}.js?v='+Date.now()).then(()=>'ok', e => String(e))", await_promise=True)
        print(f"{m:18} {r}")
