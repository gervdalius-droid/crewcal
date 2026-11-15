#!/usr/bin/env python3
"""Run test.html headless and print the result. Exit code 1 on failure."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome
with Chrome(port=9360, mobile=False, width=1000, height=800) as c:
    c.goto("http://localhost:8755/test.html", wait=1)
    for _ in range(40):
        if c.eval("document.body.dataset.done") == "1": break
        time.sleep(0.25)
    print(c.eval("document.getElementById('sum').textContent"))
    fails = c.eval("[...document.querySelectorAll('.fail')].slice(1).map(e => e.textContent + (e.nextElementSibling?.tagName === 'PRE' ? '\\n   ' + e.nextElementSibling.textContent : '')).join('\\n')")
    if fails: print(fails)
    errs = [l for l in c.drain_logs() if "favicon" not in l]
    if errs: print("\n".join(errs))
    sys.exit(0 if c.eval("document.body.dataset.fail") == "0" else 1)
