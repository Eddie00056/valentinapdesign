"""GUSTO deck v3 — dumb-simple full rebuild.

Every page of the PDF export becomes one slide, one full-bleed raster,
1:1, in order. No crops, no live embeds, no per-slide hand-tuning, no
page-number remapping. This trades the old build's interactivity for
guaranteed fidelity to whatever is currently in the Figma file — rebuild
from a fresh export any time by re-running against the new PDF.
"""
import fitz
import json

REPO = '/Users/ep/valentinapdesign'
PDF = '/Users/ep/Downloads/Case study presentation (GUSTO) (8).pdf'
ASSET_DIR = f'{REPO}/public/website/case/gusto/v2'
OUT = f'{REPO}/src/data/gustoDeck.json'
SCALE = 3

doc = fitz.open(PDF)
slides = []
for i in range(doc.page_count):
    n = i + 1
    name = f'{n:03d}full'
    pm = doc[i].get_pixmap(matrix=fitz.Matrix(SCALE, SCALE))
    pm.pil_save(f'{ASSET_DIR}/{name}.webp', quality=90, method=6)
    slides.append({
        'n': n,
        'kind': 'media',
        'bg': 'black',
        'shots': [{'src': name, 'x': 0, 'y': 0, 'w': 100}],
    })

json.dump(slides, open(OUT, 'w'), indent=2)
print(f'{len(slides)} slides written to {OUT}')
