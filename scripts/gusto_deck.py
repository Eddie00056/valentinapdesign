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
NO_HEADER = ".wshell-bar{display:none!important}"  # the widget without its title bar
FOF_BG = ".fof-stage{background:none!important}"
ACS_BG = ".acs-root{background:none!important}"
PHONE_BG = ".phone-stage{background:none!important}"
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
N[14] = {"kind": "media", "bg": "black", "panels": [P(0, 50, LIGHT_PANEL)],
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
N[32] = {"kind": "media", "bg": "black", "heading": "What data do we show?",
         "panels": [P(0, 50, "#0e0e0e", 16)],
         "labels": [{"text": "Current widget design", "x": 25, "y": 22.6},
                    {"text": "Updated widget design", "x": 75, "y": 22.6}],
         "shots": [place(crop(32, 'a', 8.9, 25.1, 39.2, 51.7), 4, 42, cy=57)],
         "live": [live("stock-order-entry", 55, 30, 40, 54, css=TICKET_BG + NO_HEADER, fit=CARD, init="symbolFirst")]}
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
N[44] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         "panels": [P(0, 33, DARK_PANEL)],
         "shots": [cardimg(44, 'a', 2644, 1.5, 30, cy=55, radius=0)],
         "live": [live("stock-order-entry", 35, 25, 29.5, 60, css=TICKET_BG, fit=CARD),
                  live("options-strategy-builder", 66.5, 20, 30.5, 70, css=TICKET_BG, fit=CARD)]}
N[45] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         "live": [live("chain-to-order", 8, 15, 84, 80, 1440, fit=".ctt .wshell", vh=900, clip=True, pad=18)]}
N[46] = {"kind": "media", "bg": "black",
         "live": [live("options-strategy-builder", 26, 12, 48, 76, css=TICKET_BG, fit=CARD)]}
N[47] = {"kind": "media", "bg": "black",
         "live": [live("options-strategy-builder", 5, 16, 44, 70, css=TICKET_BG, fit=CARD)]}
N[48] = {"kind": "numbered", "bg": "black", "items": PILLARS, "active": [0, 1]}
N[49] = {"kind": "numbered", "bg": "black", "items": PILLARS, "active": [0, 1]}
N[50] = {"kind": "media", "bg": "black", "heading": "Maximizing widget and workspace efficiency",
         "panels": [P(0, 50.1, DARK_PANEL, 16)],
         "labels": [{"text": "Screenshot of a client’s workspace", "x": 25, "y": 22.6},
                    {"text": "Redesigned workspace layout", "x": 75, "y": 22.6}],
         "shots": [crop(50, 'a', 2.2, 27.1, 48.0, 74.0)],
         # the redesigned workspace, live: /work/chain-to-order, rail and all
         "live": [live("chain-to-order", 52.2, 26, 45.6, 50, 1440, fit=".wsp-screen", vh=900, clip=True)]}
N[51] = {"kind": "media", "bg": "black", "heading": "Maximizing widget and workspace efficiency",
         "panels": [P(0, 63, DARK_PANEL, 16)],
         "labels": [{"text": "Initial design", "x": 31.5, "y": 21.2}, {"text": "Updated design", "x": 81.5, "y": 21.2}],
         "shots": [cardimg(51, 'a', 2949, 3, 28.5, y=26),
                   cardimg(51, 'b', 2947, 33.5, 26.5, y=26),
                   cardimg(51, 'c', 2945, 67, 29, y=26)]}
N[52] = D("Final designs")
N[53] = {"kind": "media", "bg": "black", "bigTitle": "Then vs ", "bigAccent": "Now",
         "panels": [P(0, 50.1, DARK_PANEL, 23)],
         "shots": [cardimg(53, 'a', 3019, 4, 42, cy=58, radius=0)],
         "live": [live("stock-order-entry", 55, 22, 40, 33, css=TICKET_BG, fit=CARD),
                  live("options-strategy-builder", 55, 57, 40, 39, css=TICKET_BG, fit=CARD)]}
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
         "shot": crop(63, 'a', 58.4, 9.0, 87.7, 85.5)}
N[64] = {"kind": "media", "bg": "white", "corner": "Research",
         "shots": [crop(64, 'a', 31.6, 19.4, 68.8, 100)]}
