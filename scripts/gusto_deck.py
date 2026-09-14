"""GUSTO deck v2 — built against `Case study presentation (GUSTO) (4).pdf`.

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

PDF = '/Users/ep/Downloads/Case study presentation (GUSTO) (4).pdf'
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


_prev = fitz.open('/Users/ep/Downloads/Case study presentation (GUSTO) (2).pdf')


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
# ---- intro ----------------------------------------------------------------
N[1] = {"kind": "cover", "bg": "black", "title": "Valentina Padure", "sub": "Portfolio presentation"}
N[2] = D("I’m a Product Designer", size="md", fs=94)
for i, n in enumerate(range(3, 11)):
    N[n] = {"kind": "ownership", "bg": "black", "reveal": i + 1}
N[11] = {"kind": "ownership", "bg": "black", "reveal": 8, "dim": True}

# ---- case study 1: order entry --------------------------------------------
N[12] = {"kind": "titlecard", "bg": "black", "kicker": "Case study", "title": "Order entry\nmodernization", "fs": 120}
N[13] = D("Background")
N[14] = {"kind": "media", "bg": "black", "cornerInk": "dark", "panels": [P(0, 50, LIGHT_PANEL)],
         "labels": [{"text": "Regular trading platforms", "x": 26.5, "y": 22.3, "tone": "dark"},
                    {"text": "Advanced trading platforms", "x": 77.05, "y": 22.3}],
         "shots": [crop(14, 'a', 3, 24.3, 47, 73.8), crop(14, 'b', 51.4, 24.3, 98, 74.2)]}
N[15] = S("Questrade was experiencing slower\ngrowth among the active traders.")
N[16] = S("Launch a new, modernized trading platform", "Solution")
N[17] = raster(17)
N[18] = {"kind": "role", "bg": "black",
         "rows": [["My role", "Lead Designer for the order entry widget"], ["Design Timeline", "6 months"],
                  ["Team", "2 Engineering teams\n1 UX Researcher"]],
         "live": [live("stock-order-entry", 55, 22, 36, 60, css=TICKET_BG, fit=CARD)]}
N[19] = D("The journey")
N[20] = {"kind": "quote", "bg": "black", "kicker": "Existing client sentiment",
         "text": "“Don’t change order entry. It’s the only\nfeature no one complains about.”"}
N[21] = S("Led foundational research with active traders\nto evaluate the full trading journey.", "Pivoting the research")
N[22] = {"kind": "journey", "bg": "black", "kicker": "User journey", "steps": JOURNEY, "active": -1}
N[23] = {"kind": "journey", "bg": "black", "kicker": "User journey", "steps": JOURNEY, "active": 2}
N[24] = S("The current order placement is slow, in\nparticular for option traders.", "The problem")
N[25] = S("Make trade submission fast and frictionless\nand best in Canada.", "The goal")
# the PDF's clock icon is replaced by a live clock (InlineClock) between the two metrics
N[26] = {"kind": "metrics", "bg": "black", "kicker": "Success metrics",
         "items": [{"text": "Reduce time to\ntrade by 15%"}, {"text": "Reduce number of\nclicks by 30%"}]}
N[27] = D("How?")
N[28] = S("What data do we show and how?", "Reducing time to trade")
# 29 -> 30 is a build (30 adds the numbered markers): both crop the same
# widget bitmap with the same padding and sit in the same place, so nothing
# moves between them. Args are the widget image's rect on that slide.
def widget(n, x0, y0, x1, y1, padx=0.8, pady=0.6):
    return place(crop(n, 'a', x0 - padx, y0 - pady, x1 + padx, y1 + pady), 21, 58, y=25.5)


# The numbered path over the widget on slide 30, traced from the PDF
# (page 30 vectors) into the coordinates of 29's crop: crop origin =
# widget origin − padding, units = PDF points. Order = reading order.
_W30 = (36.075 * 19.2, 38.333 * 10.8)          # widget origin on page 30, pt
_PAD = (0.8 * 19.2, 0.6 * 10.8)
_q = lambda x, y: [round(x - _W30[0] + _PAD[0], 2), round(y - _W30[1] + _PAD[1], 2)]
WIDGET_PATH = {
    "w": round((65.07 - 34.93 + 1.6) * 19.2, 2),
    "h": round((61.204 - 34.815 + 1.2) * 10.8, 2),
    "line": "#E03E1A",  # markers share the line's red (the PDF's five colours read poorly)
    "points": [
        {"at": _q(690, 426), "c": "#E03E1A", "n": "1"},
        {"at": _q(690, 676), "c": "#E03E1A", "n": "2"},
        {"at": _q(774, 489), "c": "#E03E1A", "n": "3"},
        {"at": _q(988, 607), "c": "#E03E1A", "n": "4"},
        {"at": _q(1135, 547), "c": "#E03E1A", "n": "5"},
    ],
}


N[29] = {"kind": "media", "bg": "black", "heading": "How do we show the data?",
         "labels": [{"text": "Current widget layout", "x": 50, "y": 21.5}],
         "shots": [widget(29, 34.93, 34.815, 65.07, 61.204)]}
N[30] = {"kind": "media", "bg": "black", "heading": "How do we show the data?",
         "labels": [{"text": "Current widget layout", "x": 50, "y": 21.5}],
         # 29's image, with the reading-order path drawn by the deck and
         # revealed one line per click (see the "annot" block in GustoDeck)
         "shots": [dict(widget(29, 34.93, 34.815, 65.07, 61.204), annot=WIDGET_PATH)]}
# 31 (Figma update, 2026-09-12): same widget and placement as 29/30, with
# three red callout boxes, a leader to "Only 12 clients…" on the left and a
# bracket under the exit fields to "These values cannot be changed…".
# Measured off the Figma frame (widget at 671,414, 577px wide) and mapped
# into 29's crop coordinates like WIDGET_PATH.
_F = 578.7 / 577
_fq = lambda x, y: [round((x - 671) * _F + _PAD[0], 2), round((y - 414) * _F + _PAD[1], 2)]


def _frect(x0, y0, x1, y1):
    a, b = _fq(x0, y0), _fq(x1, y1)
    return [a[0], a[1], round(b[0] - a[0], 2), round(b[1] - a[1], 2)]


WIDGET_CALLOUTS = {
    "w": WIDGET_PATH["w"], "h": WIDGET_PATH["h"], "line": "#D02A2A",
    "boxes": [_frect(679, 501, 873, 549), _frect(825, 571, 927, 654), _frect(1028, 571, 1232, 654)],
    "lines": [
        [*_fq(660, 524.5), *_fq(679, 524.5)],                                   # leader to note 1
        [*_fq(874, 655), *_fq(874, 710.5), *_fq(1154.5, 710.5), *_fq(1154.5, 655)],  # bracket
        [*_fq(1011.5, 710.5), *_fq(1011.5, 723)],                               # bracket tick
    ],
    "notes": [
        {"at": _fq(655, 525), "anchor": "right", "text": "Only 12 clients can actually use these fields"},
        {"at": _fq(1010, 727), "anchor": "top", "text": "These values cannot be changed\nand interacted with"},
    ],
}
N[31] = {"kind": "media", "bg": "black", "heading": "What data do we show?",
         "labels": [{"text": "Current widget layout", "x": 50, "y": 21.5}],
         "shots": [dict(widget(29, 34.93, 34.815, 65.07, 61.204), annot=WIDGET_CALLOUTS)]}
_SX, _SW32 = 61.5, 27  # slide 32: the stacked tickets' left edge and width (%); the first card's
# top lines up with the current-widget screenshot opposite (276px)
N[32] = {"kind": "media", "bg": "black", "heading": "What data do we show?",
         "panels": [P(0, 50, "#0e0e0e", 16)],
         "labels": [{"text": "Current widget design", "x": 25, "y": 22.6},
                    {"text": "Updated widget design", "x": 75, "y": 22.6}],
         "shots": [place(crop(32, 'a', 8.9, 25.1, 39.2, 51.7), 4, 42, cy=57)],
         # the updated ticket builds down the right half, one click per stage:
         # the quote row, then the quote + its fields, then the whole ticket
         "steps": 2,
         "live": [dict(live("stock-order-entry", _SX, y, _SW32, h, css=TICKET_BG + NO_HEADER, fit=CARD, mode="width",
                            init=init), s=k, rise=True, stack=True)
                  for k, (init, y, h) in enumerate((("ticketQuote", 25.24, 8), ("ticketQty", 34.06, 25),
                                                    ("ticketFull", 58.23, 34)))]}
N[33] = S("How do we make the option trade\nexperience faster?", "Reducing time to trade")
N[34] = S("What are options?")
N[35] = {"kind": "twocol", "bg": "black", "panels": [P(0, 50, DARK_PANEL)],
         "left": "Single-leg / Option = 🍔", "right": "Multi-leg / Strategy = 🍔🥤🍟"}
N[36] = {"kind": "journey", "bg": "black", "kicker": "User journey", "steps": JOURNEY, "active": 2}
N[37] = S("The journey between finding an option and\nplacing an option trade was broken", "Reducing time to trade")
N[38] = S("80% of Questrade’s revenue = the most complex\nindustry experience", "The problem")
N[39] = {"kind": "media", "bg": "black",
         "labels": [{"text": "Option chain (your catalog)", "x": 25.6, "y": 8.6},
                    {"text": "Order entry (checkout)", "x": 74.4, "y": 8.6}],
         "shots": [crop(39, 'a', 1.4, 11.8, 55.4, 82.0, strip=("T",)), crop(39, 'b', 55.9, 11.8, 96.4, 53.9, strip=("T",))]}
N[40] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade",
         "shots": [crop(40, 'a', 10.4, 13.2, 89.6, 95.0)]}
N[41] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade",
         "shots": [place(crop(41, 'a', 35.6, 31.0, 64.4, 49.9), 17, 66, cy=55)]}
N[42] = S("Tailor the order placement experience\nto each security type", "The solution")
N[43] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         "panels": [P(0, 50, DARK_PANEL)],
         "shots": [cardimg(43, 'a', 2644, 3, 44, cy=55, radius=0)]}
# 44: the old widget stays exactly as on 43; one click fades in the split —
# a connector from it forking to two tickets stacked on the right, Stocks
# above Options, same width, each captioned on its left. (Old widget on 43
# measures x 115-847, y 388-656 in canvas px; ticket heights at 600px wide
# measure ~431 and ~459.)
_TW, _TX, _GAP = 600, 1110, 40              # pulled in toward the old widget
_H = (369, 458)  # with the estimate and adders hidden
_T1 = round((1080 - (_H[0] + _GAP + _H[1])) / 2)
_T2 = _T1 + _H[0] + _GAP
_M = (_T1 + _H[0] // 2, _T2 + _H[1] // 2)       # ticket middles
_SPINE, _CAPX = 895, 1030
N[44] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         "panels": [P(0, 50, DARK_PANEL)],
         "shots": [cardimg(44, 'a', 2644, 3, 44, cy=55, radius=0)],
         "steps": 1,
         "labels": [{"text": t, "x": round(_CAPX / 19.2, 3), "y": round((m - 13) / 10.8, 3), "size": "lg", "s": 1}
                    for t, m in (("Stocks", _M[0]), ("Options", _M[1]))],
         "connectors": [{"s": 1, "points": [[863, 522], [_SPINE, 522]]},
                        {"s": 1, "points": [[_CAPX - 52, _M[0]], [_SPINE, _M[0]], [_SPINE, _M[1]], [_CAPX - 52, _M[1]]]}],
         "live": [dict(live("stock-order-entry", _TX / 19.2, _T1 / 10.8, _TW / 19.2, 45, css=TICKET_BG + LEAN, fit=CARD, mode="width", init="freeze"), s=1),
                  dict(live("options-strategy-builder", _TX / 19.2, _T2 / 10.8, _TW / 19.2, 45, css=TICKET_BG + LEAN, fit=CARD, mode="width", init="freeze"), s=1)]}
N[45] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         # just the two widgets: the workspace's ground, frame and rail are
         # taken away, and nothing clips — so the order confirmation, which
         # opens over them, shows in full
         "live": [live("chain-to-order", 8, 15, 84, 80, 1440, css=WIDGETS_ONLY, fit=".ctt .wshell", vh=900, pad=18, init="chainFirst")]}
# product vision: V1 is the live options ticket, V2 the strategy builder export, both at
# 1.2x their CSS size (ticket 357 wide, builder 763), top-aligned and centred as a pair
N[46] = {"kind": "media", "bg": "black", "corner": "Product vision",
         "labels": [{"text": "V1", "x": 23.02, "y": 23}, {"text": "V2", "x": 64.27, "y": 23}],
         "shots": [asset("046-atlas-strategy-builder", "atlas-strategy-builder.png", 40.42, 47.71, 27.78, trim=True)],
         "live": [live("options-strategy-builder", 11.875, 27.78, 22.29, 40, css=TICKET_BG, fit=CARD, mode="width")]}
N[47] = {"kind": "media", "bg": "black",
         "live": [live("options-strategy-builder", 5, 16, 44, 70, css=TICKET_BG, fit=CARD)]}
N[48] = {"kind": "numbered", "bg": "black", "items": PILLARS, "active": [0, 1]}
N[49] = {"kind": "numbered", "bg": "black", "items": PILLARS, "active": [0, 1]}
N[50] = {"kind": "media", "bg": "black", "heading": "Maximizing widget and workspace efficiency",
         "panels": [P(0, 50.1, DARK_PANEL, 16)],
         "labels": [{"text": "Screenshot of a client’s workspace", "x": 25, "y": 22.6},
                    {"text": "Redesigned workspace layout", "x": 75, "y": 22.6}],
         # the redesigned workspace is the Atlas workspace export, top-aligned with the client's
         "shots": [crop(50, 'a', 2.2, 27.1, 48.0, 74.0),
                   asset("050-atlas-workspace", "atlas-workspace.png", 52.2, 45.6, 27.1, quality=92)]}
N[51] = {"kind": "media", "bg": "black", "heading": "Maximizing widget and workspace efficiency",
         "panels": [P(0, 50, DARK_PANEL, 16)],
         "labels": [{"text": "Initial design", "x": 25, "y": 21.2}, {"text": "Updated design", "x": 75, "y": 21.2}],
         # the Atlas component library exports, one per side, same scale, centred in
         # their halves, under their labels: the initial ticket (quote row + bid/ask), then the lean updated one
         "shots": [asset("051-atlas-initial", "atlas-ticket-360.png", 25 - 14, 28, 26),
                   asset("051-atlas-updated", "atlas-ticket.png", 75 - 14, 28, 26)]}
N[52] = D("Final designs")
N[53] = {"kind": "media", "bg": "black", "bigTitle": "Then vs ", "bigAccent": "Now",
         "panels": [P(0, 50.1, DARK_PANEL, 23)],
         "shots": [cardimg(53, 'a', 3019, 4, 42, cy=58, radius=0)],
         # footers kept; the stock ticket's adders row and the options
         # ticket's estimated cost are hidden
         "live": [live("stock-order-entry", 55, 22, 40, 33, css=TICKET_BG + ".st-attach-stack{display:none!important}", fit=CARD),
                  live("options-strategy-builder", 55, 57, 40, 39, css=TICKET_BG + ".ob-cost{display:none!important}.ob-foot{justify-content:flex-end!important}", fit=CARD)]}
N[54] = dict(raster(54), live=[live("chain-to-order", 12.2, 8.3, 75.3, 83.6, 1440,
                                     fit=".wsp-screen", vh=900, clip=True)])
N[55] = D("Impact")
N[56] = {"kind": "figures", "bg": "black", "tone": "mint", "panels": [P(0, 50, DARK_PANEL)], "split": True,
         "items": [["60%", "faster to place trades"], ["85%", "Satisfaction score during the closed beta"]]}
N[57] = D("Reflections")

# ---- case study 2: fractional shares (export 4, slides 58-103) --------------
# Live prototypes in this half: alert creation (80, 81 with the fractional
# banner opened), the fractional order flow (85, 95), order placement (87), the
# fractional-shares banner (95) and the order-placed animation (97).
CANVAS = "#f6f4f5"
WHITE_BG = "html,body,html[data-embed],html[data-embed] body{background:#fff!important}"

N[58] = {"kind": "titlecard", "bg": "white", "kicker": "Case study", "title": "Fractional\nshares", "fs": 84,
         "shot": crop(58, 'a', 46.7, 4.9, 98.3, 95.2)}
N[59] = {"kind": "numbered", "bg": "white", "corner": "Company goal", "size": "lg",
         "items": ["Win more active traders", "Streamline the trading experience"], "active": "all"}
N[60] = S("Introduce fractional trading", bg="white", corner="Solution")
N[61] = S("What is that?", bg="white", corner="Solution")
N[62] = {"kind": "media", "bg": "white", "corner": "Solution",
         "shots": [crop(62, 'a', 15.5, 19.5, 80, 81)]}
N[63] = {"kind": "role", "bg": "white", "corner": "My contribution",
         "rows": [["My role", "Product Designer"], ["Design Timeline", "4 months"],
                  ["Team", "4 Engineering teams\n1 UX Researcher\n3 Product Managers"]],
         # the live quote screen with its fractional strip up, where the PDF had a card
         "live": [live("notive-quote", 58.4, 9.0, 29.3, 76.5, css=NQ_BG, fit=PHONE, vh=1000, init="openFractional")]}
N[64] = {"kind": "media", "bg": "white", "corner": "Research",
         "shots": [crop(64, 'a', 31.6, 19.4, 68.8, 100)]}
N[65] = S("Traders need affordable and flexible\nways to trade.", bg="white", corner="Problem", fw=600)
N[65]["fs"] = 80
N[66] = S("1 Feature.", bg="white", corner="Design challenge", fw=600)
N[67] = S("1 Feature. 2 Personas.", bg="white", corner="Design challenge", fw=600)
N[68] = S("1 Feature. 2 Personas. 2 Design languages", bg="white", corner="Design challenge", fw=600)
N[69] = {"kind": "cards", "bg": "white", "corner": "Trader types",
         "panels": [P(0, 50, LIGHT_PANEL)],
         "cards": [
             {"x": 14.32, "y": 37.2, "w": 25, "tone": "white", "title": "Regular trader", "points": [
                 "Fractional shares is a primary feature", "Wants to trade in $ amounts",
                 "Wants to distribute 100% of all their assets",
                 "Has limited understanding of industry rules and limitations"]},
             {"x": 62.19, "y": 36.1, "w": 25, "tone": "canvas", "title": "Advanced trader", "points": [
                 "Fractional shares as a “nice to have” feature", "Wants to short fractional amounts",
                 "Wants to mitigate risk", "Has some understanding of industry rules and limitations"]}]}
N[70] = {"kind": "media", "bg": "white", "corner": "2 Platforms = 2 Design languages",
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
N[71] = {"kind": "checklist", "bg": "white", "corner": "Project scope", "panels": [P(0, 50, LIGHT_PANEL)], "cols": [NORTH]}
N[72] = {"kind": "checklist", "bg": "white", "corner": "Project scope", "panels": [P(0, 50, LIGHT_PANEL)], "cols": [NORTH, MVP]}
N[73] = S("How might we make investing\naccessible to new investors without\nslowing down advanced traders?",
          bg="white", corner="The challenge", fw=600)
N[74] = D("Design process", bg="white", tone="green", fs=125)

_goal_icons = [cardimg(75, 'i1', 4260, 20.2, 11.8, y=34.2, radius=0, key=False),
               cardimg(75, 'i2', 4262, 65.7, 9.2, y=32.6, radius=0, key=False)]
GOAL_CARDS = [{"x": 5.8, "y": 25.95, "w": 40.57, "h": 45.05, "icon": _goal_icons[0],
               "text": "Help traders discover\nfractional symbols"},
              {"x": 50.02, "y": 25.95, "w": 40.57, "h": 45.05, "icon": _goal_icons[1],
               "text": "Allow traders to place\na fractional trade"}]
# the check in the second card is the order-placed animation itself, sitting
# exactly where the goals layout puts the icon (measured: 65.7, 34.59, 9.2 x 15.35)
GOAL_LIVE = [live("order-placed-animation", 65.7, 34.59, 9.2, 15.35, css=OPA_BG,
                  fit=".opa-badge", vh=1000, clip=True, pad=14, init="mute")]
GOAL_CARDS_LIVE = [dict(GOAL_CARDS[0], icon=dict(_goal_icons[0], hide=True)),
                   dict(GOAL_CARDS[1], icon=dict(_goal_icons[1], hide=True))]
# ...and the symbol finder is the holdings magnifier, the same size as the check tile
GOAL_LIVE = GOAL_LIVE + [live("holdings-empty-state", 26.1 - 4.6, 34.59, 9.2, 15.35, css=HE_BG, fit=".he-card", vh=1000)]
N[75] = {"kind": "goals", "bg": "white", "corner": "Goal", "cards": GOAL_CARDS_LIVE, "live": GOAL_LIVE}
N[76] = {"kind": "goals", "bg": "white", "corner": "Goal", "cards": GOAL_CARDS_LIVE, "live": GOAL_LIVE}

# the symbol-discovery build: one, two, then three release cards
RELEASES = [(4.14, "Original design"), (35.75, "Beta release"), (67.37, "Public release")]


def releases(n, k):
    STRIP = ("Old", "design")
    return {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
            "labels": [{"text": t, "x": round(x + 14.22, 2), "y": 80.1, "size": "lg"} for x, t in RELEASES[:k]],
            "shots": [crop(n, "abc"[i], x, 23.8, x + 28.44, 78.8, strip=STRIP) for i, (x, _) in enumerate(RELEASES[:k])]}


# slides 77-79: the releases, built up one screen per slide — Original;
# Original + Beta; all three — as live quote screens at fixed columns, so
# each advance adds a phone without moving the others. Captions on top,
# under the corner title; phones from 33% down, running off the slide's
# foot (the top two thirds of the screen: header, quote, chart, rail).
# Original: chip and banner hidden by css, named Robinhood by the deck's
# `notiveOriginal` init. Beta: banner + empty chip slot hidden, a
# "Fractional" tag beside the top icons by `notiveBeta`. Public: the page
# as it is, banner open. Every column also freezes the price walk.
NQ_ORIGINAL = NQ_BG + ".nq-banner,.nq-frac-slot{display:none!important}"
NQ_BETA = NQ_BG + ".nq-banner,.nq-frac-slot{display:none!important}"
RELEASE_SCREENS = [(NQ_ORIGINAL, "notiveOriginal,freeze"), (NQ_BETA, "notiveBeta,freeze"), (NQ_BG, "freeze")]


def releases_live(k):
    return {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
            # caption box (21px type, ~25px tall) ends 5px above the phone's top edge at 33%
            "labels": [{"text": t, "x": round(x + 14.22, 2), "y": 30.2, "size": "lg"} for x, t in RELEASES[:k]],
            "live": [live("notive-quote", x, 33.0, 28.44, 67.0, css=css, fit=PHONE, vh=1000, mode="width", clip=True,
                          init=init)
                     for (x, _), (css, init) in zip(RELEASES[:k], RELEASE_SCREENS[:k])]}


N[77] = releases_live(1)
N[78] = releases_live(2)
N[79] = releases_live(3)
# the live quote screen, as the slide draws it: large, bleeding off the bottom
# both quote screens side by side, same size as when they were a slide each: the
# plain one, then with its fractional banner open (81 is hidden in the overrides)
# slides 80-81: the dark quote screen built up the way 77-79 are — the
# original alone, then original + updated (its fractional banner open) at
# the same fixed columns; captions on top, their ~25px box ending 5px
# above the phones' top edge (35.28% = 381px on the 1080 canvas)
DARK_COLS = ((14.7, "Original design", None), (52.0, "Updated design", "openFractional"))


def dark_releases(k):
    return {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
            "labels": [{"text": t, "x": round(x + 16.65, 2), "y": 32.5, "size": "lg"} for x, t, _ in DARK_COLS[:k]],
            "live": [live("alert-creation", x, 35.28, 33.3, 64.72, css=ACS_BG, fit=PHONE, vh=1000, mode="width",
                          init=init) for x, _, init in DARK_COLS[:k]]}


N[80] = dark_releases(1)
N[81] = dark_releases(2)
# the scope builds up: page 82 shows the first goal alone, and an extra deck
# slide (no PDF page of its own — see INSERT_AFTER) follows with both
_SCOPE = [dict(GOAL_CARDS[0], x=8.9, y=38, w=40, h=20, icon=None), dict(GOAL_CARDS[1], x=51.1, y=38, w=40, h=20, icon=None)]
N[82] = {"kind": "goals", "bg": "white", "plain": True, "cards": _SCOPE[:1]}
INSERT_AFTER = {82: [{"kind": "goals", "bg": "white", "plain": True, "corner": "Title", "cards": _SCOPE}]}

WIZ = ("Original", "multi", "page", "wizard", "order", "entry")
N[83] = {"kind": "media", "bg": "canvas", "corner": "Original design",
         "labels": [{"text": "Original multi page wizard order entry", "x": 47.45, "y": 19.6, "size": "lg"}],
         "shots": [crop(83, 'a', 0, 22.0, 100, 92.0, strip=WIZ)]}
N[84] = {"kind": "media", "bg": "canvas", "corner": "Original design",
         "labels": [{"text": "Original multi page wizard order entry", "x": 47.45, "y": 17.1, "size": "lg"}],
         "shots": [crop(84, 'a', 0, 19.6, 100, 92.0, strip=WIZ)]}
N[85] = {"kind": "media", "bg": "white", "corner": "Original design",
         "panels": [P(0, 64.27, CANVAS)],
         "labels": [{"text": "Original multi page wizard order entry", "x": 26.85, "y": 15.3, "size": "lg"},
                    {"text": "Suggested design", "x": 82.5, "y": 15.3, "size": "lg"}],
         "shots": [crop(85, 'a', 0, 17.7, 64.27, 94.0, strip=WIZ)],
         "live": [live("fractional-order-flow", 72.08, 18.4, 21.11, 73.11, css=FOF_BG, fit=".fof-frame", vh=1000)]}
N[86] = {"kind": "media", "bg": "white", "corner": "How does an advanced trader place an order?",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Old design", "x": 28.45, "y": 15.5}],
         # the old ticket is the live order-placement screen, at the PDF phone's bezel rect
         "live": [live("order-placement", 17.77, 20.09, 18.4, 69.62, css=PHONE_BG, fit=PHONE, vh=1000, mode="width")]}
N[87] = {"kind": "media", "bg": "white", "corner": "Happy path",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Old design", "x": 26.99, "y": 13.2}, {"text": "Updated design", "x": 73.57, "y": 13.2}],
         # both columns are the boxed ticket; "Old design" is the same screen
         # before the shares / dollar switcher (same label, no chevron)
         # rects are the phone's own aspect (1218x2475) at 850 canvas px tall,
         # tops 6px under the labels; the old design also loses the fractional button
         "live": [live("order-placement-boxed", 16.09, 15.84, 21.79, 78.7, css=PHONE_BG + ".opb-frac-btn{visibility:hidden!important}", fit=PHONE, vh=1000, init="quantityOnly"),
                  live("order-placement-boxed", 62.67, 15.84, 21.79, 78.7, css=PHONE_BG, fit=PHONE, vh=1000)]}
N[88] = {"kind": "numbered", "bg": "white", "corner": "Design process",
         "items": ["Happy path design", "Order type navigation", "Symbol discoverability"], "active": [1]}
N[89] = {"kind": "media", "bg": "white", "corner": "Navigating edge cases",
         # placeholder caption, its box ending on the phone's top edge like slide 90's
         "labels": [{"text": "Label", "x": 50.64, "y": 29.56, "size": "lg"}],
         # the edge cases run on the live fractional order flow, opened on a Limit order
         "live": [live("fractional-order-flow", 35.61, 32.43, 30.07, 67.57, css=FOF_BG, fit=".fof-frame", vh=1000, mode="width", init="limitOrder")]}
# the Limit-quantity edge case built up across the three RELEASES columns, the
# way 77-79 are: V1, then V1 + V2 (the two error wordings, static exports of the
# fractional order flow's ?fractionError state with 0.5 typed in, the quote
# frozen at $300.00), then the final design live (?static: quote frozen), which
# types 1.5 on arrival so the blue hint and the ring round the order pill play
# together. Page 90 is V1 alone, an inserted slide (no PDF page of its own)
# adds V2, page 91 adds the final. Phones top-aligned at 38.2%, bleeding off the
# bottom; captions above them, centred on their columns.
EDGE_COLS = ((4.14, "V1"), (35.75, "V2"), (67.37, "Final design"))
EDGE_W = 28.44
EDGE_SHOTS = [asset(f"090-limit-error-{v}", f"fractional-limit-error-{v}.png", x, EDGE_W, 38.2, quality=92)
              for (x, _), v in zip(EDGE_COLS, ("v1", "v2"))]


def edge_cases(k):
    e = {"kind": "media", "bg": "white", "corner": "Navigating edge cases",
         "labels": [{"text": t, "x": round(x + EDGE_W / 2, 2), "y": 35.28} for x, t in EDGE_COLS[:k]],
         "shots": EDGE_SHOTS[:k]}
    if k == 3:
        e["live"] = [dict(live("fractional-order-flow?fractionError=hint&static", EDGE_COLS[2][0], 38.2, EDGE_W, 61.8, css=FOF_BG,
                               fit=".fof-frame", vh=1000, mode="width", init="fracHintSetup"), arrive="fracHintType")]
    return e


N[90] = edge_cases(1)
INSERT_AFTER[90] = [edge_cases(2)]
N[91] = edge_cases(3)
N[92] = {"kind": "media", "bg": "white", "corner": "Navigating edge cases",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "shots": [crop(92, 'a', 14.0, 16.8, 36.3, 90.4), crop(92, 'b', 59.5, 22.5, 91.0, 75.0)]}
N[93] = D("Final designs", bg="white", tone="green")
N[94] = D("", bg="white")

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
# the PDF's three light cards drawn under the corner title (the crops' cards began at 4%,
# behind it), the tiles re-centred on them; the phone at slide 97's phone height, contained
_C95 = "#f7f7f7"
CARDS_UNDER_TITLE = [{"x": 2.75, "y": 13.0, "w": 46.75, "h": 40.4, "c": _C95},
                     {"x": 2.75, "y": 55.6, "w": 46.75, "h": 40.4, "c": _C95},
                     {"x": 50.5, "y": 13.0, "w": 46.75, "h": 83.0, "c": _C95}]
N[95] = {"kind": "media", "bg": "white",
         "boxes": CARDS_UNDER_TITLE,
         "corner": "Novice trading platform",
         # the banner on the card's own ground, unfurling by itself
         "live": [{**SWITCH_ICON, "y": 23.1}, live("fractional-shares-banner", 6.4, 67.8, 39.5, 16.0, 760,
                                    css=".pshell,.pshell-stage{background:none!important}", clip=True, init="bannerLoop"),
                  live("fractional-order-flow", 63.94, 16.6, 22.55, 75.8, css=FOF_BG, fit=".fof-frame", vh=1000)]}
FRAC_LABELS = [{"text": "Market non-fractional", "x": 18.25, "y": 27.2},
               {"text": "Market fractional", "x": 50.35, "y": 27.2},
               {"text": "Limit non-fractional", "x": 82.05, "y": 27.2}]
N[96] = {"kind": "media", "bg": "white", "labels": FRAC_LABELS,
         # market fractional + limit run on the live flow; the flow has no whole-shares-only
         # market mode, so "Market non-fractional" stays the PDF's screen
         "shots": [crop(96, 'a', 2.0, 29.6, 32.1, 100, strip=("Market", "non-", "fractional", "Limit"))],
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
N[97] = {"kind": "media", "bg": "white", "corner": "Advanced trading platform",
         "boxes": CARDS_UNDER_TITLE,
         "live": [TYPED_ERROR, live("order-placed-animation", 20.68, 65.2, 10.88, 21.2, css=OPA_LIGHT,
                       fit=".opa-badge, .opa-caption", vh=1000, clip=True, pad=26, init="mute"),
                  # the boxed ticket's phone, whole: its Sell / Buy sit at the screen's foot, so the
                  # rect is the PDF phone's full height (the old ticket was cut a row under its buttons)
                  live("order-placement-boxed", 63.45, 16.6, 20.94, 75.8, css=PHONE_BG, fit=PHONE, vh=1000, mode="width", clip=True)]}
N[98] = D("Impact", bg="white", tone="green")
N[99] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
         "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[100] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
          "award": ["UX Design Awards", "Fall 2025 Nominee"],
          "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[101] = D("Reflections", bg="white", tone="green")
N[102] = D("")
N[103] = raster(103)

# every content slide titles top-left (the deck renders kicker/heading/corner
# as one .gd-corner); these have no title copy yet, so they get a placeholder
# (cover, title cards, dividers and 53's big "Then vs Now" are left without)
for n in [*range(3, 12), 14, 15, 17, 18, 34, 35, 39, 47, 54, 56, 82, 96, 99, 100]:
    assert not any(k in N[n] for k in ("corner", "kicker", "heading")), n
    N[n]["corner"] = "Title"

for e in N.values():  # slides with a step-by-step build
    for sh in e.get("shots", []):
        if sh.get("annot"):
            if sh["annot"].get("points"):
                e["steps"] = len(sh["annot"]["points"]) - 1
assert sorted(N) == list(range(1, 104)), set(range(1, 104)) - set(N)
# Deck slides are the PDF's pages in order, plus INSERT_AFTER extras spliced
# in after their page; they are numbered sequentially from there, so every
# slide after an insertion carries a deck number one past its PDF page — and
# gustoDeckOverrides.json is keyed by DECK number (shift its keys when adding).
out = []
for p in range(1, 104):
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
