#!/usr/bin/env python3
"""Report line:col of syntax errors per module (loads each as a classic script via blob)."""
import os, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
files = sorted(glob.glob(root + "/js/**/*.js", recursive=True))
JS = r"""(async (p) => {
  let src = await (await fetch(p + '?v=' + Date.now())).text();
  src = src.split('\n').map(l => /^\s*import\s/.test(l) ? '' : l.replace(/^export\s+(default\s+)?/, '').replace(/^export\s*\{[^}]*\};?/, '')).join('\n');
  return await new Promise(res => {
    const prev = window.onerror;
    window.onerror = (msg, url, line, col) => { res(msg + ' @ ' + line + ':' + col); return true; };
    const s = document.createElement('script');
    s.src = URL.createObjectURL(new Blob(['(function(){' + src + '\n})'], {type: 'text/javascript'}));
    s.onload = () => setTimeout(() => res('ok'), 30);
    document.head.appendChild(s);
  });
})"""
with Chrome(port=9344) as c:
    c.goto("http://localhost:8755/blank.html", wait=0.5)
    for f in files:
        rel = os.path.relpath(f, root)
        print(f"{rel:28}", c.eval(JS + f"('/{rel}')", await_promise=True))
