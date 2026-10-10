# ZITO 1950

React 19 + Vite 8 + TypeScript + Tailwind 4 storefront, with a Node 24 / Express backend and persistent SQLite catalog, sessions, orders and uploaded photos. Design system: `design/DESIGN.md`.

Page order: Hero → Orologi (`#orologi`) → Profumi (`#profumi`) → Storia (`#storia`, opening with “Scalea e la Calabria” and real place photographs) → Social (`#social`, Instagram and Facebook) → Dove siamo (`#contatti`, address, map, PEC and P.IVA). The header shopping-bag control opens the cart and shows a square item-count badge.

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

- **Prodotti:** add/delete watches; edit names, codes, descriptions, quotations, specifications and EUR prices. Manage variants, their prices and photo galleries; **Carica nuove foto** in any gallery uploads files to the library and appends them to that gallery without leaving the editor (unsaved edits are kept). **Disponibilità** is a four-option tile radio group: `buy` (Acquistabile), `no-buy` (Solo vetrina), `out-of-stock` (Esaurito), `hidden` (Nascosto). Only `buy` permits purchases; `hidden` is omitted from public `/api/catalog` responses. New watches start at `no-buy`; change them to `buy` only after verifying prices and payment configuration. **Edizione limitata** sets `limitedEdition`; **Pezzi rimanenti** sets `piecesRemaining` to an integer from 0–9999, or empty (`null`) to omit the count. A limited edition with `0` pieces is shown as **Esaurito** and cannot be bought, whatever its availability, until a positive count is saved (`availabilityOf` in `src/lib/catalogFilters.ts`; enforced again by the server at checkout). Each paid capture lowers a limited edition's count by the units sold (variants share the model's count), in the same SQLite transaction that marks the order `COMPLETED`, and bumps the catalog revision so an admin tab opened before the sale gets a conflict instead of restoring the old count. Checkout and capture refuse quantities above the remaining count; units in a capture awaiting PayPal are reserved, so two shoppers racing for the last piece cannot both be charged. Counts left empty are never changed. Quotation text and author may each be left blank; blank parts are dropped and an empty quotation is not rendered.
- **Profumo:** edit the existing perfume's description, price, ingredients and photos (including direct upload); remove or add it back to the site.
- **Fotografie:** upload JPG/PNG/WebP (12 MB maximum; 40 megapixel decode limit). Uploads keep the original file name (without extension) as the admin-only `name`, used as the photo's label everywhere in admin. Images are re-encoded as WebP without original metadata and capped at 2400 px. **Fotografie del sito** has two side-by-side scrollable lists (stacked on narrow screens). **Da sostituire** lists every photograph in use once, with preview, name, where it appears and a **Principale** tag on the hero; search filters by name, file or place. Ticked photos appear in **Sostituisci con**, where **Scegli** opens a searchable picker grid (or upload a new file there, which is picked immediately). **Sostituisci foto** swaps them all in one revision-checked `PUT /api/admin/images/replace` call (`{ replacements: [{ source, image }], revision }`). Each replaced slot keeps its own description unless it was blank; replacing back with the original file removes the site override. In-use uploads cannot be removed from the library. Removed library files remain immutable for in-flight visitors; prune unused files offline only after backup.
- **Ordini:** view recent checkout attempts, captured orders, PayPal delivery addresses and the certificate holder. Assign or clear each order's certificate code with the code form; it calls admin- and CSRF-protected `PUT /api/admin/orders/:id/certificate` with `{ "code": "ZT-001" }` (an empty code clears it). Only `COMPLETED` records confirm payment; approval or order creation does not.

Changes publish immediately and persist in SQLite. Revision checks prevent one admin tab from silently overwriting another; on a conflict, reload the catalog and reapply the edit. All user-supplied text is rendered as text, not HTML. Purchase availability and prices are checked on the server, never trusted from local cart storage.

