# ZITO 1950: implementation plan

Sources (precedence): journal photos `journal_photos/` (facts, models, prices card = photo …355) > old site zito1950.it (professional product photos, storia, contacts) > nothing else.
Research: `research/journal-a.md`, `research/journal-b.md`, `research/old-site.md`, `research/design-direction.md`.

## Decisions
- One-page site, sections in this order: Home (hero) → Storia → Orologi (intro + catalogo) → Profumi → Contatti. Sticky header with anchor nav; no separate catalog page.
- Stack (house convention, from fmbomboniere): Vite 8 + React 19 + TS 6 + Tailwind 4, fonts `@fontsource/eb-garamond` + `@fontsource-variable/manrope`. No Lenis, no parallax; GSAP not needed: CSS/IntersectionObserver reveals (opacity + ≤8px), reduced-motion respected.
- Pure white `#FFFFFF`, ink `#111`, gray `#5B5B5B`, hairline `#E6E6E6`, surface `#F6F6F5` (image wells only). Logo red only inside the logo.
- Contacts: Scalea (CS), via Michele Bianchi 23 (GRANALIDA s.r.l.), Numero Verde 800 58 67 08 (journal back cover), PEC granalida@pec.it, Instagram @zito1950lifestyle, Facebook zito1950, Google Maps link to the address. No WhatsApp/email (not provided by client). Per-model "Richiedi informazioni" = `mailto:granalida@pec.it?subject=Richiesta informazioni – <modello>`.
- Deploy: GitHub Pages via Actions (`VITE_BASE=/zito1950/`), plus Dockerfile/nginx/docker-compose and `deploy/` for later hosting with `VITE_BASE=/`.
- AI-ready: `design/DESIGN.md`, `design/zito.tokens.json`, `design/components.json`, `public/llms.txt`.

## Phases
1. Parallel: Assets (logo SVG, favicons, product + heritage images, manifest) · Content (verbatim data module) · Scaffold + design system + deploy.
2. Parallel: UI sections (Header/Hero/Storia) · (Orologi/Catalog/Profumi/Contatti/Footer).
3. Review (desktop + mobile, a11y, content fidelity) → fixes → publish to GitHub + Pages.
