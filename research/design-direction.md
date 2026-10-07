# ZITO 1950: design direction

Research recommendation, not website implementation. All values below are proposed design decisions unless explicitly described as observed source conventions.

## 1. Direction and source precedence

Reading this as an Italian family watch/jewelry showcase: quiet, white, editorial and product-led, not an e-commerce template or a cinematic agency demo.

- Dials: `DESIGN_VARIANCE: 5`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 2`.
- Pure-white canvas throughout. Black/dark-gray typography; natural product photography supplies color. No dark-mode toggle, inverted footer or colored section washes.
- Brochure/journal photos are the factual source of truth; the old ZITO site is secondary. References inform composition only, never brand facts or copy.
- Transcribe Italian exactly, preserving original spelling. Unreadable source text is `[illeggibile]`; never complete it from context.
- No invented dates, family names, testimonials, prices, specifications, provenance or manufacturing claims. The brand name does not by itself establish a founding-date claim.
- Preserve the actual logo. Do not redraw it using the proposed display font.
- Audit existing page names, URLs and contact routes before deciding new information architecture. Do not silently discard legacy `.html` URLs; document their destination/redirect mapping.

## 2. Applicable skill rules and conflict resolution

Sources: `.agents/skills/{minimalist-ui,high-end-visual-design,design-taste-frontend,stitch-design-taste,redesign-existing-projects}/SKILL.md`; `stitch-design-taste/DESIGN.md`; `emil-design-eng/SKILL.md` resolves to `/home/dmitriy/.agents/skills/emil-design-eng/SKILL.md`.

| Source | Adopt for ZITO | Explicitly reject here |
|---|---|---|
| minimalist-ui | Macro-whitespace, charcoal body text, serif/sans hierarchy, flat surfaces, sparse dividers | SaaS bento boxes, pastel badges, placeholder photos, ambient gradients |
| high-end-visual-design | Optical spacing, editorial split, responsive grid, careful easing/performance | Double-bezel cards, pill islands, magnetic buttons, glass overlays, theatrical blur reveals |
| design-taste-frontend | Read the brief first; one theme/palette/shape system; real imagery; cards only with a purpose; motivated motion | Default beige/brass luxury palette, generated product imagery, oversized headings, decorative metadata |
| emil-design-eng | Ask whether animation is useful; fast press feedback; explicit transition properties; hover gated to fine pointers | Gesture physics and ornamental effects that add no explanatory value |
| stitch-design-taste | Semantic DESIGN.md with precise roles, typography, responsive rules, states and prohibitions | Perpetual loops, inline photos between headline words, dashboard micro-animation assumptions |
| redesign-existing-projects | Audit content/IA first, preserve identity and working paths, improve typography/spacing before adding effects | Overlaps, smooth-scroll inertia, parallax stacks, fictional “realistic” names/data |

The brief overrides conflicting examples: white remains `#FFFFFF`; heritage justifies a chosen serif; no stock/generated substitute for authentic ZITO pieces; exact source transcription overrides stylistic copy-rewriting rules. Luxury comes from image quality, rhythm and hierarchy, not nested shells or spectacle.

## 3. Typography and palette

### Exact font packages

