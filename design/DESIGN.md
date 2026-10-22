# ZITO1950 · Design system (binding)

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
- Brand inscriptions `ZITO1950®`: `TeX Gyre Adventor` regular 400, +.02em tracking (`font-brand`), an Avant-Garde-style geometric sans. Regular and bold 700 are self-hosted as Latin WOFF2 subsets under `src/assets/fonts/`, licensed under the GUST Font License; use regular for the logo’s thin-stroke character. Prose mentioning the brand keeps its surrounding typeface.
- Scale: display `clamp(2.5rem,5vw,4.5rem)`/1.08 · h2 `clamp(2rem,3.6vw,3rem)`/1.15 · h3 1.5rem/1.25 · body 1.0625rem/1.7 (≤60ch) · small .875rem/1.5 · eyebrow .75rem uppercase +.18em (max one per three sections).
- Headings `text-wrap: balance`, paragraphs `pretty`. The text inscriptions use the brand font; the logo artwork remains `logo.svg` (Header/Footer), never reconstructed as text.

## Layout
- Container 1240px, gutter `clamp(1.25rem,4vw,4rem)`, section padding `clamp(3.5rem,8vw,8rem)`.
- Spacing scale 4, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128px.
- 12-column editorial grid on desktop; below 768px one column, natural reading order, no horizontal overflow.
- Sections flow on the white page, separated by a 1px `line` hairline top border; no card shells. Photos radius 1.25rem; no shadows, gradients, glass or grain. Buttons and the three links under the hero are fully rounded. Line icons only on functional controls (cart, the links under the hero, footer social links).
- Sticky header 72px; anchors use `scroll-margin-top: 72px`.
- Section order follows the numbered sections of the client's layout (`public/img/newphotos/new_layout.jpeg`): Hero → three links (La nostra storia `#storia`, Collezione limitata `#edizioni-limitate`, Perché Zito? `#perche-zito`) → Storia (`#storia`) → Orologi (`#orologi`) → Profumi (`#profumi`) → Officina (`#officina`) → Territorio (`#territorio`) → Perché Zito (`#perche-zito`) → Dove siamo (`#contatti`). No Social or Scalea section.
- Expandable sections (`Panel`): a short preview is always visible; one “more” button (“Scopri la storia”, “Scopri il laboratorio”, default “Mostra tutto”), centred at the bottom of the section on every viewport (after the preview while closed, after the body while open), opens the rest with a short fade; no toggle in the section header. Closing keeps the button at the same place on screen, so the reader stays at the end of the collapsed section instead of jumping to its top. Body `hidden` while closed so it adds no height; sections without extra content (Territorio, Perché Zito) have no toggle. Links into a closed body (e.g. `#edizioni-limitate`) open it, update the hash and scroll once after rendering.
- Split sections (Storia, Officina): photo on the left, text column on the right (vertically centred) holding the brand-red eyebrow, the serif h2 (max 14ch, balanced), the copy and the closed toggle; stacked on mobile with the photo on top. Officina splits 7/12 photo, 5/12 text. Storia uses a two-column 5fr/7fr grid (gap 4rem, 6rem from `lg`; a two-track grid so the gap is applied once) and shows the portrait archive poster (`new_history_photo.jpeg`, 533×800) whole, capped at 460px so it is never upscaled far, with the same 1.25rem rounded corners and muted caption below as the other photos. The split toggle is a fully rounded pill with a 1px `brand` (#d42e2e, the logo red) outline and `brand` uppercase tracked text plus “→”, filling `brand` with white text on hover; when open, the “Mostra meno” toggle sits centred under the body.
- Perfume photos share one square 856×856 canvas, cropped to the products with the same window, so the bottle and the box keep their relative size and baseline with no empty band above them.
- Orologi “Catalogo completo”: after opening, the page scrolls instantly so the catalogue's second row sits just under the sticky header.

## Components
- Header: white sticky bar, `logo.svg` left, anchor nav (Storia, Orologi, Profumi, Officina, Territorio, Contatti) right; functional outline-SVG shopping-bag button opens Cart, square ink count badge when non-empty; no floating cart button; hairline after scroll; mobile menu as modal with focus trap.
- Hero: the admin-configurable `catalog.hero` photo is itself a link to `#orologi` (image scales ≤1.02 on hover); beside it h1 “ZITO1950”, the motto “Officine del tempo” in small uppercase tracking, a short ink rule, the serif lead “Dal 1950, una storia italiana.”, short text and one rounded ink button “Scopri la collezione” (`#orologi`).
- SectionButtons: the three links under the hero in a hairline-divided row (stacked on mobile); each has a round outlined line icon (shield, star, cut stone) that fills ink on hover, a serif uppercase label and a muted one-line hint.
- Orologi: closed shows 3–4 watches from admin `catalog.featured` (fallback: first 4 of the featured sort); “Catalogo completo” opens filters and the full grid; exclude `hidden`; featured sort puts `isNew` first, then `buy`, `no-buy`, `out-of-stock`, price descending within each group.
- Officina: owner photo `img/storia/owner.jpg` with craft text; the “Assistenza” button opens the movement/material notes.
- Brand: always `ZITO1950®` (uppercase, no space between ZITO and 1950, ® right after 1950); in the display-size hero h1 the ® is a 0.32em superscript. Surnames (Luigi Zito…) and verbatim quotes (the handwritten «a Zito 1950» dedication) stay as written.
- Catalog search: `type=search` pill (rounded-full hairline, 44px, magnifier icon) before the filters button, full width on mobile and 18rem from `sm`; live, accent/punctuation-insensitive match on the model name; Esc and “Azzera filtri” clear it.
- Filters: outlined “Filtri e ordinamento” button with ink count badge, result count, “Azzera filtri” and removable outlined chips. Native `<dialog>` side sheet, 420px from the right on desktop, full screen on mobile; first the Linea group (Uomo, Donna; unisex models match both), then sort radios, then checkbox groups (Selezione, Disponibilità, Movimento, Funzioni, Cassa, Prezzo) with tabular live counts; zero-count options muted and disabled. `#edizioni-limitate` applies only the limited-edition filter.
- ModelCard: image and detail controls open ModelDialog at the selected variant/photo; product `object-fit: contain`, never cropping bezels/bracelets; name serif h3, codes small, price sans. Purchase control only for `availability: buy`.
- Badge/labels: “Nuovo” and “Edizione limitata” at the image’s top-left corner, ink fill, white uppercase small type with tracking, radius 0; “Venduto” / “Esaurito” status tags outlined. Limited editions with positive `piecesRemaining` show “Ancora N pezzi” or “Ultimo pezzo disponibile”; empty or 0 shows no count.
- ModelDialog: native `<dialog>`; image views, name, codes, price, labels (plus an outlined Uomo / Donna / Unisex tag, sr-only “Linea:”), remaining pieces, quote, description, specs list; close button, Esc, backdrop; focus returns to opener; body scroll locked.
- Recommended: “Scopri anche” inside ModelDialog, every other public model in one horizontal row: owner’s `similar` picks first, then by similarity. Square outlined prev/next buttons page by whole cards; wheel scrolls the row and releases at its ends. Selection replaces the current model in the open dialog, resets variant/photo, scrolls to top and focuses its title.
- Profumi: `#profumi`, public `catalog.perfumes` as vertical cards in a grid, 2 per row from 640px up and stacked below: photo on top in a white `aspect-[4/5]` frame (`object-contain`, radius 1.25rem), then eyebrow, serif name, optional italic line (e.g. “Pepe Nero”), code, price, opening text and specs, with the action pinned to the card bottom so actions align across the row. Expanded shows each perfume's quote, full description and ingredients. Admin availability sets the action: `buy` (Acquistabile) an “Acquista” button adding it to the cart; `no-buy` (Solo vetrina) the information-request button; `coming-soon` (Prossimamente) a “Prossimamente” eyebrow and full text, with no code, price, quote or button and nothing in the expanded part; `out-of-stock` (Esaurito) an “Esaurito” tag, muted price and no button; `hidden` (Nascosto) omitted. Tesoro di Alarico (line “Pepe Nero”, box photo `img/profumo/coming-soon.jpg`) is seeded as `coming-soon`. The section is omitted when no perfume is public.
- Storia: `#storia`, archive photo `img/storia/storia-nuova.jpg` beside the 1951 railway intro, cropped (`object-cover`) to `min(26rem,55vh)` tall on desktop and 60vw on mobile so the closed section stays compact; “Scopri la storia” opens every chronological chapter and the closing quote; chapter images alternate sides on desktop.
- Territorio: `#territorio`, eyebrow “Scopri il territorio”, title “Scalea. Dove la bellezza incontra il tempo.”, text and serif closing line on the left, `img/storia/scalea-mare.jpg` on the right, held sticky on desktop; not expandable.
- Perché Zito: `#perche-zito`, “Perché scegliere ZITO1950®”, italic serif lead beside the reasons and the serif brand line; not expandable.
- Contatti: “Dove siamo” at `#contatti`; only the map, centred (max 56rem, 4:3 on mobile, 16:9 from `sm`), with the email customer@zito1950.it as a `mailto:` row centred under it. No postal address, company or P.IVA in the section, footer or metadata; the address stays in data only as the map query.
- Cart: opened from Header; native `<dialog>` with watch and perfume lines, quantities, total and PayPal checkout. Each line has two collapsible optional sections: “Certificato della proprietà e garanzia” (certificate front/back thumbnails, Nome, Cognome, Email, all required once one is filled) and “Incisione” (textarea, n/10 parole counter, 120 chars; when filled a bordered notice states the item is personalized and not returnable, with a required acknowledgement checkbox). Personalized lines lock quantity to 1. “Paga con PayPal” stays disabled while a section is incomplete, and always in the GitHub Pages preview (with a note).
- Order page (`/ordine/<token>`): eyebrow “Il tuo ordine”, current status as serif title, five-step ordered status track (vertical on mobile, five columns from `md`, `aria-current="step"`), items with photo, codes, price, certificate and engraving, total, contact email.
- Emails: 600px table layout on white, logo header, serif heading, message, ink pill button “Vai all’ordine”, items with photo, certificate and engraving, total, footer with logo, motto, Instagram/Facebook icons and email (`src/lib/orderEmail.ts`).
- Footer: white, hairline top, per the mockup: `logo.svg` with the motto “Officine del tempo”; columns “Il marchio” (La nostra storia, Il laboratorio, La Calabria, I profumi), “Assistenza” (Catalogo completo, Contatti) and “Social” (Instagram and Facebook round line-icon links, new tab); bottom hairline row with the copyright and “Design italiano · Calabria · Dal 1950”. Instagram and Facebook appear only here.

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
Dark mode or dark sections; stock/generated imagery; invented facts, prices, dates, names, specs or testimonials; shadows; gradients; emoji; carousels with autoplay.

## Content rules
- Italian source facts come from the catalogue, price card and old site; interface microcopy is separate. Unreadable = `[illeggibile]`. Localized copy must preserve the facts.
- Seed prices exactly as printed (e.g. `3.890 EUR`); published catalog prices come from the administrator.
- Source copy lives in `src/data/content.ts`, bundled translations in `src/data/translations.json`, editable product copy and prices in the catalog. Components hold no copy beyond UI labels.
