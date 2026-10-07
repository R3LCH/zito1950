# ZITO 1950

React 19 + Vite 8 + TypeScript + Tailwind 4 storefront, with a Node 24 / Express backend and persistent SQLite catalog, sessions, orders and uploaded photos. Design system: `design/DESIGN.md`.

## Develop

Requires Node **24** (the backend uses `node:sqlite` and native TypeScript stripping).

```sh
npm ci
```

Copy `.env.example` to `.env`. Generate a unique administrator passphrase (at least 14 characters):

```sh
npm run admin:password
```

Paste the resulting `ADMIN_PASSWORD_HASH` into `.env`; there is no default account or public registration. The CLI hides terminal password input. Run in separate terminals:

```sh
npm run server    # backend on localhost:3001
npm run dev       # storefront and /admin on localhost:5173; proxies API/uploads
```

```sh
npm test          # isolated security, catalog and payment contract regressions
npm run build     # TypeScript + production frontend
```

For a local built-site smoke run, set `APP_ORIGIN=http://localhost:3001` in `.env`, run `npm start`, and visit `http://localhost:3001`. `npm run preview` serves static files only, not the shop backend.

## Administrator

Open **`/admin`** on the same origin as the website. All write APIs require a server-validated admin session, exact-origin and CSRF checks. Passwords use salted scrypt hashes; login is rate-limited. Sessions rotate on login, expire after one hour and are revoked on logout. In production the cookie is `__Host-` prefixed, Secure, HttpOnly and SameSite=Strict. Security headers include CSP, frame restrictions and HSTS. Do not expose this app over production HTTP.

- **Prodotti:** add/delete watches; edit names, codes, descriptions, quotations, specifications and EUR prices. Manage variants, their prices and photo galleries. **Abilita acquisto** controls purchase buttons on both cards and detail dialogs. Watches begin in showcase-only mode; enable them individually after verifying prices and payment configuration.
- **Profumo:** edit the existing perfume's description, price, ingredients and photos; remove or add it back to the site.
- **Fotografie:** upload JPG/PNG/WebP (12 MB maximum; 40 megapixel decode limit), associate with products, change the hero or replace story/perfume photographs. Images are re-encoded as WebP without original metadata and capped at 2400 px. In-use uploads cannot be removed from the library. Removed library files remain immutable for in-flight visitors; prune unused files offline only after backup.
- **Ordini:** view recent checkout attempts, captured orders and PayPal delivery addresses. Only `COMPLETED` records confirm payment; approval or order creation does not.

Changes publish immediately and persist in SQLite. Revision checks prevent one admin tab from silently overwriting another; on a conflict, reload the catalog and reapply the edit. All user-supplied text is rendered as text, not HTML. Purchase availability and prices are checked on the server, never trusted from local cart storage.

## Languages and translated product content

The language selector provides Italian (default), Russian, English, Ukrainian, German and Polish. It updates the storefront, story, product specifications, perfume, contacts, cart, admin interface, accessible labels and document metadata. The selection is saved in browser storage; `?lang=ru` (or `it`, `en`, `uk`, `de`, `pl`) opens a shareable language-specific view.

In **Prodotti** or **Profumo**, use the **Lingua dei contenuti** tabs:

1. Enter the Italian source text and shared product name, codes, EUR price and photographs.
2. Switch to each language and edit descriptions, specifications, quotation text, variant labels/specifications and photograph alternative text. Perfume descriptions use paragraphs separated by a blank line.
3. Switching tabs preserves unsaved text in every language. **Salva prodotto / Salva profumo** publishes all language versions in one revision-checked save. The same workflow applies to new products.

Product names, codes, prices, quotation authors, ingredients and image files remain shared. Interface language and content-editing language are independent, so an English-speaking admin can edit Ukrainian copy without changing the admin labels. Missing required translations are marked with `!` and listed for the selected language; blank translated fields fall back to Italian on the storefront. The photograph panel also provides alternative text in all five added languages for the hero.

Translations are bundled in `src/data/translations.json`; no runtime translation service is used. On the first backend start after this update, recognised original public content receives the bundled translations. Existing custom Italian text and existing translations are preserved. Newly entered admin text is never automatically translated or sent to an external service: the admin supplies each language version. Translation maps permit only the supported language keys and text fields; translated product names are rejected.

GitHub Pages exposes these controls in the public UI preview, but cannot save language edits. Durable publishing still requires the authenticated Node/SQLite backend.


## PayPal