N[65] = S("Traders need affordable and flexible\nways to trade.", bg="white", corner="Problem", fw=600)
N[65]["fs"] = 80
N[66] = S("1 Feature.", bg="white", corner="Design challenge", fw=600)
N[67] = S("1 Feature. 2 Personas.", bg="white", corner="Design challenge", fw=600)
N[68] = S("1 Feature. 2 Personas. 2 Design languages", bg="white", corner="Design challenge", fw=600)
N[69] = {"kind": "cards", "bg": "white", "heading": "Trader types",
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
         "labels": [{"text": "Regular trading platforms", "x": 25, "y": 34.6},
                    {"text": "Advanced trading platforms", "x": 75, "y": 34.6}],
         "shots": [crop(70, 'a', 12.0, 38.6, 38.0, 100), crop(70, 'b', 62.4, 37.8, 87.6, 100)]}
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
GOAL_CARDS_LIVE = [GOAL_CARDS[0], dict(GOAL_CARDS[1], icon=dict(_goal_icons[1], hide=True))]
N[75] = {"kind": "goals", "bg": "white", "corner": "Goal", "cards": GOAL_CARDS_LIVE, "live": GOAL_LIVE}
N[76] = {"kind": "goals", "bg": "white", "corner": "Goal", "cards": GOAL_CARDS_LIVE, "live": GOAL_LIVE}

# the symbol-discovery build: one, two, then three release cards
RELEASES = [(4.14, "Original design"), (35.75, "Beta release"), (67.37, "Public release")]


def releases(n, k):
    STRIP = ("Old", "design")
    return {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
            "labels": [{"text": t, "x": round(x + 14.22, 2), "y": 80.1, "size": "lg"} for x, t in RELEASES[:k]],
            "shots": [crop(n, "abc"[i], x, 23.8, x + 28.44, 78.8, strip=STRIP) for i, (x, _) in enumerate(RELEASES[:k])]}


N[77] = releases(77, 1)
N[78] = releases(78, 2)
N[79] = releases(79, 2)
N[79]["labels"] = releases(79, 3)["labels"]
# the third card is drawn by the deck and holds the live fractional order
# flow, bleeding off the card's bottom edge the way the release phones do
N[79]["boxes"] = [{"x": 67.37, "y": 23.8, "w": 28.44, "h": 55.0, "c": "#f6f6f6"}]
N[79]["live"] = [live("fractional-order-flow", 72.2, 35.2, 20.85, 43.6, css=FOF_BG, fit=".fof-frame",
                      vh=1000, mode="width", clip=True)]
# the live quote screen, as the slide draws it: large, bleeding off the bottom
N[80] = {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
         "live": [live("alert-creation", 33.38, 35.28, 33.3, 64.72, css=ACS_BG, fit=PHONE, vh=1000, mode="width")]}
N[81] = {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
         "live": [live("alert-creation", 33.38, 35.28, 33.3, 64.72, css=ACS_BG, fit=PHONE, vh=1000, mode="width",
                       init="openFractional")]}
N[82] = {"kind": "goals", "bg": "white", "plain": True, "cards": [
    dict(GOAL_CARDS[0], x=8.9, y=38, w=40, h=20, icon=None), dict(GOAL_CARDS[1], x=51.1, y=38, w=40, h=20, icon=None)]}

WIZ = ("Original", "multi", "page", "wizard", "order", "entry")
N[83] = {"kind": "media", "bg": "canvas", "heading": "Original design",
         "labels": [{"text": "Original multi page wizard order entry", "x": 47.45, "y": 19.6, "size": "lg"}],
         "shots": [crop(83, 'a', 0, 22.0, 100, 92.0, strip=WIZ)]}
N[84] = {"kind": "media", "bg": "canvas", "heading": "Original design",
         "labels": [{"text": "Original multi page wizard order entry", "x": 47.45, "y": 17.1, "size": "lg"}],
         "shots": [crop(84, 'a', 0, 19.6, 100, 92.0, strip=WIZ)]}
N[85] = {"kind": "media", "bg": "white", "heading": "Original design",
         "panels": [P(0, 64.27, CANVAS)],
         "labels": [{"text": "Original multi page wizard order entry", "x": 26.85, "y": 15.3, "size": "lg"},
                    {"text": "Suggested design", "x": 82.5, "y": 15.3, "size": "lg"}],
         "shots": [crop(85, 'a', 0, 17.7, 64.27, 94.0, strip=WIZ)],
         "live": [live("fractional-order-flow", 72.08, 18.4, 21.11, 73.11, css=FOF_BG, fit=".fof-frame", vh=1000)]}
N[86] = {"kind": "media", "bg": "white", "heading": "How does an advanced trader place an order?",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Old design", "x": 28.45, "y": 15.5}],
         "shots": [crop(86, 'a', 16.2, 17.8, 37.4, 90.4, strip=("Old", "design", "Updated"))]}