The catalog's featured order puts **Nuovo** models first, then purchasable, showcase-only and out-of-stock models, with descending price within each group. **Filtri e ordinamento** opens a side sheet (full screen on mobile) with sort order (featured, price ascending/descending, name) and filters: **Novità**, **Edizioni limitate**, availability, movement (automatic, manual winding, quartz), functions (chronograph, tourbillon, date), case (steel, 18 kt gold, gold-plated) and price band. Options combine with OR inside a group and AND across groups; each shows its live result count, and options with no matches are disabled or hidden. Active filters appear as removable chips under the button. Movement, functions and case are derived from the Italian specifications and descriptions (caliber numbers count, e.g. ETA 2824 → automatic), so new products are classified by their spec wording. `#edizioni-limitate` opens the catalog with only the limited-edition filter; toggling that filter keeps the hash in step. Limited models have an **Edizione limitata** corner label and new models a **Nuovo** label; out-of-stock models (including limited editions with zero pieces) carry an **Esaurito** tag. Positive remaining counts show **Ancora N pezzi**, or **Ultimo pezzo disponibile** for one; empty or zero shows no count. **Scopri anche** in the detail dialog lists every other public model in one horizontally scrollable row (arrow buttons page by whole cards; the mouse wheel scrolls it and hands back to the dialog at either end; touch snaps to cards): the owner's **Modelli simili** picks first, in their order, then the rest by similarity (movement, functions, case, limited-edition status, closeness in price). Selecting one switches the open dialog in place.

In **Prodotti**, **Nuovo** marks a model as new, and **Modelli simili** picks and orders the models shown first in its **Scopri anche** row. The server drops unknown ids, duplicates and the product itself, and deleting a product removes it from every other product's picks.

The hero uses `catalog.hero`, defaulting to the most expensive seed model, **Tutus ab uno** (`img/models/tutus-ab-uno.jpg`), with **Orologiai a Scalea dal 1950** and links to the story, limited editions and social section. In **Fotografie → Foto principale**, the picker includes model photographs, site photographs and the library, labelled by file name; save the form to publish the choice.

On backend startup, existing databases migrate `buyEnabled: true` to `availability: buy`, and false/missing to `no-buy`, preserving any existing availability state and removing the old flag. Catalogs below `catalogVersion` 3 have the retired `sold` state rewritten to `out-of-stock`. The former default hero `img/hero/new_hero.jpg` becomes the Tutus ab uno photograph; custom hero choices are kept. Missing `certificate` and `certificate_code` columns are automatically added to the orders table.

## Languages and translated product content

The language selector provides Italian (default), Russian, English, Ukrainian, German and Polish. It updates the storefront, story, product specifications, perfume, contacts, cart, admin interface, accessible labels and document metadata. The selection is saved in browser storage; `?lang=ru` (or `it`, `en`, `uk`, `de`, `pl`) opens a shareable language-specific view.

In **Prodotti** or **Profumo**, use the **Lingua dei contenuti** tabs:

1. Enter the Italian source text and shared product name, codes, EUR price and photographs.
2. Switch to each language and edit descriptions, specifications, quotation text, variant labels/specifications and photograph alternative text. Perfume descriptions use paragraphs separated by a blank line.
3. Switching tabs preserves unsaved text in every language. **Salva prodotto / Salva profumo** publishes all language versions in one revision-checked save. The same workflow applies to new products.

Product names, codes, prices, quotation authors, ingredients and image files remain shared. Interface language and content-editing language are independent, so an English-speaking admin can edit Ukrainian copy without changing the admin labels. Missing required translations are marked with `!` and listed for the selected language; blank translated fields fall back to Italian on the storefront. The photograph panel also provides alternative text in all five added languages for the hero.

Translations of the public copy are bundled in `src/data/translations.json`. On the first backend start after this update, recognised original public content receives the bundled translations. Existing custom Italian text and existing translations are preserved. Translation maps permit only the supported language keys and text fields; translated product names are rejected.