Create a REST app in the [PayPal developer dashboard](https://developer.paypal.com/dashboard/applications). Configure **server-only** `.env` values:

```dotenv
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<sandbox REST app client ID>
PAYPAL_CLIENT_SECRET=<sandbox REST app secret>
```

Never prefix these values with `VITE_`. Restart the server after configuration changes. Missing credentials disable payment initiation and leave information-request links available.

Checkout uses the [PayPal Orders v2 API](https://developer.paypal.com/api/orders/v2): server-calculated EUR order → hosted PayPal approval → return to the cart → explicit confirmation and server capture. No third-party payment script is loaded into the website. The server requests full representations, verifies capture status, amount, EUR currency and the local order reference before recording completion. Orders belong to the shopper's HttpOnly session (24-hour expiry); create/capture idempotency keys and persisted snapshots support repeated requests and capture-response recovery without a second charge. A price or availability change before capture requires a new checkout. Cancellation preserves the cart. If payment confirmation fails, use **Conferma / verifica pagamento** for the existing order before starting another purchase.

The current total is item prices × quantities, **without an added shipping surcharge**; PayPal collects the delivery address. Confirm the merchant's shipping, tax and delivery policies before enabling live purchases. Order information is available in admin; no email fulfilment automation is included.

Test with sandbox buyer and merchant accounts before changing `PAYPAL_ENV=live` and supplying the live REST application's credentials. Real sandbox/live transactions require those credentials; automated tests simulate the external PayPal boundary and do not prove a real transaction.

## GitHub Pages UI preview

The Pages workflow publishes a deliberately **public, non-persistent UI preview**, not a real administration service:

- Website: `https://r3lch.github.io/zito1950/`
- Admin UI: `https://r3lch.github.io/zito1950/?admin-preview`

The workflow sets `VITE_STATIC_PREVIEW=true` and the repository base path. Explore all admin tabs, edit draft fields, switch variants, select existing photos or open the new-product form. Publishing, deletions, file uploads and payments are disabled. No password is required because this build contains only the already-public sample catalog; no private sessions or real orders are loaded. Refresh discards field changes. The query parameter works without a server-side `/admin` route, which Pages does not provide.

GitHub repository Settings → Pages → Source must be **GitHub Actions**. `.github/workflows/pages.yml` deploys on a push to `main` or a manual workflow run; `.github/workflows/ci.yml` separately checks the real server build and tests.

Do **not** set `VITE_STATIC_PREVIEW` for production backend builds. Production continues to use authenticated `/admin`; the preview query parameter does not grant production admin access.

## Production / Docker

A static GitHub Pages or ordinary static webspace deployment cannot run secure admin, durable updates or payments. Pages now serves the explicitly labeled UI preview above; deploy the real backend on a Node 24 host or Docker-capable server. Normal server builds can still show the original catalog when the backend is unavailable, with purchases disabled and a visible availability message.

Set `.env`:

```dotenv
APP_ORIGIN=https://your-domain.example
ADMIN_PASSWORD_HASH=<generated salt:hash>
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=<live client ID>
PAYPAL_CLIENT_SECRET=<live secret>
# Exactly one trusted reverse proxy; never expose the Node port publicly.
TRUST_PROXY=1
```

```sh
docker compose build --build-arg VITE_SITE_URL=https://your-domain.example/
docker compose up -d
```

Docker sets `NODE_ENV=production`, binds the backend to **127.0.0.1:8080** on the host and persists `/app/data` in `shop-data`. Put a trusted TLS reverse proxy in front of it and forward all routes (`/`, `/admin`, `/api/*`, `/uploads/*`) to the same Node service. Preserve the public Host and set X-Forwarded-Proto/X-Forwarded-For correctly. Do not run multiple replicas against separate catalogs; this deployment is one app instance with one SQLite volume. Outside Docker, set `NODE_ENV=production`, `APP_ORIGIN` to the exact HTTPS origin and optionally `DATA_DIR` to a private persistent directory. Never serve the data directory as static content.

Back up the database and uploads together, using SQLite's backup API or stopping the app before copying all data files. Deleting the Docker volume loses catalog edits, orders and uploads. Protect `.env` and backups with host file permissions, rotate the admin passphrase when necessary, and apply dependency/runtime updates. Changing the configured password hash requires a restart; remove existing admin sessions from SQLite if immediate session revocation is required.

Build-time public settings remain `VITE_BASE` (use `/` for the server deployment) and `VITE_SITE_URL` (absolute canonical URL with a trailing slash). Production build emits robots, sitemap and design reference assets.

## Change record — 2026-10-07

- Replaced the watch hero with `public/img/hero/new_hero.jpg` and a generated WebP sibling. Preserved the square storefront composition rather than cropping it into the old panoramic watch frame.
- Added styled `/admin`, persistent catalog/media management and per-watch purchase toggles. Previously all product data was hard-coded; browser-only administration was rejected because it cannot enforce access control or publish durable changes.
- Added a persistent cart and server-side PayPal order/capture integration with price validation and duplicate-charge protection. Previously the site only offered information requests.
- Replaced the static-only Docker runtime with a non-root Node service and persistent volume; added build/test CI and a separate Pages-only public UI preview. Static hosting cannot safely implement real admin edits or payments, so the preview makes no API calls and disables publication rather than simulating a successful backend. Added isolated regressions for authorization, CSRF, concurrent edits, uploads, payment totals, disabled products, capture recovery and amount verification.
- Added Russian, English, Ukrainian, German and Polish alongside Italian across the storefront, admin, cart and accessibility/metadata; product names stay shared. Added remembered language selection and shareable language queries. Previously all content was Italian.
- Added independent product-content language tabs, shared pricing/media, multilingual variant and photograph text, missing-translation feedback and Italian fallback. Bundled public-copy translations seed once; admin edits are not sent to a translation service. Kept all locales in one catalog revision to avoid language-specific saves overwriting each other, and added persistence/validation/fallback regressions.
- Fixed admin product-editor intrinsic sizing for narrow screens; multilingual controls wrap without horizontal scrolling.
