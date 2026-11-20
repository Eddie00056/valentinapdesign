/* The new ticket UI (the /work/stock-order-entry-review study, user
   2026-11-12), written for any ob- ticket: the lifted neutral card; 4px
   fields; neutral rules and search pill; labels at 60% ink; steppers only
   in use; the bracket's results coloured; the actions full width and
   taller, sharing the fields' 4px corner. (A flat "standalone page" look
   with the title bar back was tried and reverted, 2026-11-12.)

   Worn by the deck's order entry slides (GustoDeck) and — when the deck
   flags the page it embeds with --ticket-ui — by ChainLoop's copies on
   slide 35's MacBook. The website itself never sees it. */
/* The fields' state ramp, in neutrals (the user, 2026-11-19: hovering a
   field has to show it is interactive — their Atlas sheet: the whole field
   lights where the prefix is a label; a clickable prefix lights alone; the
   value half lights with its arrows; each arrow takes its own plate).
   The base sheet already draws all of that off these tokens; the deck had
   been pinning every field to a flat 8% white with !important, which
   switched every state off. So: the tokens, not the fill.
   Opaque, not white-at-n%: the prefix paints its own --chip ground over
   the field's, and two translucent layers would double up. The Atlas
   steps kept exactly (default → hover +20, → press +11; the arrow plates
   +19 / +28 over hover), starting from the 8% white the fields read at on
   the card (#242424); selected is the chain's picked plate, the new green
   at 12% on the card. */
const FIELD_STATES =
  ".ob-stage{--chip:#242424!important;--chip-hover:#383838!important;--chip-press:#434343!important;" +
  "--chip-sel:#1e2920!important;--arrow-hover:#4b4b4b!important;--arrow-press:#545454!important}";

const GRAD =
  "linear-gradient(180deg,color-mix(in srgb,var(--rim) 37%,var(--body)),color-mix(in srgb,var(--rim) 22%,var(--body)) 1px,color-mix(in srgb,var(--rim) 14%,var(--body)) 2px,color-mix(in srgb,var(--rim) 10%,var(--body)) 3px,color-mix(in srgb,var(--rim) 7%,var(--body)) 4px,color-mix(in srgb,var(--rim) 4%,var(--body)) 5px,color-mix(in srgb,var(--rim) 2%,var(--body)) 6.5px,var(--body) 8px,var(--body) calc(100% - 3px),color-mix(in srgb,var(--rim) 2%,var(--body)) calc(100% - 2px),color-mix(in srgb,var(--rim) 8%,var(--body)) calc(100% - 1px),color-mix(in srgb,var(--rim) 22%,var(--body))) padding-box";

