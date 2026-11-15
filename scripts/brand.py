"""Generates every Whossup brand image into img/.

    pip install cairosvg fonttools
    python3 scripts/brand.py

The mark: a chat bubble with a "typing…" indicator whose dots climb, the last one popping
UP in neon = "who's up?". Text is converted to outlines, so output doesn't depend on installed fonts
(needs Poppins Bold + Inter Medium on the machine that runs this script).
"""
import os, cairosvg
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "img")
BRAND = os.path.join(IMG, "brand")
os.makedirs(BRAND, exist_ok=True)

class Font:
    def __init__(self, path):
        f = TTFont(path); self.gs = f.getGlyphSet(); self.cmap = f.getBestCmap(); self.upm = f["head"].unitsPerEm
    def paths(self, s, size, x=0, y=0, tracking=-0.03):
        sc = size / self.upm; out = []; cx = x
        for ch in s:
            g = self.cmap[ord(ch)]; pen = SVGPathPen(self.gs)
            self.gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, cx, y)))
            out.append(pen.getCommands()); cx += self.gs[g].width * sc + tracking * size
        return out, cx - x - tracking * size

POP = Font("/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf")
INTER = Font("/usr/share/fonts/opentype/inter/Inter-Medium.otf")

DEFS = '''
<linearGradient id="disco" gradientUnits="userSpaceOnUse" x1="170" y1="220" x2="860" y2="800">
  <stop offset="0" stop-color="#7c5cff"/><stop offset="0.55" stop-color="#ec4899"/><stop offset="1" stop-color="#fb7185"/></linearGradient>
<linearGradient id="pop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a3e635"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.42" r="0.62"><stop offset="0" stop-color="#ec4899" stop-opacity="0.38"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></radialGradient>
<radialGradient id="halo"><stop offset="0.45" stop-color="#ec4899" stop-opacity="0.45"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></radialGradient>
<radialGradient id="popglowr"><stop offset="0.5" stop-color="#a3e635" stop-opacity="0.7"/><stop offset="1" stop-color="#a3e635" stop-opacity="0"/></radialGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>'''

BUBBLE = '''
<ellipse cx="512" cy="520" rx="440" ry="360" fill="url(#halo)"/>
<rect x="168" y="250" width="688" height="460" rx="230" fill="url(#disco)"/>
<path d="M300 640 L250 822 L452 690 Z" fill="url(#disco)" stroke="url(#disco)" stroke-width="30" stroke-linejoin="round"/>
<rect x="168" y="250" width="688" height="460" rx="230" fill="url(#sheen)"/>
<circle cx="358" cy="540" r="52" fill="#fff"/>
<circle cx="512" cy="480" r="52" fill="#fff"/>
<circle cx="666" cy="404" r="96" fill="url(#popglowr)"/>
<circle cx="666" cy="404" r="58" fill="url(#pop)"/>'''

def sparkle(x, y, s, c="#fff", o=0.85):
    return (f'<path d="M{x} {y-s} Q{x+s*0.18} {y-s*0.18} {x+s} {y} Q{x+s*0.18} {y+s*0.18} {x} {y+s} '
            f'Q{x-s*0.18} {y+s*0.18} {x-s} {y} Q{x-s*0.18} {y-s*0.18} {x} {y-s}Z" fill="{c}" opacity="{o}"/>')

SPARKLES = sparkle(178, 168, 34) + sparkle(866, 196, 26, "#bff5ff") + sparkle(872, 860, 30, "#d6ff9e", 0.8)

def mark(scale=1.0, sparkles=True):
    t = (1 - scale) * 512
    return f'<g transform="translate({t},{t}) scale({scale})">{SPARKLES if sparkles else ""}{BUBBLE}</g>'

