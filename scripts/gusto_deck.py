"""GUSTO deck v2 — built against `Case study presentation (GUSTO) (6).pdf`.

Every slide is native HTML on the 1920x1080 canvas. Screenshots are
re-rendered straight out of the PDF at 4x (vector-crisp where the source
is vector, native-res where it is bitmap) and placed at the exact rect they
were cropped from, so placement can't drift. Where a slide shows UI that
exists as a gallery prototype, the live page is mounted instead (`live`).

    python3 scripts/gusto_deck.py [--fast]   # crops + src/data/gustoDeck.json (--fast keeps existing crops)
"""
import json, os, sys
import fitz
from PIL import Image

PDF = '/Users/ep/Downloads/Case study presentation (GUSTO) (6).pdf'
REPO = '/Users/ep/valentinapdesign'
OUT = f'{REPO}/src/data/gustoDeck.json'
CROPS = f'{REPO}/public/website/case/gusto/v2'
SLIDES = f'{REPO}/public/website/case/gusto/slides'
SCALE = 4

doc = fitz.open(PDF)
os.makedirs(CROPS, exist_ok=True)
made = set()


def crop(n, key, x0, y0, x1, y1, strip=(), wipe=()):
    """Render % rect of page n; return a `shots` entry placed at that rect.
    `strip` words are the slide's own captions that overlap the crop — they
    are redacted from a throwaway copy first, since the deck sets them as
    real type."""
    name = f'{n:03d}{key}'
    r = fitz.Rect(x0 * 19.2, y0 * 10.8, x1 * 19.2, y1 * 10.8)
    path = f'{CROPS}/{name}.webp'
    if '--fast' not in sys.argv or not os.path.exists(path):
        page = doc[n - 1]
        if strip or wipe:
            tmp = fitz.open(PDF)
            page = tmp[n - 1]
            for (a, b, c, d) in wipe:
                page.add_redact_annot(fitz.Rect(a * 19.2, b * 10.8, c * 19.2, d * 10.8), fill=False)
            for w in page.get_text('words'):
                if w[4] in strip and fitz.Rect(w[:4]).intersects(r):
                    page.add_redact_annot(fitz.Rect(w[:4]) + (-3, -3, 3, 8), fill=False)
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE if wipe else fitz.PDF_REDACT_IMAGE_NONE,
                                  graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED)
        pm = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=r)
        pm.pil_save(path, quality=90, method=6)
    made.add(name)
    return {"src": name, "x": x0, "y": y0, "w": round(x1 - x0, 3)}


_prev = fitz.open('/Users/ep/Downloads/Case study presentation (GUSTO) (4).pdf')


def resolve(n, xref):
    """Image xrefs move between exports. An xref that sits on page n and has
    the same size as it did in the previous export is kept; otherwise the
    same-sized bitmap on page n is used."""
    on_page = {i[0]: (i[2], i[3]) for i in doc[n - 1].get_images(full=True)}
    try:
        want = (lambda p: (p.width, p.height))(fitz.Pixmap(_prev, xref))
    except Exception:
        want = None
    if xref in on_page and (want is None or on_page[xref] == want):
        return xref
    for x, size in on_page.items():
        if size == want:
            return x
    raise SystemExit(f"slide {n}: image xref {xref} {want} not found")


