# ZITO 1950 · Design system (binding)

Tokens: `design/zito.tokens.json` (mirrored in `src/styles/index.css` `@theme`). Components: `design/components.json`. Background research: `research/design-direction.md`.

## Atmosphere
Quiet Italian family catalogue on paper-white. Editorial, product-led, sober. Luxury comes from real photography, rhythm and hierarchy, never from effects. Variance 5 · motion 3 · density 2.

## Palette
| Token | Hex | Role |
|---|---|---|
| bg | #FFFFFF | Every surface, footer included. No dark sections, no colored washes. |
| ink | #141414 | Titles, body, controls, focus ring, logo. |
| ink-2 | #3A3A3A | Secondary prose. |
| muted | #6B6B6B | Captions/meta only (5.33:1 on white, AA). |
| line | #E7E7E5 | Hairline dividers (1px). |
| well | #F5F5F3 | Image wells behind isolated products. |
No accent hue. Color comes from the photographs.

## Typography
- Serif `EB Garamond` 400/500 (italic only when meaningful) for headings, model names, quotes.
- Sans `Manrope Variable` 400/500/600 for body, nav, controls.
- Scale: display `clamp(2.5rem,5vw,4.5rem)`/1.08 · h2 `clamp(2rem,3.6vw,3rem)`/1.15 · h3 1.5rem/1.25 · body 1.0625rem/1.7 (≤60ch) · small .875rem/1.5 · eyebrow .75rem uppercase +.18em (max one per three sections).
- Headings `text-wrap: balance`, paragraphs `pretty`. Never redraw the logo in a font: use `logo.svg`.

## Layout
- Container 1240px, gutter `clamp(1.25rem,4vw,4rem)`, section padding `clamp(3.5rem,8vw,8rem)`.
- Spacing scale 4, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128px.
- 12-column editorial grid on desktop; below 768px one column, natural reading order, no horizontal overflow.
- Radius 0 everywhere. No shadows, gradients, glass, pills, grain, icons-as-decoration. Functional control icons (cart) are allowed.
- Sticky header 72px; anchors use `scroll-margin-top: 72px`.
- Section order: Hero → Orologi (`#orologi`) → Profumi (`#profumi`) → Storia (`#storia`) → Social (`#social`) → Dove siamo (`#contatti`).

## Components
- Header: white sticky bar, `logo.svg` left, anchor nav (Orologi, Profumi, Storia, Social, Dove siamo) right; functional outline-SVG shopping-bag button opens Cart, square ink count badge when non-empty; no floating cart button; hairline after scroll; mobile menu as modal with focus trap.
- Hero: uncropped product photo from admin-configurable `catalog.hero`, default `img/models/tutus-ab-uno.jpg`, eager, high priority; display h1 “Orologiai a Scalea dal 1950” + short factual text. Three `.btn` links: primary ink-filled “Scopri la storia” (`#storia`), secondary outlined “Edizioni limitate” (`#edizioni-limitate`) and “Social” (`#social`).
- Orologi: text-only pillars between hairlines, then equal-cell catalog grid (2/3 columns by width); exclude `hidden`; featured sort puts `isNew` first, then `buy`, `no-buy`, `out-of-stock`, `sold`, price descending within each group.
- Filters: outlined “Filtri e ordinamento” button with ink count badge, result count, “Azzera filtri” and removable outlined chips. Native `<dialog>` side sheet, 420px from the right on desktop, full screen on mobile; sort radios, then checkbox groups (Selezione, Disponibilità, Movimento, Funzioni, Cassa, Prezzo) with tabular live counts; zero-count options muted and disabled. `#edizioni-limitate` applies only the limited-edition filter.
- ModelCard: image and detail controls open ModelDialog at the selected variant/photo; product `object-fit: contain`, never cropping bezels/bracelets; name serif h3, codes small, price sans. Purchase control only for `availability: buy`.
- Badge/labels: “Nuovo” and “Edizione limitata” at the image’s top-left corner, ink fill, white uppercase small type with tracking, radius 0; “Venduto” / “Esaurito” status tags outlined. Limited editions with positive `piecesRemaining` show “Ancora N pezzi” or “Ultimo pezzo disponibile”; empty or 0 shows no count.
- ModelDialog: native `<dialog>`; image views, name, codes, price, labels, remaining pieces, quote, description, specs list; close button, Esc, backdrop; focus returns to opener; body scroll locked.
- Recommended: “Scopri anche” inside ModelDialog, every other public model in one horizontal row: owner’s `similar` picks first, then by similarity. Square outlined prev/next buttons page by whole cards; wheel scrolls the row and releases at its ends. Selection replaces the current model in the open dialog, resets variant/photo, scrolls to top and focuses its title.
- Profumi: `#profumi`, N°7 Oud image + source text.
- Storia: `#storia`, opening place block “Scalea e la Calabria” with real photographs `img/storia/scalea-borgo.jpg` and `img/storia/scalea-palazzo.jpg`, then chronological chapters; narrow reading columns, optional chapter images alternating sides on desktop.
- Social: `#social`, Instagram and Facebook as full-width link rows, separated by hairlines; no embedded feed.
- Contatti: “Dove siamo” at `#contatti`; `<address>`, map and Google Maps link, PEC as `mailto:`, P.IVA; no phone or social rows.
- Cart: opened from Header; native `<dialog>` with quantities, total and PayPal checkout. “Certificato personalizzato” toggle reveals required Nome, Cognome, Email; off uses PayPal payer name/email from capture. The owner assigns the certificate code in Admin → Ordini.
- Footer: white, hairline top, logo mark, GRANALIDA s.r.l., nav repeat.

## States
- Focus-visible: 2px ink outline, 3px offset, on every interactive element.
- Hover (fine pointers only): `.btn` inverts to ink fill; `.link-arrow` underline darkens, arrow shifts 4px; cards: image scales ≤1.02.
- Active: 1px press. Disabled: checkout controls while busy or unavailable.
- Images: explicit width/height from `public/img/manifest.json`, WebP with JPG fallback, lazy below the fold.

## Motion
- Ease `cubic-bezier(.16,1,.3,1)`, 500ms. Reveal: opacity 0→1 + 8px rise, `.reveal` + `.is-visible` toggled by IntersectionObserver, once.
- `prefers-reduced-motion: reduce` disables reveals, smooth scroll and transitions.
- No parallax, loops, scroll-jacking, smooth-scroll libraries.

## Prohibitions
Dark mode or dark sections; stock/generated imagery; invented facts, prices, dates, names, specs or testimonials; rounded corners; shadows; gradients; emoji; carousels with autoplay.

## Content rules
- Italian source facts come from the catalogue, price card and old site; interface microcopy is separate. Unreadable = `[illeggibile]`. Localized copy must preserve the facts.
- Seed prices exactly as printed (e.g. `3.890 EUR`); published catalog prices come from the administrator.
- Source copy lives in `src/data/content.ts`, bundled translations in `src/data/translations.json`, editable product copy and prices in the catalog. Components hold no copy beyond UI labels.