def icon(full_bleed=False, scale=1.0, sparkles=True):
    rx = 0 if full_bleed else 232
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>{DEFS}</defs>
<rect width="1024" height="1024" rx="{rx}" fill="#0b0a12"/><rect width="1024" height="1024" rx="{rx}" fill="url(#glow)"/>
{mark(scale, sparkles)}</svg>'''

def wordmark(size, base_fill, grad_id="wm"):
    """'whos' in base colour + 'sup' in the disco gradient. Returns (svg, width); baseline at y=0."""
    glyphs, w = POP.paths("whossup", size)
    body = "".join(f'<path d="{d}" fill="{base_fill if i < 4 else "url(#" + grad_id + ")"}"/>' for i, d in enumerate(glyphs))
    grad = (f'<linearGradient id="{grad_id}" gradientUnits="userSpaceOnUse" x1="{w*0.52}" y1="0" x2="{w}" y2="0">'
            '<stop offset="0" stop-color="#a78bfa"/><stop offset="0.5" stop-color="#ec4899"/><stop offset="1" stop-color="#fb7185"/></linearGradient>')
    return grad, body, w

def lockup(dark):
    size, mh, pad, gap = 150, 210, 40, 34
    grad, wm, w = wordmark(size, "#ffffff" if dark else "#14101f")
    W = int(pad + mh + gap + w + pad); H = mh + 60
    bg = f'<rect width="{W}" height="{H}" rx="36" fill="#0b0a12"/>' if dark else ""
    m = (f'<g transform="translate({pad},30) scale({mh/1024})"><rect width="1024" height="1024" rx="232" fill="#0b0a12"/>'
         f'<rect width="1024" height="1024" rx="232" fill="url(#glow)"/>{mark(1.0, False)}</g>')
    tx = pad + mh + gap
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>{DEFS}{grad}</defs>'
            f'{bg}{m}<g transform="translate({tx},{30 + mh*0.70})">{wm}</g></svg>'), W, H

def stacked():
    """640x640 welcome-screen logo on pure black (the app shows it with mix-blend-mode: screen)."""
    grad, wm, w = wordmark(120, "#ffffff")
    s = 0.52
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640"><defs>{DEFS}{grad}</defs>'
            f'<rect width="640" height="640" fill="#000"/>'
            f'<g transform="translate({320 - 512*s},{40}) scale({s})">{sparkle(178, 168, 34) + sparkle(866, 196, 26, "#bff5ff")}{BUBBLE}</g>'
            f'<g transform="translate({320 - w/2},{575})">{wm}</g></svg>')

def og():
    grad, wm, w = wordmark(64, "#ffffff", "wmo")
    l1, w1 = POP.paths("Find the day", 66, 0, 0, -0.02)
    l2, w2 = POP.paths("everyone’s free.", 66, 0, 0, -0.02)
    sub1, _ = INTER.paths("Shared availability, plans, AI trip ideas", 25, 0, 0, 0)
    sub2, _ = INTER.paths("and bill splitting for your crew.", 25, 0, 0, 0)
    cells = []
    pat = ["_m_maa_", "m___aam", "_mm_maa", "__maaa_", "m__m_aa"]
    for r, row in enumerate(pat):
        for c, k in enumerate(row):
            x, y = 742 + c * 64, 160 + r * 64
            fill = {"_": '#17171f" stroke="#ffffff" stroke-opacity="0.08', "m": "#3a3560", "a": "url(#cell)"}[k]
            cells.append(f'<rect x="{x}" y="{y}" width="56" height="56" rx="14" fill="{fill}"/>')
    P = lambda ps, fill: "".join(f'<path d="{d}" fill="{fill}"/>' for d in ps)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"><defs>{DEFS}{grad}
<radialGradient id="g1" cx="0.12" cy="0.15" r="0.5"><stop offset="0" stop-color="#7c5cff" stop-opacity="0.28"/><stop offset="1" stop-color="#7c5cff" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx="0.85" cy="0.9" r="0.55"><stop offset="0" stop-color="#ec4899" stop-opacity="0.24"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></radialGradient>
<linearGradient id="cell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="0.55" stop-color="#ec4899"/><stop offset="1" stop-color="#fb7185"/></linearGradient>
<linearGradient id="hl" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{w2}" y2="0"><stop offset="0" stop-color="#a78bfa"/><stop offset="0.5" stop-color="#ec4899"/><stop offset="1" stop-color="#fb7185"/></linearGradient></defs>
<rect width="1200" height="630" fill="#07070b"/><rect width="1200" height="630" fill="url(#g1)"/><rect width="1200" height="630" fill="url(#g2)"/>
<g transform="translate(72,72) scale({96/1024})"><rect width="1024" height="1024" rx="232" fill="#0b0a12"/>{mark(1.0, False)}</g>
<g transform="translate(186,140)">{wm}</g>
<g transform="translate(80,300)">{P(l1, "#f4f4f8")}</g>
<g transform="translate(80,378)">{P(l2, "url(#hl)")}</g>
<g transform="translate(82,452)">{P(sub1, "#b9b9c8")}</g>
<g transform="translate(82,488)">{P(sub2, "#b9b9c8")}</g>
{"".join(cells)}
</svg>'''

def save(name, svg, pngs, keep_svg=True):
    if keep_svg: open(os.path.join(BRAND, name + ".svg"), "w").write(svg)
    for path, w, h in pngs:
        cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(IMG, path), output_width=w, output_height=h)

save("whossup-icon", icon(), [("icon-512.png", 512, 512), ("icon-192.png", 192, 192),
                               ("apple-touch-icon.png", 180, 180), ("brand/whossup-icon-1024.png", 1024, 1024)])
save("whossup-icon-maskable", icon(full_bleed=True, scale=0.78, sparkles=False), [("icon-maskable-512.png", 512, 512)])
save("whossup-mark", icon(scale=1.08, sparkles=False), [("mark.png", 256, 256), ("favicon-32.png", 32, 32), ("favicon-48.png", 48, 48)])
save("whossup-stacked", stacked(), [("logo.png", 640, 640)])
save("og", og(), [("og.png", 1200, 630)], keep_svg=False)
for dark in (False, True):
    svg, W, H = lockup(dark)
    nm = "whossup-logo-dark" if dark else "whossup-logo"
    save(nm, svg, [(f"brand/{nm}.png", W * 2, H * 2)])
print("brand images written to img/ and img/brand/")