export const TICKET_UI =
  /* the lifted card the user called the most premium (2026-11-12): a
     neutral grey fill (the teal-black read green on the slides), a lit top
     rim and a 6% hairline for the #5b5f62 edge, 6 corners (8 until the
     user's 2026-11-12 call); the deck's own
     .gd-shade draws the drop. The title bar stays hidden (the deck theme;
     brought back and removed again, 2026-11-12) */
  "html.is-bare .wshell.wshell,.wshell.wshell{background:linear-gradient(180deg,#141414 0%,#0d0d0d 100%)!important;border:0!important;" +
  "border-radius:6px!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;" +
  /* the 6% hairline drawn 1px INSIDE the edge (an outline over the card),
     not as a ring outside it: a slide that fits the card by width (17's
     "My role") clips exactly at the card's sides, which cut the ring away
     there (the user, 2026-11-19: the widget "cut off at the sides") */
  "box-shadow:inset 0 1px 0 rgba(255,255,255,.09)!important;" +
  "outline:1px solid rgba(255,255,255,.06)!important;outline-offset:-1px!important}" +
  "html.is-bare .ob-stage .wshell.wshell.ob-modal,.ob-stage .wshell.wshell.ob-modal{background:#0d0d0d!important}" +
  ".ob-stage .ob-field{border-radius:4px!important}" +
  FIELD_STATES +
  /* the order entry study's final ticket (the user, 2026-11-19: "replace
     the order entry ticket with this one everywhere including on the
     option chain"): fields 140 × 28 (152 × 30) on both tickets — the
     longest control, the condition "Immediate or cancel", still clears
     its chevron by 21 at 140 — and no ±0.01 arrows: a value is typed, or
     its unit cycled */
  ".ob-stage{--field-h:28px!important;--line-w:140px!important}" +
  ".ob-stage .ob-stepper-hit{display:none!important}" +
  /* the confirmation without its inner panel (the user, 2026-11-19:
     "remove the container inside the order confirmation"): the sections
     sit straight on the card, divided by their rules as before */
  ".ob-stage .ob-conf-body{background:none!important;border-radius:0!important}" +
  /* the options ticket as narrow as the stock one (the user, 2026-11-19:
     "make this as narrow as the stocks only widget"): 304, its modal too */
  /* then roomier (the user, 2026-11-19: "slightly bigger … more padding
     on the left and right"): the leg rows, the fields and the footer 10 in
     from their panels instead of 6, the card 8 wider (312) so the content
     keeps its 284 */
  ".ob-stage:not(.st-stage) .ob-shell,.ob-stage:not(.st-stage) .ob-modal{width:312px!important}" +
  /* legs as full-width bands (the user, 2026-11-19): a leg is a row, like
     the chain's rows and the dropdown items, so its highlight runs edge to
     edge, square, clipped to the card's corners and under its edge —
     controls stay inset boxes. The card's 4 side/top inset moves into each
     section, so the content line holds at 14 from the card: */
  ".ob-stage:not(.st-stage) .ob-card{padding-left:0!important;padding-right:0!important;padding-top:0!important}" +
  ".ob-stage:not(.st-stage) .ob-params-panel,.ob-stage:not(.st-stage) .ob-foot{padding-left:14px!important;padding-right:14px!important}" +
  ".ob-stage:not(.st-stage) .ob-leg{padding-left:14px!important;padding-right:14px!important;border-radius:0!important}" +
  // the first leg keeps its text where it was: the card's 4 top inset, inside
  ".ob-stage:not(.st-stage) .ob-leg-u:first-child>.ob-leg,.ob-stage:not(.st-stage) .ob-leg-u[data-leaving]:first-child+.ob-leg-u>.ob-leg{padding-top:12px!important}" +
  // …handed to the next leg as the first one folds, over about the fold's length
  ".ob-stage:not(.st-stage) .ob-leg{transition:background .16s ease,padding-top .3s cubic-bezier(.2,0,0,1)!important}" +
  /* the card's stroke over its bands, not under (the user: "the box should
     not go on top of the stroke … but below it"): the outline and the top
     highlight move from the card to a layer above its contents, at the
     same values — 6% on its own page, 10% on the workspace */
  "html .ob-stage:not(.st-stage) .wshell.wshell.wshell{outline-color:transparent!important;box-shadow:none!important}" +
  ".ob-stage:not(.st-stage) .wshell::after{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.09)}" +
  ".wsp .ob-stage:not(.st-stage) .wshell::after{box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.09)}" +
  /* the option chain gets the same (the user, 2026-11-19): its rows run
     edge to edge — the table out to the card's sides, each row and the
     header 4 in, so the columns stay put — under the stroke, moved to a
     layer above the content as on the ticket */
  "html .wshell.wshell.wshell.oc-root.oc-root{outline-color:transparent!important;box-shadow:none!important}" +
  ".wshell.oc-root::after{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.09)}" +
  ".wsp .wshell.oc-root::after{box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.09)}" +
  ".oc-root .oc-table{margin-left:-4px!important;margin-right:-4px!important;border-radius:0!important}" +
  // (the right keeps the grid's 8 for the scrollbar: 8 + 4)
  ".oc-root .oc-head,.oc-root .oc-row{padding-left:4px!important;padding-right:12px!important}" +
  /* the ticket's column the width of its card (312, not the 357 it was
     sized for), so the chain and the ticket sit the layout's 4 apart */
  ".ctt-ticket{flex-basis:312px!important}" +
  // dividers on the content line, and none either side of a lit row
  ".ob-stage:not(.st-stage) .ob-leg-u+.ob-leg-u>.ob-leg::before{left:14px!important;right:14px!important}" +
  ".ob-stage:not(.st-stage) .ob-leg:is([data-linked]:hover,[data-lit])::before,.ob-stage:not(.st-stage) .ob-leg-u:has(>.ob-leg:is([data-linked]:hover,[data-lit]))+.ob-leg-u>.ob-leg::before{opacity:0}" +
  ".ob-stage:not(.st-stage) .ob-legs-panel:has(.ob-leg-u:last-child>.ob-leg:is([data-linked]:hover,[data-lit]))+.ob-params-panel .ob-params{border-top-color:transparent!important}" +
  // the payoff box's edges on the same line as the fields' (its 6 margin → 10)
  ".ob-stage:not(.st-stage) .ob-payoff{margin-left:14px!important;margin-right:14px!important}" +
  /* …and its leg line still whole at 304: a price is right-aligned, so its
     44 minimum only held space — at its own width ("$3.07" 30) the
     description gets the rest */
  ".ob-stage:not(.st-stage) .ob-leg-px{min-width:0!important}" +
  /* the leg's two insets equal (the user, 2026-11-19): the text starts 6
     in; the X's 8px glyph, centred in its 16 hit box behind a 5 margin,
     ended 15 in. −4 puts its ink 6 from the edge, the box still 16 */
  ".ob-stage:not(.st-stage) .ob-leg .ob-x{margin-right:-4px!important}" +
  /* positive / negative from the user's button reference (dark mode,
     2026-11-12). Text — every green / red reading in the widgets (P&L,
     price change, legs…) rides --up / --down: its fg-positive #7ED68C and
     fg-negative #E22B18. The actions: see below. */
  /* the negative text #e5837a, not the reference's #e22b18 (the user,
     2026-11-12: "too strong, doesn't match"): the green's own lightness
     and softness on a red hue, a touch more saturated so it isn't dusty;
     ~6.9:1 on the card (#e22b18 was 4.1, under AA) */
  ".ob-stage{--up:#7ed68c!important;--down:#e5837a!important}" +
  '.tpill-chg[data-dir="up"]{color:#7ed68c!important}.tpill-chg[data-dir="down"]{color:#e5837a!important}' +
  /* the actions in the reference's dark tinted glass (the user,
     2026-11-12: "these buttons are different"): its recipe as written —
     a translucent tinted body glowing under a two-step rim, the rim as
     inset lines (fainter at the bottom), coloured labels (black would
     vanish on the dark tint). The ticket's 4px corner kept */
  '.ob-stage .ob-cta:not([data-side="sell"]){--rim:rgba(100,180,110,.6);--body:rgba(86,146,86,.35);--ink:#7ed68c}' +
  '.ob-stage .ob-cta[data-side="sell"]{--rim:rgba(255,120,100,.68);--body:rgba(205,62,41,.33);--ink:#f07161}' +
  // Sell's label #f07161 (the user, 2026-11-19: "make sure the design always
  // passes accessibility"): #ed4f3c measured 3.73:1 on its own tinted body,
  // under AA's 4.5 — the same hue and saturation, lifted just far enough,
  // is 4.66:1 there (5.02 hovered, 6.51 on the card). Earlier note:
  // Sell's label between the reference's #e22b18 (too dark on its body) and
  // the rim's #ff7864 (too light): #ed4f3c, the reference's own negative
  // in light mode (the user, 2026-11-12)
  ".ob-stage .ob-cta{border:0!important;background:" + GRAD + "!important;" +
  "box-shadow:inset 0 .34px 0 var(--rim),inset 0 1.01px 0 color-mix(in srgb,var(--rim) 50%,transparent)," +
  "inset 0 -.34px 0 color-mix(in srgb,var(--rim) 65%,transparent),inset 0 -1.01px 0 color-mix(in srgb,var(--rim) 33%,transparent)," +
  /* the rim down the sides too, at the bottom's strength: drawn only top
     and bottom, the button's ends read as sliced off (the user,
     2026-11-19: the CTA "cut off at the sides") */
  "inset .5px 0 0 color-mix(in srgb,var(--rim) 65%,transparent),inset -.5px 0 0 color-mix(in srgb,var(--rim) 65%,transparent)!important;" +
  "color:var(--ink)!important;-webkit-font-smoothing:antialiased!important}" +
  ".ob-stage .ob-cta .ob-cta-label,.ob-stage .ob-cta .ob-cta-label>span{color:var(--ink)!important}" +
  ".ob-stage .ob-cta:hover{filter:brightness(1.15)}" +
  /* the option chain in the same palette (the user, 2026-11-12: it "looks
     too different" beside the tickets): the new green / red, neutral
     greys for its bands, chips, rows and rules (it was teal-black), the
     bid / ask chips on the fields' grey with rings in the new pair */
  ".oc-root{--up:#7ed68c!important;--down:#e5837a!important;--shell:#0d0d0d!important;--band:transparent!important;--itm:rgba(255,255,255,.03)!important;" +
  "--chip:rgba(255,255,255,.08)!important;--stat:rgba(255,255,255,.08)!important;--green-bg:rgba(126,214,140,.12)!important;" +
  "--primary-900:rgba(126,214,140,.12)!important;--line:rgba(255,255,255,.08)!important;--line-row:rgba(255,255,255,.05)!important;" +
  "--line-itm:rgba(255,255,255,.06)!important}" +
  ".oc-pill--bid,.oc-pill--ask{--pill-bg:rgba(255,255,255,.08)!important}" +
  ".oc-pill--bid{--pill-ring:rgba(229,131,122,.5)!important}.oc-pill--ask{--pill-ring:rgba(126,214,140,.5)!important}" +
  /* a chain row lights only from its leg on the ticket (the user,
     2026-11-19: "dont hover the entire row unless i am hovering over the
     leg in order entry") — not under the pointer, real or the loop's */
  ".oc-row[data-lit]{background:rgba(255,255,255,.05)!important}" +
  ".oc-root .oc-row:not([data-lit]):is(:hover,[data-hov]){background:transparent!important}" +
  // the ticket's end of the same link (a leg hovered, or lit from the
  // chain) in the chain row's grey, not the old teal #272e30 (the user,
  // 2026-11-19: "match on both widgets") — solid, as the lit chain row
  // measures: 5% white reads 2 lighter on the ticket's lighter card top
  ".ob-stage .ob-leg[data-linked]:hover,.ob-stage .ob-leg[data-lit]{background:#1c1c1c!important}" +
  ".oc-menu-list{background:#141414!important}" +
  /* the chain's expiry menu as the tickets' dropdown (the user,
     2026-11-19: "make sure this is applied to all the dropdowns in order
     entry"): 4 below its trigger, rows the trigger's height running edge
     to edge (no inset plates) on the field's 6 inset, the 6 corner, the
     10% edge and the same depth. Its longest date outruns the 124 trigger,
     so the trigger's width is its MINIMUM — still right-aligned to it */
  ".oc-root .oc-menu-list{box-sizing:border-box!important;min-width:100%!important;top:calc(100% + 4px)!important;" +
  "border-radius:6px!important;border-color:rgba(255,255,255,.1)!important;" +
  "box-shadow:0 0 0 1px rgba(0,0,0,.5),0 4px 8px rgba(0,0,0,.45),0 12px 28px -4px rgba(0,0,0,.7)!important}" +
  // the tickets' list margins (see .ob-dd-item below): no top / bottom
  // padding, the card's 10 of ink at the sides, the panel clipping its rows
  ".oc-root .oc-menu-list{padding:0!important;overflow:hidden!important}" +
  ".oc-root .oc-menu-item{box-sizing:border-box!important;height:20px!important;padding:0 8px!important;border-radius:0!important}" +
  // the check is the menu's one accent, green as on the tickets' lists
  ".oc-root .oc-menu-item .oc-exp-marks svg{color:#7ed68c!important}" +
  /* the tickets' dropdown panel and its popover in the same neutrals (the
     user, 2026-11-19: its #171b1c / #454949 rim was the old teal-grey).
     Portalled to <body>, so no .ob-stage in these selectors: the chain's
     menu ground, the cards' 10% edge, the fields' 8% for a hovered row,
     the check in the new green, a row's glyph at the labels' 60% */
  ".ob-dd-menu,.ob-tip{background:#141414!important;border-color:rgba(255,255,255,.1)!important}" +
  /* real depth under the panel (the user, 2026-11-19: "something looks
     off"): the Shares / Dollars list is 66 tall and ends 2px short of the
     Duration field it covers, and its 6 corners are rounder than the
     field's 4 — so a light sliver of that field showed along the bottom
     and round the corners, under a shadow that began 2px below the panel
     (0 14 28 −12) and darkened none of it. It read as a second panel. A
     dark contact ring and a close drop put whatever peeks out in shadow */
  ".ob-dd-menu{box-shadow:0 0 0 1px rgba(0,0,0,.5),0 4px 8px rgba(0,0,0,.45),0 12px 28px -4px rgba(0,0,0,.7)!important}" +
  ".ob-dd-item:hover,.ob-dd-item:focus-visible{background:rgba(255,255,255,.08)!important}" +
  ".ob-dd-item>svg{color:#7ed68c!important}" +
  ".ob-dd-item .ob-dd-lead{color:rgba(254,255,253,.6)!important}" +
  /* a row's glyph against its label, measured in ink (the user,
     2026-11-19: "the padding between the icon and the text is off", then
     "now the icons aren't aligned" when they were set against the label
     end of their column). Glyphs stay CENTRED on one axis down the menu —
     an icon column is read by its centre line — with the share stack at
     the field's own 11 (it was 13: 9.5 of ink against the "$"'s 5.5, which
     is what made the gaps so uneven), and the box gap 5 so the widest
     glyph's painted gap is 8. Measured: stack 8, padlock 9, "$" 10.5 —
     what's left is only the glyphs' own widths, centred */
  ".ob-dd-item .ob-dd-lead>svg{width:11px!important;height:11px!important}" +
  ".ob-dd-item .ob-dd-label{gap:5px!important}" +
  /* a row the height of the field it drops from (the user, 2026-11-19):
     30, not the Atlas doc's 27 (its field was 48 tall at that scale) — a
     hovered row is then exactly a field's size */
  // …the field is 28 since the tighter ticket, so the row follows it
  ".ob-dd-item{height:var(--field-h,28px)!important}" +
  /* no padding above the first row or below the last (the user's menu
     reference, 2026-11-19), and the sides on the CARD's inset: the ticket
     has two — 6 inside a control (a field's text), 10 inside a surface
     (the card's labels sit 10.5 from its edge, its fields stop 10 short)
     — and the list is a surface over the card. 14 (the reference's
     proportion) read too big for this design, the field's 6 too tight
     (the user). 8 + the 1px rim + the glyphs' own bearing put the ink 10
     in on both sides. The panel clips, so a hovered first or last row
     takes its corner. */
  ".ob-dd-menu{padding:0!important;overflow:hidden!important}" +
  ".ob-dd-item{padding:0 8px!important}" +
  /* the light round a quote whose ticket leg is hovered (the user,
     2026-11-19: it "looks bad" since the recolour). The rim it travels is
     made by the chip's fill laid back over the middle (::after,
     `background: inherit`) — opaque #0e231e before, translucent now, so
     the whole arc showed through the chip. The same plate made opaque
     again: its tint over the lit row's grey (measured #1c1c1c).
     And the arc's hot core re-tinted to the new pair (#e8f7ef / #ffe4ea
     were the old mint and pink) */
  ".oc-root .oc-pill[data-beam][data-picked]::after{background:linear-gradient(var(--primary-900),var(--primary-900)),#1c1c1c!important}" +
  ".oc-root .oc-pill[data-beam]:not([data-picked])::after{background:linear-gradient(var(--pill-bg),var(--pill-bg)),#1c1c1c!important}" +
  ".oc-root .oc-beam{background:conic-gradient(from 0deg,transparent 0 72%,var(--up) 84%,#eaf8ec 90%,transparent 96%)!important}" +
  ".oc-root .oc-beam--bid{background:conic-gradient(from 0deg,transparent 0 72%,var(--down) 84%,#fdeae7 90%,transparent 96%)!important}" +
  ".oc-spot::before{border-top-color:rgba(255,255,255,.2)!important}" +
  /* the order confirmation (the user, 2026-11-12: slide 35): its inner
     panel and the scrim off the teal */
  ".ob-stage{--panel:rgba(255,255,255,.04)!important}" +
  ".ob-stage .ob-scrim{background:rgba(0,0,0,.12)!important}" +
  /* the workspace on slide 35's MacBook (the user: its "wallpaper doesn't
     look good anymore"): the teal-black canvas, rail and tabs to the
     tickets' neutral greys, the dot grid in faint white, the mint marks
     to the new green */
  // the workspace windows' title bars (only shown on the MacBook) neutral
  ".wshell-bar{background:rgba(255,255,255,.05)!important}" +
  ".wsp-stage{background:#0a0a0a!important}" +
  /* the windows on the workspace canvas have no deck shadow under them, so
     the cards' 6% hairline vanished (the user: "the stroke has
     disappeared"): 10% there, the standalone page's edge */
  // drawn 1px INSIDE the edge (an outline on top of the card): the ticket's
  // wrapper clips overflow, so a ring outside the card was cut away there
  "html.is-bare .wsp .wshell.wshell,.wsp .wshell.wshell{box-shadow:inset 0 1px 0 rgba(255,255,255,.09)!important;" +
  "outline:1px solid rgba(255,255,255,.1)!important;outline-offset:-1px!important}" +
  // the confirmation toast (and selected plates) off the old teal-green
  ".ob-stage{--green-bg:rgba(86,146,86,.22)!important}" +
  ".wsp,.wsp-screen,.wsp-rail{background:#151515!important}" +
  ".wsp-canvas{background-color:#0d0d0d!important;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px)!important}" +
  ".wsp-tab{background:#222!important;color:#7ed68c!important}" +
  ".wsp-tab:hover{background:#2b2b2b!important}.wsp-tab:active{background:#333!important}" +
  ".wsp-tab[aria-current]{box-shadow:inset 0 0 0 1px #7ed68c!important}" +
  ".wsp-tab--add{background:none!important;color:#c0c3c2!important}.wsp-tab--add:hover{background:#222!important;color:#fefffd!important}" +
  ".wsp-avatar{background:#222!important;color:#7ed68c!important}" +
  // the options legs' "Buy / Sell to open" carry the old pair inline
  '.ob-leg-act[style*="72, 213, 151"]{color:#7ed68c!important}.ob-leg-act[style*="255, 85, 125"]{color:#e5837a!important}' +
  // …and as the server writes them (hex, before React's rgb() re-render)
  '.ob-leg-act[style*="48d597" i]{color:#7ed68c!important}.ob-leg-act[style*="ff557d" i]{color:#e5837a!important}' +
  // the ticket's own thin chevrons back for the deck theme's solid
  // triangles, which read heavy beside the text (the user, 2026-11-12)
  ".ob-stage .ob-chevron{background:none!important;clip-path:none!important}" +
  ".ob-stage .ob-chevron path{display:inline!important}" +
  /* the shares mark 13 → 11 (the user, 2026-11-12: it "looks bigger than
     the $"): at 13 its ink stood 11.25 × 12.75 against the $'s 6.5 × 12 —
     a hair taller and nearly twice as wide, so far more area. At 11 it
     sits at the $'s weight */
  ".ob-field-k > svg:not(.ob-chevron){width:11px!important;height:11px!important}" +
  /* the prefix cell as a small dropdown (the user, 2026-11-19: 46 was "too
     large… the padding between the icon is too big… the left and right
     padding doesn't match what's inside the input fields"; 34 at the
     field's bare 6.5 then read "too narrow"). It takes the dropdown
     fields' own spacing, measured in ink at 4x: the mark 6.5 in from the
     field's edge, as their label (5.95 of padding plus a glyph's own
     bearing; the stack's svg sits 0.5 left to land on the same line);
     the chevron ~9 short of the divider (it snaps to 8.75 or 9.75 at 4x), as theirs sits 9.25 off the
     field's edge (5.82 — it sits well inside its own 12px box); 6 — the
     control inset — between the widest mark, the stack, and its chevron.
     One width for every prefix (38.5, the stack's own), so the values
     after them start on one line from row to row; a narrower mark keeps
     the slack before its chevron ("$" ~8.5). Re-measure if a mark or the
     chevron changes size. */
  ".ob-stage .ob-field-k{min-width:38.5px!important;justify-content:space-between!important;gap:2.25px!important;padding-left:7.07px!important;padding-right:4.7px!important}" +
  ".ob-stage .ob-field-k > svg:not(.ob-chevron){margin-left:-1.25px}" +
  ".ob-stage{--rule:rgba(255,255,255,.08)!important}" +
  // html.is-bare: the page's own bare rule (#1c1e21, blue-grey) outranked a bare .tpill
  // 4 like the fields and actions (the user, 2026-11-12)
  "html.is-bare .tpill,.tpill{background:rgba(255,255,255,.08)!important;border-radius:4px!important}" +
  /* the pill's fixed width re-measured for HOOD (the deck's symbol): 207 was
     DASH's ~$194 walk, which left 12–21px on the right against the 6 on the
     left. HOOD's widest live frame sets ~188 of content: 6 + 188 + 6 + 1 */
  ".st-id{--tpill-w:201px!important}" +
  ".ob-stage .ob-line-label,.ob-stage .ob-line-label[data-tone]{color:rgba(254,255,253,.6)!important}" +
  ".ob-stage .ob-stepper-btns{opacity:0;transition:opacity .14s ease}" +
  ".ob-stage .ob-field:hover .ob-stepper-btns,.ob-stage .ob-field:focus-within .ob-stepper-btns{opacity:1}" +
  /* not while the pointer is on a clickable prefix: that hovers the field
     too, but what lights is the unit, and the arrows belong to the value
     (the user's Atlas sheet, "Prefix states", 2026-11-19) */
  ".ob-stage .ob-field:has(button.ob-field-k:hover):not(:focus-within) .ob-stepper-btns{opacity:0}" +
  '.ob-line:has(.ob-line-label[data-tone="up"]) .ob-sub-v{color:var(--up)!important}' +
  '.ob-line:has(.ob-line-label[data-tone="down"]) .ob-sub-v{color:var(--down)!important}' +
  ".wshell:not(.ob-modal) .ob-foot{flex-direction:column!important;align-items:stretch!important;gap:10px!important}" +
  ".wshell:not(.ob-modal) .ob-ctas{width:100%;gap:6px!important}" +
  ".wshell:not(.ob-modal) .ob-cta{flex:1 1 0;height:30px!important;border-radius:4px!important;font-size:13px!important;font-weight:500!important}" +
  // the options ticket's single Submit sits in the footer column itself,
  // where flex-basis 0 would collapse its height
  ".wshell:not(.ob-modal) .ob-foot>.ob-cta{flex:none!important}" +
  // the stock page's bare footer pads 6 inside its 6 margin: the actions
  // run to the fields' edges instead, as the options ticket's do
  ".st-stage .wshell:not(.ob-modal) .ob-foot{padding-inline:0!important}" +
  // no estimated total / cost above the actions (user, 2026-11-12)
  ".wshell:not(.ob-modal) .ob-cost{display:none!important}";