- Display: **EB Garamond**, `@fontsource/eb-garamond`, regular 400 and medium 500. Use italic only when meaningful, not as an automatic final-word flourish.
- Body/navigation/controls: **Manrope Variable**, `@fontsource-variable/manrope`, predominantly 400/500; 600 for small functional emphasis.
- This pairing is a design recommendation, not a claim about existing ZITO brand fonts. EB Garamond brings sober book-like heritage; Manrope keeps Italian body copy and controls clear without duplicating the sibling’s Cormorant/Jost identity.
- Self-host via Fontsource, load only used weights/subsets, `font-display: swap`, `font-synthesis: none`. No production Google Fonts link.
- Package names and availability confirmed in the npm registry; both packages currently expose version 5.3.0 and OFL-1.1 licensing. Preserve licenses.
- Font evidence: [EB Garamond](https://fontsource.org/fonts/eb-garamond), [Manrope](https://fontsource.org/fonts/manrope), [serif npm metadata](https://registry.npmjs.org/@fontsource/eb-garamond/latest), [sans npm metadata](https://registry.npmjs.org/@fontsource-variable/manrope/latest).

| Role | Proposed size / leading | Rules |
|---|---|---|
| H1 | `clamp(2.75rem, 1.9rem + 3vw, 5rem)` / 1.1 | EB Garamond 400/500, tracking -0.02em; usually ≤2 desktop lines |
| H2 | `clamp(2rem, 1.5rem + 2vw, 3.5rem)` / 1.15 | Same display family; balanced wrapping |
| H3/product name | 24-30px / 1.25 | No giant product-code headings |
| Body | 17px / 28px | Manrope 400; minimum 16px on mobile; ≤60ch |
| Navigation/button | 14-15px / 20px | Manrope 500; legible, not excessively letterspaced |
| Caption | 14px / 21px | Secondary ink, never barely visible gray |
| Occasional eyebrow | 12px / 18px | Tracking +0.1em; at most one per three sections |

Keep italic descenders clear. Use `text-wrap: balance` for headings and `pretty` for paragraphs. Do not cut factual source prose merely to meet a decorative line limit; move longer source text below the hero or onto its relevant page.

| Token | Value | Purpose |
|---|---|---|
| `color.surface.canvas` | `#FFFFFF` | All page surfaces, including footer |
| `color.text.primary` | `#111111` | Titles/body, logo-compatible ink |
| `color.text.secondary` | `#555555` | Supporting prose/captions |
| `color.action.primary` | `#111111` | Primary controls and links |
| `color.action.hover` | `#333333` | Subtle hover change |
| `color.border.subtle` | `#EAEAEA` | Sparse structural dividers, not essential control boundaries |
| `color.focus` | `#111111` | Visible 2px outline, 3px offset |

No accent hue is required. Do not claim measured contrast until checked; future implementation must meet WCAG AA (4.5:1 normal text, 3:1 large text and necessary control indicators).

## 4. Space, geometry and image treatment

- Shared space scale: **4, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128px**.
- Content container: 1240px; outer gutter `clamp(1.25rem, 4vw, 4rem)`.
- Section padding: `clamp(3.5rem, 8vw, 8rem)`; hero desktop top padding ≤96px. Prefer useful content over forced full-screen sections.
- Editorial desktop grid: 12 columns, 24-40px gutter. Image-led split hero, a narrower history reading column, then a calm collection/product grid; avoid repeating the same split section three times.
- Below 768px: editorial splits become one column, natural reading order, image retained below text; no horizontal page overflow.
- Product indices may use repeated equal cells because they represent an actual catalog, not a generic three-feature-card marketing row. Choose columns based on readable piece size, not an anti-template quota.
- Sharp images and panels (`radius: 0`), controls 2px maximum. No pills, arches, sparkles, decorative crosshairs, grain overlays or shadows.
- Actual ZITO photography only. Retain metal/gem colors; no blanket desaturation or warmth filter. Product crops must not cut bezels, bracelets or identifying details; use `object-fit: contain` for isolated pieces.
- Show uncropped source images in a detail view when appropriate. Do not assume every photographed brochure page is already a clean website product image.
- Responsive WebP/AVIF derivatives, explicit dimensions, useful `sizes`/`srcset`; eager/high-priority loading only for the principal above-fold image, lazy below-fold loading.
- Do not hotlink borrowed reference-site images. Keep source filename/page provenance alongside asset/content data.

## 5. Motion and accessibility

- Native scroll. **No heavy parallax, scroll hijacking, pinned storytelling, Lenis, custom cursor, marquees, perpetual loops, 3D/WebGL or entrance curtain.**
- Main content and hero readable immediately. Optional one-time section reveal only where it helps reading order: opacity plus ≤8px Y travel, 400-600ms, `cubic-bezier(.16,1,.3,1)`, short 40-60ms stagger capped to avoid delayed access.
- Button press: scale 0.98, 100-140ms; menu state change: 180-240ms; optional image/detail crossfade: 180-220ms.
- Use CSS transitions for ordinary controls; enumerate properties, never `transition: all`. Translate/opacity are the default motion properties; no animated layout dimensions or large blur filters.
- Gate hover movement behind `(hover: hover) and (pointer: fine)`. Keyboard focus and keyboard navigation must be immediate.
- `prefers-reduced-motion: reduce`: no translation/scale, stagger, autoplay or smooth anchor scroll; content visible immediately; opacity-only transitions ≤150ms if useful.
- Hidden reveal states must be applied only when JS successfully initializes. No animation-dependent access to content.
- If GSAP is retained to satisfy the workspace motion convention, use one scoped context per animated section with cleanup and reduced-motion matchMedia. No ScrollTrigger merely for spectacle; IntersectionObserver is sufficient for simple reveals.
- Semantic landmarks, skip link, logical heading order, real anchors, visible focus, 44px minimum targets. Navigation needs active/current indication and a functional mobile-menu label.
- If a lightbox is included: native modal dialog, Esc, focus restoration, accessible previous/next controls, uncropped photo, no keyboard-delay animation.
- No fake forms or dead `href="#"` controls. Only add contact routes supported by source evidence; do not invent WhatsApp availability.

## 6. Reference sites: borrow the principle, not the brand

1. **Patek Philippe**: https://www.patek.com/en/ . Observed official site separates manufacture/family narrative, handcraft imagery, collections and service. Borrow the clear hierarchy and evidence-led family story, not its claims, videos or campaign scale. Its official metadata identifies it as family-owned.
2. **Chopard**: https://www.chopard.com/en-intl . Observed watch/jewelry universes and isolated front/back/side product images. Borrow generous visual presentation and clear separation of watches and jewelry. Do not copy shopping, wishlist or geolocation overlays; family ownership was not verified in the fetched page.
3. **Buccellati**: https://www.buccellati.com/ . Observed Italian-craft positioning, named collections and separate watches/jewelry/silver categories. Borrow collection-first editorial organization and craft-detail imagery; reject storefront density, account/bag features and external claims. Current ownership is not established by this research.
4. **Bulgari Eclettica**: https://www.awwwards.com/sites/bulgari-eclettica . Awwwards describes an editorial-print narrative extended online; viewed its campaign screenshot. Borrow one strong close-up and a disciplined title hierarchy. Explicitly reject the documented horizontal-scroll/parallax behavior and beige palette.
5. **Cartier Watches and Wonders 2023**: https://www.awwwards.com/sites/cartier-watches-and-wonders . Viewed the award screenshot; the listing documents six model-specific universes. Borrow focused model storytelling and sparse navigation, not blue immersive scenery, 3D/360 or film-dependent interaction.

These are reference selections, not a claim that all five are currently family-owned or pure-white. [UNKNOWN] Live interaction behavior was not browser-tested. Siteinspire’s jewelry listing was found at https://www.siteinspire.com/website/6306-nikos-koulis-jewels but returned HTTP 429; do not present it as a visually audited reference.

## 7. AI-ready pillars and deliverables

Source: https://www.designsystems.one/ai-ready#pillars . Full body recovered using its rendered-text endpoint after the normal reader returned only navigation.

1. **Machine-readable tokens**: typed DTCG/W3C token file, semantic intent layered over primitives, descriptions explaining usage. Components use named tokens, not arbitrary literal values.
2. **MCP query surface**: expose tokens, components, patterns and decisions so compatible agents can ask at edit time. The source names `list-tokens`, `find-component`, `get-pattern` and readable catalogs/contracts/decisions.
3. **Component contracts**: TypeScript-first, constrained variants/discriminated unions, exact APIs and machine-readable examples; registry distribution and type-checked MDX examples where a reusable library warrants them.

The source explicitly says the full three-pillar stack includes MCP. Static files alone are useful and discoverable, but are not an implemented MCP service or proof of full three-pillar readiness.

### Files to ship with the later website implementation

- `design/DESIGN.md`: binding atmosphere, palette roles, type, spacing, layout, component states, motion/reduced motion and prohibitions.
- `design/zito.tokens.json`: typed semantic tokens (`$type`, `$value`, `$description`, references), kept consistent with CSS.
- `design/components.json`: actual component names, exports/source paths, exact props, behavior, accessibility and valid examples. Document implemented components, not aspirational ones.
- `design/patterns.md`: a few real TSX composition examples and responsive rules; no duplicated whole component library.
- `public/llms.txt`: concise site summary using verified facts, links to actual pages and deployed design files. No private notes or speculative history.
- `AGENTS.md`: source precedence, transcription/provenance rules, file map, commands and change discipline. Add `CLAUDE.md` only as a small pointer if that client is used.
- `README.md` and `CHANGELOG.md`: maintenance/deployment instructions and real implementation history.
- Public build: copy `design/*` into `dist/design/`; serve Markdown as Markdown/text and JSON as JSON, not SPA HTML.
- MCP: document current status honestly. Only ship `.mcp.json` and a server when there is a functioning, configured query surface. Never include a fake endpoint merely to claim readiness.
- Optional `llms-full.txt`/registry/MDX: add only if the content/library size warrants them; not mandatory duplicate paperwork for this small showcase.

Tools catalog: https://www.designsystems.one/tools . Relevant options are Token Generator, Grid Builder, Accessibility Checklist, Token Diff and Agent-Ready Check; Website→design.md can aid inspection but cannot override source truth. ROI/release tooling is not a launch dependency.

## 8. Established fmbomboniere conventions to reuse

Observed `fmbomboniere/package.json`: Vite 8.3.2, React/React DOM 19.2.8, TypeScript 6.0.2, Tailwind 4.3.3 with `@tailwindcss/vite`, GSAP 3.15.0; Lenis 1.3.26 is present but not recommended for ZITO.

- Keep a static Vite/React/TypeScript build rather than introducing Next.js/server infrastructure for the showcase. Reuse Tailwind v4 integration, npm lockfile and self-hosted Fontsource practice.
- `src/main.tsx` bootstraps; `src/App.tsx` composes sections and owns only shared UI state.
- `src/components/` holds section components and small shared UI helpers; `src/data.ts` plus `src/data/*.json` separates verified content/photo data from view code.
- `src/index.css` holds `@theme` tokens, type classes and shared controls; `src/motion.ts` centralizes only the motion actually needed.
- `public/` contains logo/favicon/manifest, optimized assets and `llms.txt`; `design/` contains the three public design documents.
- The sibling has `src/i18n.tsx` for IT/EN. ZITO is Italian: reuse central copy separation, not an unsupported translation toggle or language-persistence layer.
- Reuse accessible dialog/menu principles, explicit image dimensions, reduced-motion initialization and real anchor contact links, not business-specific copy/assets.
- `vite.config.ts` uses `VITE_BASE` for deployment path and `VITE_SITE_URL` for absolute canonical/OG URLs; its plugin substitutes `%SITE_URL%`, emits robots/sitemap and publishes design documents.
- Adapt brand filenames, plugin name, URL, site data and every hardcoded FM reference. Do not copy the sibling’s GitHub Pages canonical default into ZITO.

### Deployment files

- `.github/workflows/pages.yml`: Node 24, `npm ci`, build, Pages artifact/deployment; derive repository base path and set ZITO’s actual public URL.
- `Dockerfile`: multi-stage Node 24 Alpine build → nginx static serving; `nginx.conf`; `docker-compose.yml` exposes container 80 on host 8080.
- `deploy/ionos.htaccess`: disables listings, denies hidden/service files, supplies Markdown/plain-text MIME and no-cache HTML/JSON headers. Upload renamed `.htaccess` alongside `dist/` only for Apache hosting.
- Builds use `/repo/` for Pages, `/` for dedicated hosting, or `./` for portable upload. `VITE_SITE_URL` must reflect the deployed domain; no guessed production destination.
- Hosting gotcha: sibling nginx falls back unknown URLs to `index.html`, so it is not a branded 404 implementation. Its `/img/` files receive immutable caching even though image filenames are not inherently hashed; use versioned asset names or appropriate cache policy for replaceable photos.

### Observed documentation drift: do not blindly clone

`fmbomboniere/design/components.json` says Gallery uses dense flow and landscape tiles spanning two columns. Actual `src/components/Gallery.tsx` renders uniform 4:5 cells in 2/3/4-column grids without that spanning behavior, matching the newer DESIGN.md/README. Reuse the actual source behavior and keep ZITO’s component contracts synchronized with it.

## 9. Supplemental material and research limits

- Read `design-systems/designsystems.md`, `great-websites-examples/examples.md` and all three `useful-materials/*.md` files; fetched their named catalog/material URLs.
- Design-system catalog https://www.designsystems.one/design-systems describes Radix as unstyled accessible components. Borrow accessibility/token-role discipline, not a product-dashboard visual skin; a bespoke editorial aesthetic is not an official “luxury design system.”
- https://tympanus.net/codrops/hub/ contains many GSAP/WebGL experiments. Its menus/reveals are learning references only; most effects are out of scope.
- https://docs.pmnd.rs/ documents its MCP setup and 3D/state libraries; https://pmnd.rs/ returned a sparse feed. No library or MCP installation was performed.
- https://github.com/ahujasid/mcp-for-blender documents a third-party Blender integration. No Blender/3D asset generation is needed, and generated watch geometry must not replace authentic pieces.
- Read all six requested SKILL.md texts and the referenced Stitch DESIGN.md. The taste skill’s block-directory tree is described as an iterative schema, not evidence of implemented blocks.
- Research only: no website code, builds, linters, formatters or deployment checks were run.

## 10. Catalog references browsed (orchestrator, headless Chromium)

- Catalogs opened: https://www.siteofsites.co/, https://www.siteinspire.com/websites?categories=minimal, https://www.awwwards.com/websites/fashion/.
- https://maisonlesgrandschenes.com/ (Siteinspire: Luxury/Minimal, "maison d'hôte familiale"): centered wordmark under a thin top nav, full-width hairline rule, tiny uppercase eyebrow labels ("LA MAISON"), EB Garamond-style serif headings, text column left + staggered offset images right, quiet text link with arrow ("Découvrir la maison →"). Borrow: hairline rules, eyebrow labels, offset image pairs, text-link CTAs. Reject: beige canvas (ZITO stays #FFFFFF).
- https://www.odysseeclinic.com.au/ (Site of Sites): single serif wordmark + one-line claim on a full-bleed photo, minimal chrome. Borrow: restraint of a hero with one sentence. Reject: low-contrast text over images.
