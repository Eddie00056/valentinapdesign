"""GUSTO deck v2 — built against `Case study presentation (GUSTO) (2).pdf`.

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

PDF = '/Users/ep/Downloads/Case study presentation (GUSTO) (2).pdf'
REPO = '/Users/ep/valentinapdesign'
OUT = f'{REPO}/src/data/gustoDeck.json'
CROPS = f'{REPO}/public/website/case/gusto/v2'
SLIDES = f'{REPO}/public/website/case/gusto/slides'
SCALE = 4

doc = fitz.open(PDF)
os.makedirs(CROPS, exist_ok=True)
made = set()


def crop(n, key, x0, y0, x1, y1, strip=()):
    """Render % rect of page n; return a `shots` entry placed at that rect.
    `strip` words are the slide's own captions that overlap the crop — they
    are redacted from a throwaway copy first, since the deck sets them as
    real type."""
    name = f'{n:03d}{key}'
    r = fitz.Rect(x0 * 19.2, y0 * 10.8, x1 * 19.2, y1 * 10.8)
    path = f'{CROPS}/{name}.webp'
    if '--fast' not in sys.argv or not os.path.exists(path):
        page = doc[n - 1]
        if strip:
            tmp = fitz.open(PDF)
            page = tmp[n - 1]
            for w in page.get_text('words'):
                if w[4] in strip and fitz.Rect(w[:4]).intersects(r):
                    page.add_redact_annot(fitz.Rect(w[:4]) + (-3, -3, 3, 8), fill=False)
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                                  graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED)
        pm = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=r)
        pm.pil_save(path, quality=90, method=6)
    made.add(name)
    return {"src": name, "x": x0, "y": y0, "w": round(x1 - x0, 3)}


def cardimg(n, tag, xref, x, w, y=None, cy=None, radius=30, key=True):
    """An embedded screenshot pulled at native resolution, with the flat
    backdrop it was exported on cut away: the card's own 1px border is
    found by scanning in from each edge, and everything outside that
    rounded rect goes transparent. Placed at x/w (% of canvas), top at y or
    vertically centred on cy."""
    name = f'{n:03d}{tag}'
    path = f'{CROPS}/{name}.webp'
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
FOF_BG = ".fof-stage{background:none!important}"
ACS_BG = ".acs-root{background:none!important}"


def live(page, x, y, w, h, vw=1280, css="", fit=None, vh=960, clip=False, pad=0):
    e = {"page": page, "x": x, "y": y, "w": w, "h": h, "vw": vw, "css": css}
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
N[26] = {"kind": "metrics", "bg": "black", "kicker": "Success metrics",
         "icon": crop(26, 'a', 20.8, 31.5, 27.0, 43.5),
         "items": [{"text": "Reduce time to\ntrade by 15%", "x": 20.8}, {"text": "Reduce number of\nclicks by 30%", "x": 55.7}]}
N[27] = D("How?")
N[28] = S("What data do we show and how?", "Reducing time to trade")
N[29] = {"kind": "media", "bg": "black", "heading": "How do we show the data?",
         "labels": [{"text": "Current widget layout", "x": 50, "y": 21.5}],
         "shots": [place(crop(29, 'a', 34.8, 34.6, 65.1, 61.4), 21, 58, y=25.5)]}
N[30] = {"kind": "media", "bg": "black", "heading": "How do we show the data?",
         "labels": [{"text": "Current widget layout", "x": 50, "y": 21.5}],
         "shots": [place(crop(30, 'a', 35.3, 37.4, 66.4, 65.4), 20.5, 59, y=25.5)]}
# 31: the PDF's red boxes don't line up with the fields once the widget is
# enlarged, so the widget comes from the clean embedded bitmap and the marks
# are drawn by the deck, positioned in the image's own coordinates.
_w31 = cardimg(31, 'a', 2226, 21, 58, y=25.5, radius=0, key=False)


def marks(shot, rects, aspect):
    """rects in fractions of the shot (x0, y0, x1, y1) -> slide-% boxes."""
    h = shot["w"] * 19.2 / aspect / 10.8
    return [{"x": round(shot["x"] + a * shot["w"], 3), "y": round(shot["y"] + b * h, 3),
             "w": round((c - a) * shot["w"], 3), "h": round((d - b) * h, 3)} for a, b, c, d in rects]


N[31] = {"kind": "media", "bg": "black", "heading": "What data do we show?",
         "labels": [{"text": "Current widget layout: ", "accent": "repeated and redundant fields", "x": 50, "y": 21.5}],
         "shots": [_w31],
         "marks": marks(_w31, [(0.008, 0.318, 0.352, 0.478),    # Route + Sub-route
                               (0.128, 0.562, 0.438, 0.832),    # exit order type + qty
                               (0.620, 0.562, 0.972, 0.832)],   # exit limit + duration
                        1064 / 524)}
N[32] = {"kind": "media", "bg": "black", "heading": "What data do we show?",
         "panels": [P(0, 50, "#0e0e0e", 16)],
         "labels": [{"text": "Current widget design", "x": 25, "y": 22.6},
                    {"text": "Updated widget design", "x": 75, "y": 22.6}],
         "shots": [place(crop(32, 'a', 8.9, 25.1, 39.2, 51.7), 4, 42, cy=57)],
         "live": [live("stock-order-entry", 55, 30, 40, 54, css=TICKET_BG, fit=CARD)]}
N[33] = S("How do we make the option trade\nexperience faster?", "Reducing time to trade")
N[34] = S("What are options?")
N[35] = {"kind": "twocol", "bg": "black", "panels": [P(0, 50, DARK_PANEL)],
         "left": "Single-leg / Option = 🍔", "right": "Multi-leg / Strategy = 🍔🥤🍟"}
N[36] = {"kind": "journey", "bg": "black", "kicker": "User journey", "steps": JOURNEY, "active": 2}
N[37] = S("The journey between finding an option and\nplacing an option trade was broken", "Reducing time to trade")
N[38] = S("80% of Questrade’s revenue = the most complex\nindustry experience", "The problem")
N[39] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade",
         "shots": [crop(39, 'a', 10.4, 13.2, 89.6, 95.0)]}
N[40] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade",
         "shots": [place(crop(40, 'a', 35.6, 31.0, 64.4, 49.9), 17, 66, cy=55)]}
N[41] = S("Tailor the order placement experience\nto each security type", "The solution")
N[42] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         "panels": [P(0, 50, DARK_PANEL)],
         "shots": [cardimg(42, 'a', 2644, 3, 44, cy=55, radius=0)]}
N[43] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         "panels": [P(0, 33, DARK_PANEL)],
         "shots": [cardimg(43, 'a', 2644, 1.5, 30, cy=55, radius=0)],
         "live": [live("stock-order-entry", 35, 25, 29.5, 60, css=TICKET_BG, fit=CARD),
                  live("options-strategy-builder", 66.5, 20, 30.5, 70, css=TICKET_BG, fit=CARD)]}
N[44] = {"kind": "media", "bg": "black", "heading": "Reduce time to trade: Options",
         "live": [live("chain-to-order", 8, 15, 84, 80, 1440, fit=".ctt .wshell", vh=900, clip=True, pad=18)]}
N[45] = {"kind": "media", "bg": "black",
         "live": [live("options-strategy-builder", 26, 12, 48, 76, css=TICKET_BG, fit=CARD)]}
N[46] = {"kind": "media", "bg": "black",
         "live": [live("options-strategy-builder", 5, 16, 44, 70, css=TICKET_BG, fit=CARD)]}
N[47] = {"kind": "numbered", "bg": "black", "items": PILLARS, "active": [0, 1]}
N[48] = {"kind": "numbered", "bg": "black", "items": PILLARS, "active": [0, 1]}
N[49] = {"kind": "media", "bg": "black", "heading": "Maximizing widget and workspace efficiency",
         "panels": [P(0, 50.1, DARK_PANEL, 16)],
         "labels": [{"text": "Screenshot of a client’s workspace", "x": 25, "y": 22.6},
                    {"text": "Redesigned workspace layout", "x": 75, "y": 22.6}],
         "shots": [crop(49, 'a', 2.2, 27.1, 48.0, 74.0)],
         # the redesigned workspace, live: /work/chain-to-order, rail and all
         "live": [live("chain-to-order", 52.2, 26, 45.6, 50, 1440, fit=".wsp-screen", vh=900, clip=True)]}
N[50] = {"kind": "media", "bg": "black", "heading": "Maximizing widget and workspace efficiency",
         "panels": [P(0, 63, DARK_PANEL, 16)],
         "labels": [{"text": "Initial design", "x": 31.5, "y": 21.2}, {"text": "Updated design", "x": 81.5, "y": 21.2}],
         "shots": [cardimg(50, 'a', 2949, 3, 28.5, y=26),
                   cardimg(50, 'b', 2947, 33.5, 26.5, y=26),
                   cardimg(50, 'c', 2945, 67, 29, y=26)]}
N[51] = D("Final designs")
N[52] = {"kind": "media", "bg": "black", "bigTitle": "Then vs ", "bigAccent": "Now",
         "panels": [P(0, 50.1, DARK_PANEL, 23)],
         "shots": [cardimg(52, 'a', 3019, 4, 42, cy=58, radius=0)],
         "live": [live("stock-order-entry", 55, 22, 40, 33, css=TICKET_BG, fit=CARD),
                  live("options-strategy-builder", 55, 57, 40, 39, css=TICKET_BG, fit=CARD)]}
N[53] = dict(raster(53), live=[live("chain-to-order", 12.2, 8.3, 75.3, 83.6, 1440,
                                     fit=".wsp-screen", vh=900, clip=True)])
N[54] = D("Impact")
N[55] = {"kind": "figures", "bg": "black", "tone": "mint", "panels": [P(0, 50, DARK_PANEL)], "split": True,
         "items": [["60%", "faster to place trades"], ["85%", "Satisfaction score during the closed beta"]]}
N[56] = D("Reflections")

# ---- case study 2: fractional shares ----------------------------------------
N[57] = {"kind": "titlecard", "bg": "white", "kicker": "Case study", "title": "Fractional\nshares", "fs": 84,
         "shot": crop(57, 'a', 46.7, 4.9, 98.3, 95.2)}
N[58] = {"kind": "numbered", "bg": "white", "corner": "Company goal", "size": "lg",
         "items": ["Win more active traders", "Streamline the trading experience"], "active": "all"}
N[59] = S("Introduce fractional trading", bg="white", corner="Solution")
N[60] = S("What is that?", bg="white", corner="Solution")
N[61] = {"kind": "media", "bg": "white", "corner": "Solution",
         "shots": [crop(61, 'a', 15.5, 19.5, 80, 81)]}
N[62] = {"kind": "role", "bg": "white", "corner": "My contribution",
         "rows": [["My role", "Product Designer"], ["Design Timeline", "4 months"],
                  ["Team", "4 Engineering teams\n1 UX Researcher\n3 Product Managers"]],
         "shot": crop(62, 'a', 58.4, 9.0, 87.7, 85.5)}
N[63] = {"kind": "media", "bg": "white", "corner": "Research",
         "shots": [crop(63, 'a', 31.6, 20.2, 68.8, 100)]}
N[64] = S("Traders need affordable and flexible ways\nto trade.", bg="white", corner="Problem", fw=600)
N[65] = S("1 Feature.", bg="white", corner="Design challenge", fw=600)
N[66] = S("1 Feature. 2 Personas.", bg="white", corner="Design challenge", fw=600)
N[67] = S("1 Feature. 2 Personas. 2 Design languages", bg="white", corner="Design challenge", fw=600)
N[68] = {"kind": "media", "bg": "white", "corner": "2 Personas = 2 mental models",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Regular trader", "x": 25.9, "y": 27.6}, {"text": "Advanced trader", "x": 75, "y": 27.6}],
         "shots": [crop(68, 'a', 10.2, 31.3, 41.6, 68.5, strip=("Old", "design", "Updated")), crop(68, 'b', 56.9, 31.3, 93.0, 68.7, strip=("Old", "design", "Updated"))]}
N[69] = {"kind": "media", "bg": "white", "corner": "2 Platforms = 2 Design languages",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Regular trading platforms", "x": 25, "y": 24.8},
                    {"text": "Advanced trading platforms", "x": 75, "y": 24.8}],
         "shots": [crop(69, 'a', 11.5, 28, 38.5, 100), crop(69, 'b', 63, 28, 89.5, 100)]}
N[70] = {"kind": "checklist", "bg": "white", "corner": "Project scope", "panels": [P(0, 50, LIGHT_PANEL)], "cols": [NORTH]}
N[71] = {"kind": "checklist", "bg": "white", "corner": "Project scope", "panels": [P(0, 50, LIGHT_PANEL)], "cols": [NORTH, MVP]}
N[72] = S("How might we make investing\naccessible to new investors without\nslowing down advanced traders?",
          bg="white", corner="The challenge", fw=600)
N[73] = D("Design process", bg="white", tone="green", fs=125)
N[74] = {"kind": "numbered", "bg": "white", "corner": "Goal", "items": GOALS, "active": "all"}
N[75] = {"kind": "numbered", "bg": "white", "corner": "Goal", "items": GOALS, "active": [0]}
N[76] = {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
         "labels": [{"text": "Original design", "x": 18.3, "y": 80.4, "size": "lg"},
                    {"text": "Beta release", "x": 50, "y": 80.4, "size": "lg"},
                    {"text": "Public release", "x": 81.6, "y": 80.4, "size": "lg"}],
         "shots": [crop(76, 'a', 3.9, 23.3, 33.0, 79.2), crop(76, 'b', 35.5, 23.3, 64.5, 79.2),
                   crop(76, 'c', 67.0, 23.3, 96.2, 79.2)]}
N[77] = {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
         "live": [live("fractional-shares-banner", 20, 30, 60, 40, 420)]}
N[78] = {"kind": "media", "bg": "white", "corner": "How do I find the right symbol?",
         "live": [live("alert-creation", 30, 14, 40, 84, css=ACS_BG, fit=PHONE, vh=1000)]}
N[79] = {"kind": "numbered", "bg": "white", "corner": "Goal", "items": GOALS, "active": [1]}
N[80] = {"kind": "media", "bg": "canvas", "heading": "Original design",
         "labels": [{"text": "Original multi page wizard order entry", "x": 47.3, "y": 89.2, "size": "lg"}],
         "shots": [crop(80, 'a', 9.8, 21.6, 85.0, 88.4)]}
N[81] = {"kind": "media", "bg": "white", "heading": "How does a novice trader place an order?",
         "labels": [{"text": "Old design", "x": 26.3, "y": 13.2}, {"text": "Updated design", "x": 72.5, "y": 13.2}],
         "shots": [crop(81, 'a', 15.8, 16.8, 36.8, 90.3, strip=("Old", "design", "Updated"))],
         "live": [live("fractional-order-flow", 58, 16.5, 29, 77, css=FOF_BG, fit=".fof-frame", vh=1000)]}
N[82] = {"kind": "media", "bg": "white", "heading": "How does an advanced trader place an order?",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Old design", "x": 26, "y": 13.2}],
         "shots": [crop(82, 'a', 15.6, 16.6, 37.4, 92.5, strip=("Old", "design", "Updated"))]}
N[83] = {"kind": "media", "bg": "white", "heading": "Happy path",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "labels": [{"text": "Old design", "x": 26, "y": 13.2}, {"text": "Updated design", "x": 75, "y": 13.2}],
         "shots": [crop(83, 'a', 15.6, 16.6, 37.4, 92.5, strip=("Old", "design", "Updated")), crop(83, 'b', 64.0, 16.9, 86.1, 93.0, strip=("Old", "design", "Updated"))]}
N[84] = {"kind": "numbered", "bg": "white", "kicker": "Design process",
         "items": ["Happy path design", "Order type navigation", "Symbol discoverability"], "active": [1]}
N[85] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "shots": [crop(85, 'a', 33.7, 28.5, 66.2, 100)]}
N[86] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "labels": [{"text": "V1", "x": 30.85, "y": 34.4}, {"text": "V2", "x": 72.55, "y": 34.4}],
         "shots": [crop(86, 'a', 14.1, 37.4, 47.6, 100, strip=("V", "1", "V2")),
                   crop(86, 'b', 55.8, 37.4, 89.3, 100, strip=("V", "1", "V2"))]}
N[87] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "shots": [crop(87, 'a', 32.5, 25.2, 66.5, 100)]}
N[88] = {"kind": "media", "bg": "white", "heading": "Navigating edge cases",
         "panels": [P(50, 50, LIGHT_PANEL)],
         "shots": [crop(88, 'a', 14.0, 16.8, 36.3, 90.4), crop(88, 'b', 59.5, 22.5, 91.0, 75.0)]}
N[89] = D("Final designs", bg="white", tone="green")
FRAC_LABELS = [{"text": "Market non-fractional", "x": 17.05, "y": 26.6},
               {"text": "Market fractional", "x": 48.95, "y": 26.6},
               {"text": "Limit non-fractional", "x": 80.85, "y": 26.6}]
FRAC = [(2.0, 32.1), (33.9, 64.0), (65.8, 95.9)]


def frac(n, k):
    return [crop(n, "abc"[i], x0, 29.6, x1, 100, strip=("Market", "non-", "fractional", "Limit")) for i, (x0, x1) in enumerate(FRAC[:k])]


N[90] = {"kind": "media", "bg": "white", "labels": FRAC_LABELS, "shots": frac(90, 1)}
N[91] = {"kind": "media", "bg": "white", "labels": FRAC_LABELS, "shots": frac(91, 2)}
N[92] = {"kind": "media", "bg": "white", "labels": FRAC_LABELS, "shots": frac(92, 3)}
N[93] = {"kind": "media", "bg": "white", "shots": [crop(93, 'a', 39.0, 15.0, 61.0, 91.0)]}
N[94] = D("Impact", bg="white", tone="green")
N[95] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
         "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[96] = {"kind": "figures", "bg": "white", "tone": "green", "layout": "top",
         "award": ["UX Design Awards", "Fall 2025 Nominee"],
         "items": [["60K", "increase in trading volume"], ["$33M", "total value traded"]]}
N[97] = D("Reflections", bg="white", tone="green")
N[98] = {"kind": "numbered", "bg": "black", "kicker": "Questrade Goal",
         "items": ["Win more active traders", "Streamline trading"], "active": "all",
         "shot": crop(98, 'a', 52.8, 14.3, 95.7, 90.6)}
N[99] = D("")
N[100] = raster(100)
N[101] = raster(101)
N[102] = D("")

assert sorted(N) == list(range(1, 103)), set(range(1, 103)) - set(N)
out = []
for n in range(1, 103):
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