/* The deck's "new UI" for every widget it embeds (moved here from
   GustoDeck, 2026-11-19, verbatim): the widget card from the user's Figma
   (#010101 at 50% under a 20% black wash, a 10% white edge); the order
   tickets with no title bar, lighter fields with rounder corners, "Limit
   price" on its own with a smaller Mid / Ask line, a solid caret. */
export const DECK_NEW_UI =
  /* no confirmation scrim on a slide (the user, 2026-11-19: "remove the
     weird box"): it fills the page, and a slide's frame crops the page to
     a rectangle — a dim box around the ticket. The panel stands alone. */
  "html .ob-stage .ob-scrim.ob-scrim.ob-scrim{background:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}" +
  "html.is-bare .wshell.wshell,.wshell.wshell{background:linear-gradient(0deg,rgba(0,0,0,.2),rgba(0,0,0,.2)),rgba(1,1,1,.5)!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:8px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important;-webkit-backdrop-filter:blur(100px);backdrop-filter:blur(100px)}" +
  ".ob-stage .wshell-bar,.wshell-bar{display:none!important}" +
  ".ob-stage .ob-field{border-radius:6px!important}" +
  FIELD_STATES +
  ".ob-stage .ob-line-side{display:none}" +
  ".ob-stage .ob-line-sub{font-size:10px!important}" +
  ".ob-stage .ob-x{color:rgba(255,255,255,.55)!important}" +
  // the stepper arrows and the caret in the X's grey, so the three icons
  // down the right edge are one colour
  ".ob-stage .ob-stepper-btns svg *{fill:rgba(255,255,255,.55)!important}" +
  ".ob-stage .ob-chevron{color:rgba(255,255,255,.55)!important}" +
  ".ob-stage .ob-payoff{border-color:rgba(255,255,255,.1)!important}" +
  ".ob-stage .ob-chevron path{display:none}" +
  ".ob-stage .ob-chevron{background:currentColor;clip-path:polygon(22% 38%,78% 38%,50% 68%)}";

