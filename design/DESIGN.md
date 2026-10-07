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
- Radius 0 everywhere. No shadows, gradients, glass, pills, grain, icons-as-decoration.
- Sticky header 72px; anchors use `scroll-margin-top: 72px`.

## Components
- Header: white sticky bar, `logo.svg` left, anchor nav (Storia, Orologi, Profumo, Contatti) right; hairline after scroll; mobile menu as modal with focus trap.
- Hero: split, display title + short factual text + `.btn` to #orologi; `img/hero/hero.jpg` eager, high priority.
- StoriaChapter: narrow reading column, optional image, alternating sides on desktop.
- Pillar: text-only blocks between hairlines.
- ModelCard: whole card is a button; product in `well` with `object-fit: contain`, never cropping bezels/bracelets; name serif h3, codes and price small. Equal-cell catalog grid (2/3/4 columns by width).
- ModelDialog: native `<dialog>`; image views, name, codes, price exactly as printed, quote, description, specs list; close button, Esc, backdrop; focus returns to opener; body scroll locked.
- Profumo: N°7 Oud image + source text.
- Contatti: `<address>`, Numero Verde as `tel:` link, social links.
- Footer: white, hairline top, logo mark, GRANALIDA s.r.l., nav repeat.

## States
- Focus-visible: 2px ink outline, 3px offset, on every interactive element.
- Hover (fine pointers only): `.btn` inverts to ink fill; `.link-arrow` underline darkens, arrow shifts 4px; cards: image scales ≤1.02.
- Active: 1px press. Disabled: not used.
- Images: explicit width/height from `public/img/manifest.json`, WebP with JPG fallback, lazy below the fold.

## Motion
- Ease `cubic-bezier(.16,1,.3,1)`, 500ms. Reveal: opacity 0→1 + 8px rise, `.reveal` + `.is-visible` toggled by IntersectionObserver, once.
- `prefers-reduced-motion: reduce` disables reveals, smooth scroll and transitions.
- No parallax, loops, scroll-jacking, smooth-scroll libraries.

## Prohibitions
Dark mode or dark sections; stock/generated imagery; invented facts, prices, dates, names, specs or testimonials; rounded corners; shadows; gradients; emoji; carousels with autoplay.

## Content rules
- All text Italian, transcribed exactly from the sources (catalogue, price card, old site). Unreadable = `[illeggibile]`.
- Prices exactly as printed (e.g. `3.890 EUR`).
- All copy lives in `src/data/content.ts`; components hold no copy beyond UI labels.