Admin auto-translation: in any language tab, press Enter in a filled single-line field (Ctrl+Enter / ⌘+Enter in multi-line fields) to translate it into the **empty** matching fields of the other languages; filled translations are never overwritten. Specification lists translate line by line. The admin browser calls the authenticated, CSRF-protected `POST /api/admin/translate`; the server sends the text to the keyless public [MyMemory](https://mymemory.translated.net/doc/spec.php) API and falls back to Google's unofficial `translate.googleapis.com/translate_a/single` endpoint on quota warnings, errors, texts over MyMemory's 500-byte limit, or when MyMemory offers only fuzzy translation-memory matches (which can belong to a different sentence). Entered admin text therefore leaves the server for these third parties. Neither service has a contract or SLA; quotas are undocumented and the Google endpoint may stop working without notice. Set optional `MYMEMORY_EMAIL` to raise MyMemory's daily free quota. Review machine translations before saving.

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

Before checkout, **Certificato personalizzato** optionally collects **Nome**, **Cognome** and **Email**, matching the old site's `richiesta-certificato.html` fields. When enabled, checkout sends `certificate: { firstName, lastName, email }` in `POST /api/payments/orders`; when disabled, it sends `certificate: null`, and the certificate holder uses the PayPal payer name and email recorded on capture. The owner assigns the certificate code later in **Admin → Ordini**; shoppers do not enter the code.

Privacy: certificate-holder names and email addresses are stored with orders. Custom holder details are stored when the order is created; PayPal payer details are recorded after capture. These details are visible to the authenticated administrator and are included in database backups.

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

## Change record — 2026-10-07–2026-10-10

- Initially replaced the panoramic watch hero with a square storefront photograph. The current default is the Tutus ab uno product photograph; automatic migration replaces only the former default, preserving owner-selected heroes.
- Added styled `/admin`, persistent catalog/media management and per-watch purchase toggles. Previously all product data was hard-coded; browser-only administration was rejected because it cannot enforce access control or publish durable changes.
- Added a persistent cart and server-side PayPal order/capture integration with price validation and duplicate-charge protection. Previously the site only offered information requests.
- Replaced the static-only Docker runtime with a non-root Node service and persistent volume; added build/test CI and a separate Pages-only public UI preview. Static hosting cannot safely implement real admin edits or payments, so the preview makes no API calls and disables publication rather than simulating a successful backend. Added isolated regressions for authorization, CSRF, concurrent edits, uploads, payment totals, disabled products, capture recovery and amount verification.
- Added Russian, English, Ukrainian, German and Polish alongside Italian across the storefront, admin, cart and accessibility/metadata; product names stay shared. Added remembered language selection and shareable language queries. Previously all content was Italian.
- Added independent product-content language tabs, shared pricing/media, multilingual variant and photograph text, missing-translation feedback and Italian fallback. Bundled public-copy translations seed once. Kept all locales in one catalog revision to avoid language-specific saves overwriting each other, and added persistence/validation/fallback regressions.
- Fixed admin product-editor intrinsic sizing for narrow screens; multilingual controls wrap without horizontal scrolling.
- Added admin auto-translation into empty fields of other languages (Enter / Ctrl+Enter) via a server-side MyMemory → unofficial Google fallback, with session/CSRF protection. Previously each language was typed manually; the client never calls the translation services directly.
- Reordered the storefront around the catalog, added the Scalea place block and a separate social section, and moved the cart opener into the header. Product availability states replace the old purchase toggle so sold, out-of-stock and hidden models are distinct; limited-edition labels, filtering and in-dialog recommendations expose the collection without changing those states.
- Added optional certificate-holder details at checkout and an owner-assigned certificate code in admin orders, replacing the old standalone certificate request with order-linked data. Existing databases gain the certificate columns automatically.
- Replaced the two-button limited-edition toggle with a **Filtri e ordinamento** sheet (sort, novelty, limited, availability, movement, functions, case, price) whose movement/function/case facets come from the Italian spec text, with gold-plated cases kept apart from solid gold. Added an admin **Nuovo** flag (label plus first place in the featured order) and owner-ordered **Modelli simili** picks; **Scopri anche** now shows every other public model in a paged horizontal row, picks first, then by similarity, instead of four by price. The server sanitizes picks and removes deleted products from them, with a regression test.
- Reworked admin photo handling. Galleries in **Prodotti** and **Profumo** upload directly instead of requiring a trip to **Fotografie** and back; a successful upload no longer remounts open editors, so unsaved edits survive. **Fotografie del sito** replaced the two dropdowns (one slot, one library photo, one save per swap) with a preview list of every photo in use, multi-select and a searchable picker grid with upload, saved in one atomic multi-replace call so a batch never half-applies; the old single `PUT /api/admin/image` route was removed. Uploaded file names are kept as admin labels because paths and empty alt texts were unidentifiable. Removed **Usa il modello più costoso**: it duplicated a one-time choice already available in the picker.
- Retired the **Venduto** state: it showed the same thing as **Esaurito** with a different word. Existing sold models migrate to `out-of-stock`; the server rejects `sold`. A limited edition at 0 pieces now reads as **Esaurito** and is not purchasable, so the owner no longer has to change two fields when the last piece goes; the effective state is derived (not stored) so restoring a positive count restores the configured availability. Quotation text and author can now be blank instead of being required.
- Limited-edition counts now go down automatically when a sale is paid, instead of only being changed by hand. The decrement happens on capture (abandoned checkouts don't consume stock), commits atomically with order completion, and is guarded so a recovered capture response counts once. Pieces held by in-flight captures are reserved in memory, which is sufficient because the deployment is one app instance on one SQLite database. The storefront reloads the catalog after a successful payment so the new count shows immediately.
