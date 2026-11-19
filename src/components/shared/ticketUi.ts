/* The new ticket UI (the /work/stock-order-entry-review study, user
   2026-11-12), written for any ob- ticket: the lifted neutral card; 4px
   fields; neutral rules and search pill; labels at 60% ink; steppers only
   in use; the bracket's results coloured; the actions full width and
   taller, sharing the fields' 4px corner. (A flat "standalone page" look
   with the title bar back was tried and reverted, 2026-11-12.)

   Worn by the deck's order entry slides (GustoDeck) and — when the deck
   flags the page it embeds with --ticket-ui — by ChainLoop's copies on
   slide 35's MacBook. The website itself never sees it. */
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
  /* the fields' neutral 8% white, the deck's own slides' value (GustoDeck
     sets it on the frames it embeds) — stated here too so slide 35's
     MacBook copies (ChainLoop) stop falling back to the old teal --chip
     #2c3334 (the user, 2026-11-19); the prefix shares the field's ground */
  ".ob-stage .ob-field{background:rgba(255,255,255,.08)!important}" +
  ".ob-stage .ob-field-k{background:transparent!important}" +
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
  '.ob-stage .ob-cta[data-side="sell"]{--rim:rgba(255,120,100,.68);--body:rgba(205,62,41,.33);--ink:#ed4f3c}' +
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
  ".oc-row:hover,.oc-row[data-lit],.oc-root .oc-row[data-hov]{background:rgba(255,255,255,.05)!important}" +
  // the ticket's end of the same link (a leg hovered, or lit from the
  // chain) in the chain row's grey, not the old teal #272e30 (the user,
  // 2026-11-19: "match on both widgets") — solid, as the lit chain row
  // measures: 5% white reads 2 lighter on the ticket's lighter card top
  ".ob-stage .ob-leg[data-linked]:hover,.ob-stage .ob-leg[data-lit]{background:#1c1c1c!important}" +
  ".oc-menu-list{background:#141414!important}" +
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
  // the ticket's own thin chevrons back for the deck theme's solid
  // triangles, which read heavy beside the text (the user, 2026-11-12)
  ".ob-stage .ob-chevron{background:none!important;clip-path:none!important}" +
  ".ob-stage .ob-chevron path{display:inline!important}" +
  /* the shares mark 13 → 11 (the user, 2026-11-12: it "looks bigger than
     the $"): at 13 its ink stood 11.25 × 12.75 against the $'s 6.5 × 12 —
     a hair taller and nearly twice as wide, so far more area. At 11 it
     sits at the $'s weight */
  ".ob-field-k > svg:not(.ob-chevron){width:11px!important;height:11px!important}" +
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