N[87] = {"kind": "media", "bg": "white", "heading": "Happy path", "heading2": {"text": "Happy path", "x": 52.6},
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Old design", "x": 26.99, "y": 13.2}, {"text": "Updated design", "x": 73.57, "y": 13.2}],
         "shots": [crop(87, 'a', 16.2, 17.8, 37.4, 90.4, strip=("Old", "design", "Updated"))],
         "live": [live("order-placement-boxed-single", 64.22, 15.19, 18.7, 74.13, css=PHONE_BG, fit=PHONE, vh=1000)]}
N[88] = {"kind": "numbered", "bg": "white", "kicker": "Design process",
         "items": ["Happy path design", "Order type navigation", "Symbol discoverability"], "active": [1]}
N[89] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "shots": [crop(89, 'a', 33.7, 28.5, 66.2, 100)]}
N[90] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "labels": [{"text": "V1", "x": 31.45, "y": 34.4}, {"text": "V2", "x": 73.25, "y": 34.4}],
         "shots": [crop(90, 'a', 14.1, 37.4, 47.6, 100, strip=("V", "1", "V2")),
                   crop(90, 'b', 55.8, 37.4, 89.3, 100, strip=("V", "1", "V2"))]}
N[91] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "shots": [crop(91, 'a', 32.5, 25.2, 66.5, 100)]}
N[92] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "shots": [crop(92, 'a', 14.0, 16.8, 36.3, 90.4), crop(92, 'b', 59.5, 22.5, 91.0, 75.0)]}
N[93] = D("Final designs", bg="white", tone="green")
N[94] = D("", bg="white")

# final-design collages: the cards and icons stay the PDF's (re-rendered),
# everything that exists as a prototype is wiped from the render and runs live
_P95 = (62.9, 5.2, 87.8, 94.0)       # the phone
_SW = (21.0, 16.3, 33.4, 36.5)       # the switcher icon (both collages)
SWITCHER = live("fractional-order-flow", 21.0, 16.3, 12.4, 20.2, css=FOF_BG,
                fit='img[alt="Swap amount and quantity"]', vh=1000, clip=True, pad=30)
_S95 = (6.4, 65.4, 45.9, 81.4)       # the white strip holding the banner icon
N[95] = {"kind": "media", "bg": "white",
         "shots": [crop(95, 'a', 0, 0, 100, 100, wipe=(_P95, _S95, _SW))],
         "live": [SWITCHER, live("fractional-shares-banner", 6.4, 65.4, 39.5, 16.0, 760, css=WHITE_BG, clip=True),
                  live("fractional-order-flow", 63.94, 7.04, 22.55, 83.45, css=FOF_BG, fit=".fof-frame", vh=1000)]}
FRAC_LABELS = [{"text": "Market non-fractional", "x": 18.25, "y": 27.2},
               {"text": "Market fractional", "x": 50.35, "y": 27.2},
               {"text": "Limit non-fractional", "x": 82.05, "y": 27.2}]
N[96] = {"kind": "media", "bg": "white", "labels": FRAC_LABELS,
         "shots": [crop(96, "abc"[i], x0, 29.6, x1, 100, strip=("Market", "non-", "fractional", "Limit"))
                   for i, (x0, x1) in enumerate([(2.0, 32.1), (33.9, 64.0), (65.8, 95.9)])]}
_T97 = (20.68, 62.78, 31.56, 83.98)  # the "Order sent" tile
N[97] = {"kind": "media", "bg": "white",
         "shots": [crop(97, 'a', 0, 0, 100, 100, wipe=(_T97, _SW))],
         "live": [SWITCHER, live("order-placed-animation", 20.68, 62.78, 10.88, 21.2, css=OPA_BG,
                       fit=".opa-badge, .opa-caption", vh=1000, clip=True, pad=26, init="mute")]}
N[98] = D("Impact", bg="white", tone="green")
N[99] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
         "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[100] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
          "award": ["UX Design Awards", "Fall 2025 Nominee"],
          "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[101] = D("Reflections", bg="white", tone="green")
N[102] = D("")
N[103] = raster(103)

for e in N.values():  # slides with a step-by-step build
    for sh in e.get("shots", []):
        if sh.get("annot"):
            if sh["annot"].get("points"):
                e["steps"] = len(sh["annot"]["points"]) - 1
assert sorted(N) == list(range(1, 104)), set(range(1, 104)) - set(N)
out = []
for n in range(1, 104):
    e = {"n": n}
    e.update(N[n])
    out.append(e)
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