def cardimg(n, tag, xref, x, w, y=None, cy=None, radius=30, key=True):
    """An embedded screenshot pulled at native resolution, with the flat
    backdrop it was exported on cut away: the card's own 1px border is
    found by scanning in from each edge, and everything outside that
    rounded rect goes transparent. Placed at x/w (% of canvas), top at y or
    vertically centred on cy."""
    name = f'{n:03d}{tag}'
    path = f'{CROPS}/{name}.webp'
    xref = resolve(n, xref)
    base = fitz.Pixmap(doc, xref)
    if base.n > 3 or base.alpha:
        base = fitz.Pixmap(fitz.csRGB, base)
    im = Image.frombytes('RGB', (base.width, base.height), base.samples)
    W, H = im.size
    if key:
        bg = im.getpixel((2, H // 2))
        far = lambda p: max(abs(a - b) for a, b in zip(p, bg)) > 8
        l = next(i for i in range(W) if far(im.getpixel((i, H // 2))))
        r = next(i for i in range(W - 1, 0, -1) if far(im.getpixel((i, H // 2))))
        t = next(i for i in range(H) if far(im.getpixel((W // 2, i))))
        bt = next(i for i in range(H - 1, 0, -1) if far(im.getpixel((W // 2, i))))
        im = im.crop((l, t, r + 1, bt + 1))
    from PIL import ImageDraw
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    im.putalpha(mask)
    im.save(path, 'WEBP', quality=92, method=6)
    made.add(name)
    h = w * 19.2 * im.height / im.width / 10.8
    if y is None:
        y = cy - h / 2
    return {"src": name, "x": x, "y": round(y, 3), "w": w}


def asset(name, file, x, w, y, quality=None, trim=False):
    """A component export from the design library (scripts/deck-assets), not the
    PDF: encoded lossless into the crops dir so it keeps its alpha corners."""
    path = f'{CROPS}/{name}.webp'
    im = Image.open(f'{os.path.dirname(os.path.abspath(__file__))}/deck-assets/{file}').convert('RGBA')
    if trim:  # drop an export's shadow margin: crop to the opaque card
        im = im.crop(im.split()[3].point(lambda v: 255 if v > 250 else 0).getbbox())
    if quality:  # big screens: lossy keeps the page light
        im.save(path, 'WEBP', quality=quality, method=6)
    else:
        im.save(path, 'WEBP', lossless=True, method=6)
    made.add(name)
    return {"src": name, "x": x, "y": y, "w": w}


def place(shot, x, w, y=None, cy=None):
    """Show a crop larger than the PDF drew it: same pixels (rendered at 4x),
    new rect. Height follows the crop's own aspect."""
    im = Image.open(f'{CROPS}/{shot["src"]}.webp')
    h = w * 19.2 * im.height / im.width / 10.8
    if y is None:
        y = cy - h / 2
    return {"src": shot["src"], "x": x, "y": round(y, 3), "w": w}


def recrop(n, key, x, y, w, aspect):
    """An old placement (x, y, w + the crop's aspect) re-rendered from the new PDF."""
    h = w * 19.2 / aspect / 10.8
    return crop(n, key, x, y, x + w, y + h)


def raster(n):
    path = f'{SLIDES}/{n:03d}.webp'
    os.makedirs(SLIDES, exist_ok=True)
    if '--fast' not in sys.argv or not os.path.exists(path):
        doc[n - 1].get_pixmap(matrix=fitz.Matrix(3, 3)).pil_save(path, quality=90, method=6)
    return {"bg": "black", "raster": f'{n:03d}.webp'}


# ---- live prototypes -----------------------------------------------------
# Each is the real gallery page in an iframe. `vw` is the viewport the page
# lays out at; the box (x/y/w/h, % of canvas) decides the scale. Pages are
# re-grounded to transparent so they sit on the slide, not on a tile.
TICKET_BG = ".ob-stage{background:none!important}"
NO_HEADER = ".wshell-bar{display:none!important}"
WIDGETS_ONLY = (".wsp-stage,.wsp-screen,.wsp,.wsp-canvas{background:none!important;box-shadow:none!important;border-color:transparent!important}"
                ".wsp-screen{overflow:visible!important}.wsp-rail{visibility:hidden!important}"
                ".ob-scrim{background-color:transparent!important}")  # its tint drew a box on the black slide
# slide 44's tickets, pared down: no estimate, no bracket/special-instructions
# adders, and every CTA label in the same type (Submit was 400, Sell/Buy 600)
LEAN = (".ob-cost,.st-attach-stack,.wshell-actions{display:none!important}"
        ".ob-foot{justify-content:flex-end!important}"
        ".ob-cta-label{font-weight:600!important}")  # the widget without its title bar
FOF_BG = ".fof-stage{background:none!important}"
ACS_BG = ".acs-root{background:none!important}"
PHONE_BG = ".phone-stage{background:none!important}"
NQ_BG = ".nq-root,.phone-stage{background:none!important}"
HE_BG = ".he-root{background:none!important}"
OPA_BG = ".opa-stage{background:none!important}"


def live(page, x, y, w, h, vw=1280, css="", fit=None, vh=960, clip=False, pad=0, mode=None, init=None):
    e = {"page": page, "x": x, "y": y, "w": w, "h": h, "vw": vw, "css": css}
    if mode:
        e["mode"] = mode  # "width": fill the rect's width, top-aligned, free to bleed off the slide
    if init:
        e["init"] = init  # a named action the deck runs inside the page once it has loaded
    if pad:
        e["pad"] = pad
    if clip:
        e["clip"] = True
    if fit:
        e.update(fit=fit, vh=vh)
    return e


# what each page's work IS, for measured placement
CARD = ".wshell"
PHONE = 'img[src*="iphone"]'



JOURNEY = ["Idea generation", "Conviction building", "Execution", "Monitoring"]
PILLARS = ["Reduce time to trade", "Standardize", "Innovate while respecting the past"]
GOALS = ["Help traders find fractional symbols", "Allow traders to seamlessly place a fractional trade"]
NORTH = {"title": "North star", "sections": [
    {"label": "Symbol availability", "items": [["US symbols", True], ["CAD symbols", True]]},
    {"label": "Supported order types", "items": [["Market orders", True], ["Limit orders", True]]},
    {"label": "Supported action types", "items": [["Buy orders", True], ["Sell orders", True]]},
    {"label": "Order management", "items": [["Order placement", True], ["Order modification", True]]}]}
MVP = {"title": "MVP scope", "sections": [
    {"label": "Symbol availability", "items": [["US symbols", True], ["CAD symbols", True]]},
    {"label": "Supported order types", "items": [["Market orders", True], ["Limit orders", False]]},
    {"label": "Supported action types", "items": [["Buy orders", True], ["Sell orders", False]]},
    {"label": "Order management", "items": [["Order placement", True], ["Order modification", False]]}]}

DARK_PANEL = "#111116"
LIGHT_PANEL = "#f2f2f2"


def P(x, w, c, y=0):
    return {"x": x, "w": w, "y": y, "c": c}


def S(text, kicker=None, bg="black", corner=None, fw=None):
    e = {"kind": "statement", "bg": bg, "text": text}
    if fw: e["fw"] = fw
    if kicker: e["kicker"] = kicker
    if corner: e["corner"] = corner
    return e


def D(text, bg="black", size="lg", **kw):
    e = {"kind": "divider", "bg": bg, "text": text, "size": size}
    e.update(kw)
    return e


N = {}
INSERT_AFTER = {}
# ---- intro ----------------------------------------------------------------
N[1] = {"kind": "cover", "bg": "black", "title": "Valentina Padure", "sub": "Portfolio presentation"}
for i, n in enumerate(range(2, 10)):
    N[n] = {"kind": "ownership", "bg": "black", "reveal": i + 1}
N[10] = {"kind": "ownership", "bg": "black", "reveal": 8, "dim": True}

# ---- case study 1: order entry --------------------------------------------
N[11] = {"kind": "titlecard", "bg": "black", "kicker": "Case study", "title": "Order entry\nmodernization", "fs": 120}
N[12] = D("Background")
N[14] = S("Launch a new, modernized trading platform", "Solution")
N[17] = {"kind": "role", "bg": "black",
         "rows": [["My role", "Lead Designer for the order entry widget"], ["Design Timeline", "6 months"],
                  ["Team", "2 Engineering teams\n1 UX Researcher"]],
         "live": [live("stock-order-entry", 55, 22, 36, 60, css=TICKET_BG, fit=CARD)]}
N[18] = D("The journey")
N[20] = S("Led foundational research with active traders\nto evaluate the full trading journey.", "Pivoting the research")
N[25] = {"kind": "metrics", "bg": "black", "kicker": "Success metrics",
         "items": [{"text": "Reduce time to\ntrade by 15%"}, {"text": "Reduce number of\nclicks by 30%"}]}
N[26] = D("How?")
N[27] = S("What data do we show and how?", "Reducing time to trade")
N[35] = S("How do we make the option trade\nexperience faster?", "Reducing time to trade")
N[36] = S("What are options?")
N[37] = {"kind": "twocol", "bg": "black", "panels": [P(0, 50, DARK_PANEL)],
         "left": "Single-leg / Option = 🍔", "right": "Multi-leg / Strategy = 🍔🥤🍟"}
N[39] = S("The journey between finding an option and\nplacing an option trade was broken", "Reducing time to trade")
N[41] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade",
         "shots": [crop(41, 'a', 10.4, 13.2, 89.6, 95.0)]}
# product vision: V1 is the live options ticket, V2 the strategy builder export, both at
# 1.2x their CSS size (ticket 357 wide, builder 763), top-aligned and centred as a pair
N[50] = {"kind": "media", "bg": "black", "corner": "Product vision",
         "labels": [{"text": "V1", "x": 23.02, "y": 23}, {"text": "V2", "x": 64.27, "y": 23}],
         "shots": [asset("046-atlas-strategy-builder", "atlas-strategy-builder.png", 40.42, 47.71, 27.78, trim=True)],
         "live": [live("options-strategy-builder", 11.875, 27.78, 22.29, 40, css=TICKET_BG, fit=CARD, mode="width")]}
N[53] = D("Final designs")
N[55] = dict(raster(55), live=[live("chain-to-order", 12.2, 8.3, 75.3, 83.6, 1440,
                                     fit=".wsp-screen", vh=900, clip=True)])
N[56] = D("Impact")
N[57] = {"kind": "figures", "bg": "black", "tone": "mint", "panels": [P(0, 50, DARK_PANEL)], "split": True,
         "items": [["60%", "faster to place trades"], ["85%", "Satisfaction score during the closed beta"]]}
N[58] = D("Reflections")

# ---- case study 2: fractional shares (export 6, new pages 59-102) ---------
# Live prototypes still wired at their new page numbers: order-placement-boxed
# pair (86), limit-order edge cases (88-90), the two collage slides (94, 96 —
# switch icon / fractional banner / fractional-order-flow, and typed error /
# order-placed animation / order-placement-boxed). The old 76-86 build-up
# (symbol-discovery releases, dark design-language comparison, wizard vs
# suggested design) is NOT carried forward live — see the NEEDS REVIEW block
# near the end of this file (new pages 76-85).
CANVAS = "#f6f4f5"
WHITE_BG = "html,body,html[data-embed],html[data-embed] body{background:#fff!important}"

N[61] = S("Introduce fractional trading", bg="white", corner="Solution")
N[65] = {"kind": "media", "bg": "white", "corner": "Research",
         "shots": [crop(65, 'a', 31.6, 19.4, 68.8, 100)]}
N[66] = S("Traders need affordable and flexible\nways to trade.", bg="white", corner="Problem", fw=600)
N[66]["fs"] = 80
N[67] = S("1 Feature.", bg="white", corner="Design challenge", fw=600)
N[68] = S("1 Feature. 2 Personas.", bg="white", corner="Design challenge", fw=600)
N[69] = S("1 Feature. 2 Personas. 2 Design languages", bg="white", corner="Design challenge", fw=600)
N[71] = {"kind": "media", "bg": "white", "corner": "2 Platforms = 2 Design languages",
         "panels": [P(0, 50, LIGHT_PANEL)],
         # captions 5px above the phones (sm box 18px; phones' top edge at 35.28% = 381px)
         "labels": [{"text": "Regular trading platforms", "x": 25, "y": 33.15},
                    {"text": "Advanced trading platforms", "x": 75, "y": 33.15}],
         # regular = the light quote screen, advanced = the dark quote screen; both live,
         # at slide 80's phone size centred in their halves, bleeding off the bottom, with
         # every fractional part hidden (this slide is about the two design languages)
         "live": [live("notive-quote", 8.35, 35.28, 33.3, 64.72, fit=PHONE, vh=1000, mode="width",
                       css=NQ_BG + ".nq-banner,.nq-frac-slot{display:none!important}"),
                  live("alert-creation", 58.35, 35.28, 33.3, 64.72, fit=PHONE, vh=1000, mode="width",
                       css=ACS_BG + "div:has(> .acs-frac-card){display:none!important}")]}
N[73] = {"kind": "checklist", "bg": "white", "corner": "Project scope", "panels": [P(0, 50, LIGHT_PANEL)], "cols": [NORTH, MVP]}
# NEEDS REVIEW: the two goal-card header icons (cardimg xrefs 4260/4262 off old
# page 75) no longer resolve against export (6) — the bitmap moved or resized
# even though this page's TEXT is unchanged. Dropped for now (icon=None); the
# two live pieces below (order-placed-animation, holdings-empty-state) are
# unaffected and still wired.
GOAL_CARDS = [{"x": 5.8, "y": 25.95, "w": 40.57, "h": 45.05, "icon": None,
               "text": "Help traders discover\nfractional symbols"},
              {"x": 50.02, "y": 25.95, "w": 40.57, "h": 45.05, "icon": None,
               "text": "Allow traders to place\na fractional trade"}]
# the check in the second card is the order-placed animation itself, sitting
# exactly where the goals layout puts the icon (measured: 65.7, 34.59, 9.2 x 15.35)
GOAL_LIVE = [live("order-placed-animation", 65.7, 34.59, 9.2, 15.35, css=OPA_BG,
                  fit=".opa-badge", vh=1000, clip=True, pad=14, init="mute")]
GOAL_CARDS_LIVE = GOAL_CARDS
# ...and the symbol finder is the holdings magnifier, the same size as the check tile
GOAL_LIVE = GOAL_LIVE + [live("holdings-empty-state", 26.1 - 4.6, 34.59, 9.2, 15.35, css=HE_BG, fit=".he-card", vh=1000)]
N[75] = {"kind": "goals", "bg": "white", "corner": "Goal", "cards": GOAL_CARDS_LIVE, "live": GOAL_LIVE}
N[86] = {"kind": "media", "bg": "white", "corner": "Happy path",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Old design", "x": 26.99, "y": 13.2}, {"text": "Updated design", "x": 73.57, "y": 13.2}],
         # both columns are the boxed ticket; "Old design" is the same screen
         # before the shares / dollar switcher (same label, no chevron)
         # rects are the phone's own aspect (1218x2475) at 850 canvas px tall,
         # tops 6px under the labels; the old design also loses the fractional button
         "live": [live("order-placement-boxed", 16.09, 15.84, 21.79, 78.7, css=PHONE_BG + ".opb-frac-btn{visibility:hidden!important}", fit=PHONE, vh=1000, init="quantityOnly"),
                  live("order-placement-boxed", 62.67, 15.84, 21.79, 78.7, css=PHONE_BG, fit=PHONE, vh=1000)]}
N[88] = {"kind": "media", "bg": "white", "corner": "Navigating edge cases",
         # placeholder caption, its box ending on the phone's top edge like slide 90's
         "labels": [{"text": "Label", "x": 50.64, "y": 29.56, "size": "lg"}],
         # the edge cases run on the live fractional order flow, opened on a Limit order
         "live": [live("fractional-order-flow", 35.61, 32.43, 30.07, 67.57, css=FOF_BG, fit=".fof-frame", vh=1000, mode="width", init="limitOrder")]}
N[89] = {"kind": "media", "bg": "white", "corner": "Navigating edge cases",
         "labels": [{"text": "V1", "x": 31.45, "y": 34.4}, {"text": "V2", "x": 73.25, "y": 34.4}],
         # the two error wordings, static (no ticking, no typing): the fractional order flow's
         # ?fractionError state on a Limit order with 0.5 typed in, exported from the page with
         # the quote frozen at $300.00, at the phones' old rects (top-aligned, bleeding off)
         "shots": [asset(f"090-limit-error-{v}", f"fractional-limit-error-{v}.png", x, 31.01, 38.2, quality=92)
                   for x, v in ((16.05, "v1"), (57.71, "v2"))]}
# the same Limit screen as the V1/V2 slide (?static: quote frozen at $300.00), at their phone
# size and height, centred; on arrival 1.5 is completed in the quantity and the blue hint +
# the limit-order-error ring round the order pill play together
N[90] = {"kind": "media", "bg": "white", "corner": "Navigating edge cases",
         "labels": [{"text": "Label", "x": 50, "y": 34.4, "size": "lg"}],  # placeholder
         "live": [dict(live("fractional-order-flow?fractionError=hint&hintShares=1.5&static", 50 - 31.01 / 2, 38.2, 31.01, 61.8, css=FOF_BG,
                            fit=".fof-frame", vh=1000, mode="width", init="fracHintSetup"), arrive="fracHintType")]}
N[91] = {"kind": "media", "bg": "white", "corner": "Navigating edge cases",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "shots": [crop(91, 'a', 14.0, 16.8, 36.3, 90.4), crop(91, 'b', 59.5, 22.5, 91.0, 75.0)]}
N[92] = D("Final designs", bg="white", tone="green")
N[93] = D("", bg="white")

# final-design collages: the cards and icons stay the PDF's (re-rendered),
# everything that exists as a prototype is wiped from the render and runs live
_P95 = (62.9, 5.2, 87.8, 94.0)       # the phone
_SW = (21.0, 16.3, 33.4, 36.5)       # the switcher icon (both collages)
SWITCHER = live("fractional-order-flow", 21.0, 16.3, 12.4, 20.2, css=FOF_BG,
                fit='[aria-label="Swap amount and quantity"]', vh=1000, clip=True, pad=30)
# slide 95's switcher is the standalone SwitchIcon piece (/work/switch-icon), tapping itself
SWITCH_ICON = live("switch-icon", 21.0, 16.3, 12.4, 20.2, css=".si-stage{background:none!important}",
                   fit='[aria-label="Switch"]', vh=1000, clip=True, pad=30, init="switchLoop")
_S95 = (6.4, 65.4, 45.9, 81.4)       # the white strip holding the banner icon
# the PDF's three light cards drawn under the corner title (see slide 97), the tiles
# re-centred on them; the phone at slide 97's phone height, contained in its rect
_C95 = "#f7f7f7"
CARDS_UNDER_TITLE = [{"x": 2.75, "y": 13.0, "w": 46.75, "h": 40.4, "c": _C95},
                     {"x": 2.75, "y": 55.6, "w": 46.75, "h": 40.4, "c": _C95},
                     {"x": 50.5, "y": 13.0, "w": 46.75, "h": 83.0, "c": _C95}]
N[94] = {"kind": "media", "bg": "white",
         "boxes": CARDS_UNDER_TITLE,
         "corner": "Novice trading platform",
         # the banner on the card's own ground, unfurling by itself
         "live": [{**SWITCH_ICON, "y": 23.1}, live("fractional-shares-banner", 6.4, 67.8, 39.5, 16.0, 760,
                                    css=".pshell,.pshell-stage{background:none!important}", clip=True, init="bannerLoop"),
                  live("fractional-order-flow", 63.94, 16.6, 22.55, 75.8, css=FOF_BG, fit=".fof-frame", vh=1000)]}
FRAC_LABELS = [{"text": "Market non-fractional", "x": 18.25, "y": 27.2},
               {"text": "Market fractional", "x": 50.35, "y": 27.2},
               {"text": "Limit non-fractional", "x": 82.05, "y": 27.2}]
N[95] = {"kind": "media", "bg": "white", "labels": FRAC_LABELS,
         # market fractional + limit run on the live flow; the flow has no whole-shares-only
         # market mode, so "Market non-fractional" stays the PDF's screen
         "shots": [crop(95, 'a', 2.0, 29.6, 32.1, 100, strip=("Market", "non-", "fractional", "Limit"))],
         "live": [live("fractional-order-flow", x, 30.13, 27.9, 69.87, css=FOF_BG, fit=".fof-frame", vh=1000, mode="width", init=init)
                  for x, init in ((35.63, None), (67.5, "limitOrder"))]}
_T97 = (20.68, 62.78, 31.56, 83.98)  # the "Order sent" tile
_P97 = (63.2, 14.0, 84.7, 88.9)      # the phone: the live boxed order-placement screen
# the boxed ticket's fractional-shares error, typed out on a loop (its own page, so the
# tile is the text alone), in the light-theme red on the card's ground, set like the
# order-placed caption below it. No fit: vw equals the rect's width in slide px (44% of
# 1920), so the page draws 1:1 and its px are slide px; the rect spans the card (centred on
# it, like the old chart's) so the one line fits, the page's own stage centring it.
TYPED_ERROR = live("typed-error", 4.1, 19.0, 44.0, 28.4, vw=845,
                   css=".te-stage{background:none!important}.te-block{color:#c02416!important}", clip=True)
# the order-placed mark and caption on the card's ground: no phone, no page, the ring
# track and captions re-inked for a light ground
OPA_LIGHT = ('.opa-stage{background:none!important}.opa-phone{filter:none!important}'
             '.opa-phone>img{visibility:hidden!important}.opa-ring-track{stroke:rgba(0,0,0,0.1)!important}'
             '.opa-caption--from{color:rgba(0,0,0,0.45)!important}.opa-caption--to{color:rgba(0,0,0,0.92)!important}')
# the same three cards as slide 95, drawn (not cropped) so they start UNDER the corner title
N[96] = {"kind": "media", "bg": "white", "corner": "Advanced trading platform",
         "boxes": CARDS_UNDER_TITLE,
         "live": [TYPED_ERROR, live("order-placed-animation", 20.68, 65.2, 10.88, 21.2, css=OPA_LIGHT,
                       fit=".opa-badge, .opa-caption", vh=1000, clip=True, pad=26, init="mute"),
                  # the boxed ticket's phone, whole: its Sell / Buy sit at the screen's foot, so the
                  # rect is the PDF phone's full height (the old ticket was cut a row under its buttons)
                  live("order-placement-boxed", 63.45, 16.6, 20.94, 75.8, css=PHONE_BG, fit=PHONE, vh=1000, mode="width", clip=True)]}
N[97] = D("Impact", bg="white", tone="green")
N[98] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
         "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[99] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
          "award": ["UX Design Awards", "Fall 2025 Nominee"],
          "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[100] = D("Reflections", bg="white", tone="green")
N[101] = D("")
N[102] = raster(102)

# ==== NEEDS REVIEW: mechanical baseline for pages whose content changed in =
# ==== export (6) — full-bleed PDF crops, no live embeds, no captions.    ====
# Each range below cites the OLD (export 4) page(s) it replaces and a one-
# line content hint, for the follow-up bespoke pass. Built with `python3
# scripts/gusto_deck.py` against the CURRENT PDF path.
_REVIEW = [
    (13, "black", "old 14-15: regular-vs-advanced platforms comparison + 'Questrade slower growth' statement"),
    (15, "black", "old 17: full-page raster, content unknown (no text on that PDF page)"),
    (16, "black", "old 17 (cont.)"),
    (19, "black", "old 20: quote — 'Don't change order entry, it's the only feature no one complains about'"),
    (21, "black", "old 22-25: user journey diagram (active step 1)"),
    (22, "black", "old 22-25 (cont.): user journey diagram (active step 3)"),
    (23, "black", "old 22-25 (cont.): 'order placement is slow' problem statement"),
    (24, "black", "old 22-25 (cont.): 'fast and frictionless, best in Canada' goal statement"),
    (28, "black", "old 29-32: option-chain widget walkthrough — 'how do we show the data?'"),
    (29, "black", "old 29-32 (cont.): widget with numbered reading-order path"),
    (30, "black", "old 29-32 (cont.): widget with red callout boxes + leader notes"),
    (31, "black", "old 29-32 (cont.): current vs updated widget ticket build-up"),
    (32, "black", "old 29-32 (cont.)"),
    (33, "black", "old 29-32 (cont.)"),
    (34, "black", "old 29-32 (cont.)"),
    (38, "black", "old 36: user journey diagram (duplicate, active step 3)"),
    (40, "black", "old 38-39: '80% of revenue' problem + option chain / order entry two-up crop"),
    (42, "black", "old 41-45: reduce-time-to-trade options widget crops + solution statement"),
    (43, "black", "old 41-45 (cont.)"),
    (44, "black", "old 41-45 (cont.): 'what are options?' + single-leg/multi-leg statement"),
    (45, "black", "old 41-45 (cont.): options ticket, old widget"),
    (46, "black", "old 41-45 (cont.): old widget forking into stock + options tickets"),
    (47, "black", "old 41-45 (cont.): live chain-to-order widgets"),
    (48, "black", "old 41-45 (cont.)"),
    (49, "black", "old 41-45 (cont.)"),
    (51, "black", "old 47-51: options ticket live embed + numbered pillars"),
    (52, "black", "old 47-51 (cont.): workspace comparison (client screenshot vs Atlas redesign)"),
    (54, "black", "old 53: 'Then vs Now' big title collage, live stock + options tickets"),
    (59, "white", "old 58-59: Fractional shares titlecard"),
    (60, "white", "old 58-59 (cont.): company-goal numbered list"),
    (62, "white", "old 61-63: 'what is that?' statement"),
    (63, "white", "old 61-63 (cont.): solution media crop"),
    (64, "white", "old 61-63 (cont.): role/contribution, live notive-quote with fractional banner"),
    (70, "white", "old 69: trader-type persona cards (regular vs advanced)"),
    (72, "white", "old 71: project-scope checklist (North star)"),
    (74, "white", "old 73-74: 'how might we' challenge statement + 'Design process' divider"),
    (76, "white", "old 76-86 [HIGH VALUE — live-embed range]: goals cards (duplicate of 75)"),
    (77, "white", "old 76-86 (cont.): symbol-discovery release build, screen 1 of 3 (live notive-quote)"),
    (78, "white", "old 76-86 (cont.): symbol-discovery release build, screens 1-2 of 3"),
    (79, "white", "old 76-86 (cont.): symbol-discovery release build, all 3 screens"),
    (80, "white", "old 76-86 (cont.): design-language comparison, dark quote screen alone (live alert-creation)"),
    (81, "white", "old 76-86 (cont.): design-language comparison, + fractional banner opened"),
    (82, "white", "old 76-86 (cont.): scope build-up (was an INSERT_AFTER deck-only slide, not a PDF page)"),
    (83, "white", "old 76-86 (cont.): original multi-page wizard order entry"),
    (84, "white", "old 76-86 (cont.): original wizard (cont.)"),
    (85, "white", "old 76-86 (cont.): wizard vs suggested design (live fractional-order-flow)"),
    (87, "white", "old 88: design-process numbered list (happy path / order type nav / symbol discoverability)"),
]
for _n, _bg, _hint in _REVIEW:  # _hint is documentation only, see the list above
    N[_n] = {"kind": "media", "bg": _bg, "corner": "NEEDS REVIEW",
             "shots": [crop(_n, 'full', 0, 0, 100, 100)]}
# ==== end NEEDS REVIEW baseline ============================================

# every content slide titles top-left (the deck renders kicker/heading/corner
# as one .gd-corner); these have no title copy yet, so they get a placeholder
# (cover, title cards, dividers and 53's big "Then vs Now" are left without)
for n in [*range(2, 11), 17, 36, 37, 55, 57, 95, 98, 99]:
    assert not any(k in N[n] for k in ("corner", "kicker", "heading")), n
    N[n]["corner"] = "Title"

for e in N.values():  # slides with a step-by-step build
    for sh in e.get("shots", []):
        if sh.get("annot"):
            if sh["annot"].get("points"):
                e["steps"] = len(sh["annot"]["points"]) - 1
assert sorted(N) == list(range(1, 103)), set(range(1, 103)) - set(N)
# Deck slides are the PDF's pages in order, plus INSERT_AFTER extras spliced
# in after their page; they are numbered sequentially from there, so every
# slide after an insertion carries a deck number one past its PDF page — and
# gustoDeckOverrides.json is keyed by DECK number (shift its keys when adding).
out = []
for p in range(1, 103):
    for e in [N[p], *INSERT_AFTER.get(p, [])]:
        out.append({"n": len(out) + 1, **e})
json.dump(out, open(OUT, "w"), indent=1, ensure_ascii=False)

# prune crops/rasters nothing references any more
for f in os.listdir(CROPS):
    if f.endswith('.webp') and f[:-5] not in made:
        os.remove(f'{CROPS}/{f}')
keep = {e["raster"] for e in out if "raster" in e}
for f in os.listdir(SLIDES):
    if f not in keep:
        os.remove(f'{SLIDES}/{f}')
lives = sum(len(e.get("live", [])) for e in out)
print(f"wrote {OUT} | crops {len(made)} | rasters {len(keep)} | live {lives}")