/* …and on the Veda slides on top of it: the card's edge a clear cool grey
   (the user's chart reference, 2026-11-04), and the order confirmation
   solid from its first frame (its glass showed the chain through it until
   the blur was painted). */
export const DECK_VEDA =
  "html.is-bare .wshell.wshell,.wshell.wshell{border-color:#5b5f62!important}" +
  "html.is-bare .ob-stage .wshell.wshell.ob-modal,.ob-stage .wshell.wshell.ob-modal{background:#010101!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";

/* The prototype pages opened on their own (/prototypes links to them):
   the order entry study's look exactly as the Veda deck dresses them —
   the deck's layers in the deck's order, the new ticket UI last. The
   deck draws the cards' depth outside the frame (.gd-shade.is-ticket);
   a page has no deck, so the card carries that same layered drop itself,
   after its hairline and top rim. */
export const TICKET_PAGE =
  DECK_NEW_UI +
  DECK_VEDA +
  TICKET_UI +
  "html .wshell.wshell.wshell.wshell:not(.ob-modal){box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 2px 2px -2px rgba(0,0,0,.5),0 12px 12px -12px rgba(0,0,0,.6),0 28px 24px -24px rgba(0,0,0,.65),0 56px 48px -48px rgba(0,0,0,.4)!important}" +
  /* (the bare page's own "none" and the options card's stroke layer both
     outranked the depth; the options card's top highlight is its ::after) */
  "html .ob-stage:not(.st-stage) .wshell.wshell.wshell.wshell:not(.ob-modal){box-shadow:0 2px 2px -2px rgba(0,0,0,.5),0 12px 12px -12px rgba(0,0,0,.6),0 28px 24px -24px rgba(0,0,0,.65),0 56px 48px -48px rgba(0,0,0,.4)!important}" +
  /* the stock ticket's top held, as the deck holds it (the user,
     2026-11-19: switching Market ↔ Limit made the widget "shaky"). Its
     page centred the card (safe center + a 24dvh lift), so every row the
     order type added grew it both ways: the card slid up 18.5px while it
     grew 37, the fields just used moving with it, and every frame landed
     on a fractional pixel. Pinned instead at exactly where the Market
     ticket centred — 38dvh less half its 244 — rounded to a whole pixel,
     it only ever grows down. (The options ticket's base stage already
     pins its top for this reason.) */
  ".ob-stage.st-stage{align-items:start!important;padding-top:max(48px,round(calc(38dvh - 122px),1px))!important}" +
  ".st-stage .ob-deck{margin-bottom:0!important}";
