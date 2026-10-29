# ZITO1950

React 19 + Vite 8 + TypeScript + Tailwind 4 storefront, with a Node 24 / Express backend and persistent SQLite catalog, sessions, orders and uploaded photos. Design system: `design/DESIGN.md`.

Page order follows the numbered sections of the client's layout (`public/img/newphotos/new_layout.jpeg`): Hero → three links under the hero → open sections separated by hairlines: Storia (`#storia`) → Orologi (`#orologi`, 3–4 featured watches; “Catalogo completo” opens filters and the full grid) → Profumi (`#profumi`) → Officina (`#officina`) → Territorio (`#territorio`) → Perché Zito (`#perche-zito`) → Dove siamo (`#contatti`, the map alone, centred, with the email customer@zito1950.it under it; no postal address anywhere on the site). There is no separate Social or Scalea section.

- **Hero:** the `catalog.hero` photo is a link to `#orologi`; beside it the h1 **ZITO1950®** (® set as a small superscript), the motto **Officine del tempo**, the serif lead **Dal 1950, una storia italiana.**, a short text and one **Scopri la collezione** button (`#orologi`).
- **Links under the hero:** **La nostra storia** (`#storia`), **Collezione limitata** (`#edizioni-limitate`, opens the catalog with only the limited-edition filter) and **Perché ZITO1950®** (`#perche-zito`), each with a line icon and a one-line hint.
- **Storia:** the archive photo `img/storia/storia-nuova.jpg` beside the 1951 railway intro; **Scopri la storia** opens every chapter and the closing quote.
- **Profumi:** every public perfume in `catalog.perfumes` with photo, name, optional line under the name (e.g. **Pepe Nero**) and main details; “Mostra tutto” adds the full descriptions and ingredients. The admin availability decides what each one shows: **Acquistabile** (`buy`) adds an **Acquista** button that puts it in the cart (the information-request button replaces it while the shop is unavailable); **Solo vetrina** (`no-buy`) shows the information-request email button; **Prossimamente** (`coming-soon`) shows a “Prossimamente” eyebrow and its full text, with no code, price, quotation or button; **Esaurito** (`out-of-stock`) shows an **Esaurito** tag and no button; **Nascosto** (`hidden`) is not listed. The seed includes **Tesoro di Alarico** (Pepe Nero) as a Prossimamente perfume with its box photo. The whole section is hidden when no perfume is public.
- **Officina:** the owner at the workbench (`img/storia/owner.jpg`); **Scopri il laboratorio** opens the movement and material notes.
- **Territorio:** **Scopri il territorio**, the Scalea text beside the sea photo `img/storia/scalea-mare.jpg`; not expandable.
- **Perché Zito:** **Perché scegliere ZITO1950**, the serif lead beside the reasons and the brand line; not expandable.

The header nav (Storia, Orologi, Profumi, Officina, Territorio, Contatti) comes from `site.nav`; its shopping-bag control opens the cart and shows a square item-count badge. The footer follows the mockup: logo and motto, then the columns **Il marchio** (La nostra storia, Il laboratorio, La Calabria, I profumi), **Assistenza** (Catalogo completo, Contatti) and **Social** (Instagram and Facebook icon links, opened in a new tab), and a bottom row with copyright, company and address, and “Design italiano · Calabria · Dal 1950”. Instagram and Facebook links appear only in the footer.

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

Open **`/admin`** on the same origin as the website. All write APIs require a server-validated admin session, exact-origin and CSRF checks. Passwords use salted scrypt hashes; login allows 5 attempts per IP per 15 minutes. All `/api` routes allow 120 requests per IP per minute, new PayPal orders 20 per IP per 15 minutes and public order pages 30 per minute; over the limit the server answers 429 with a readable Italian error. Sessions rotate on login, expire after one hour and are revoked on logout. In production the cookie is `__Host-` prefixed, Secure, HttpOnly and SameSite=Strict. Security headers include CSP, frame restrictions and HSTS. `/admin` and `/ordine/*` send `X-Robots-Tag: noindex` and are disallowed in `robots.txt`. Images under `/email`, `/img` and `/uploads` are served with `Cross-Origin-Resource-Policy: cross-origin` so mail clients and the sandboxed email preview can load them. Do not expose this app over production HTTP.

- **Prodotti:** add/delete watches; edit names, codes, descriptions, quotations, specifications and EUR prices. Set **Linea** (Uomo / Donna / Unisex tile radio group, shared across languages, default Unisex). Manage variants, their prices and photo galleries; **Aggiungi foto** in any gallery opens the same searchable picker grid used by **Fotografie del sito** (uploading a file there adds it immediately), and **Carica nuove foto** uploads files to the library and appends them to that gallery without leaving the editor (unsaved edits are kept). **Disponibilità** is a four-option tile radio group: `buy` (Acquistabile), `no-buy` (Solo vetrina), `out-of-stock` (Esaurito), `hidden` (Nascosto). Only `buy` permits purchases; `hidden` is omitted from public `/api/catalog` responses. New watches start at `no-buy`; change them to `buy` only after verifying prices and payment configuration. **Edizione limitata** sets `limitedEdition`; **Pezzi rimanenti** sets `piecesRemaining` to an integer from 0–9999, or empty (`null`) to omit the count. A limited edition with `0` pieces is shown as **Esaurito** and cannot be bought, whatever its availability, until a positive count is saved (`availabilityOf` in `src/lib/catalogFilters.ts`; enforced again by the server at checkout). Each paid capture lowers a limited edition's count by the units sold (variants share the model's count), in the same SQLite transaction that marks the order `COMPLETED`, and bumps the catalog revision so an admin tab opened before the sale gets a conflict instead of restoring the old count. Checkout and capture refuse quantities above the remaining count; units in a capture awaiting PayPal are reserved, so two shoppers racing for the last piece cannot both be charged. Counts left empty are never changed. Quotation text and author may each be left blank; blank parts are dropped and an empty quotation is not rendered.
- **In evidenza in home** (in **Prodotti**, shown when no watch is open): pick up to 4 watches for the homepage preview shown before the catalog is expanded, reorder them with ↑/↓ or remove them, then save (`PUT /api/admin/featured` with `{ "ids": [...], "revision": n }`). The server keeps known ids once each in the owner's order and rejects more than 4; deleting a product removes it from the picks. An empty list shows the first 4 of the catalog order; hidden watches are never shown.
- **Profumi:** a list of perfumes with the same add / select-to-edit / delete flow as **Prodotti**. Edit each perfume's name, **Linea** (the short line under the name, shared across languages), code, description, price, ingredients, quotation and photos (including direct upload). Code, price and quotation are optional; an empty price shows none. **Disponibilità** is a five-option tile radio group: `buy` (Acquistabile), `no-buy` (Solo vetrina), `coming-soon` (Prossimamente), `out-of-stock` (Esaurito), `hidden` (Nascosto); new perfumes start at `no-buy`. Only `buy` can be added to the cart, and selling requires a price: Acquistabile without one shows **Prezzo richiesto per vendere il profumo.** and blocks saving, and the server rejects the same save with 400. `hidden` perfumes are omitted from public `/api/catalog` responses. A new perfume gets a permanent id from its first saved name (`PUT /api/admin/perfumes/:id`); **Elimina profumo** removes it (`DELETE /api/admin/perfumes/:id`). With no perfumes the list is empty.
- **Fotografie:** upload JPG/PNG/WebP (12 MB maximum; 40 megapixel decode limit). Uploads keep the original file name (without extension) as the admin-only `name`, used as the photo's label everywhere in admin. Images are re-encoded as WebP without original metadata and capped at 2400 px. **Fotografie del sito** has two side-by-side scrollable lists (stacked on narrow screens). **Da sostituire** lists every photograph in use once, with preview, name, where it appears and a **Principale** tag on the hero; search filters by name, file or place. Ticked photos appear in **Sostituisci con**, where **Scegli** opens a searchable picker grid (or upload a new file there, which is picked immediately). **Sostituisci foto** swaps them all in one revision-checked `PUT /api/admin/images/replace` call (`{ replacements: [{ source, image }], revision }`). Each replaced slot keeps its own description unless it was blank; replacing back with the original file removes the site override. In-use uploads cannot be removed from the library. Removed library files remain immutable for in-flight visitors; prune unused files offline only after backup.
- **Ordini:** view recent checkout attempts and captured orders with PayPal delivery address, customer email, and per item the photo, codes, **Certificato della proprietà e garanzia** holder and **Incisione** (marked non-returnable). **Stato dell’ordine** sets readiness (Ordine ricevuto → In lavorazione → Pronto → Spedito → Consegnato) via `PUT /api/admin/orders/:id/status` `{ status, notify }`; with **Invia email al cliente** checked the matching template is emailed. Each order shows its status history, the email log (sent / not sent / failed with error), **Apri pagina ordine** and the certificate-code form (`PUT /api/admin/orders/:id/certificate`). Legacy order-level holders still display. Only `COMPLETED` orders can change status.
- **Email:** edit the five customer email templates (Attiva, Oggetto, Titolo, Messaggio; placeholders `{nome}`, `{ordine}`, `{stato}`) with a live sandboxed preview of the real email, and see whether SMTP is configured (`GET`/`PUT /api/admin/email-templates`, `GET /api/admin/mail`).

**Fotografie del sito** labels each photo by where it appears: **Foto principale** (hero), **Storia** (main photo and chapters), **Officina**, **Scopri il territorio**, and each watch's and perfume's name. Tesoro di Alarico's box photo (`img/profumo/coming-soon.jpg`) is that perfume's own image, not a site photo.

Changes publish immediately and persist in SQLite. Revision checks prevent one admin tab from silently overwriting another; on a conflict, reload the catalog and reapply the edit. All user-supplied text is rendered as text, not HTML. Purchase availability and prices are checked on the server, never trusted from local cart storage.

The catalog's featured order puts **Nuovo** models first, then purchasable, showcase-only and out-of-stock models, with descending price within each group. A **Cerca per nome** search field before the button filters the open catalog live by model name, ignoring case, accents, spaces and punctuation (`n2` finds N°2, `cafe` finds Cafè Racer); Esc and **Azzera filtri** clear it. **Filtri e ordinamento** opens a side sheet (full screen on mobile) with, first, **Linea** (Uomo / Donna; unisex models appear under both), then sort order (featured, price ascending/descending, name) and filters: **Novità**, **Edizioni limitate**, availability, movement (automatic, manual winding, quartz), functions (chronograph, tourbillon, date), case (steel, 18 kt gold, gold-plated) and price band. Options combine with OR inside a group and AND across groups; each shows its live result count, and options with no matches are disabled or hidden. Active filters appear as removable chips under the button. Movement, functions and case are derived from the Italian specifications and descriptions (caliber numbers count, e.g. ETA 2824 → automatic), so new products are classified by their spec wording. `#edizioni-limitate` opens the catalog with only the limited-edition filter; toggling that filter keeps the hash in step. Limited models have an **Edizione limitata** corner label and new models a **Nuovo** label; out-of-stock models (including limited editions with zero pieces) carry an **Esaurito** tag. Positive remaining counts show **Ancora N pezzi**, or **Ultimo pezzo disponibile** for one; empty or zero shows no count. **Scopri anche** in the detail dialog lists every other public model in one horizontally scrollable row (arrow buttons page by whole cards; the mouse wheel scrolls it and hands back to the dialog at either end; touch snaps to cards): the owner's **Modelli simili** picks first, in their order, then the rest by similarity (movement, functions, case, limited-edition status, closeness in price). Selecting one switches the open dialog in place.

In **Prodotti**, **Nuovo** marks a model as new, and **Modelli simili** picks and orders the models shown first in its **Scopri anche** row. The server drops unknown ids, duplicates and the product itself, and deleting a product removes it from every other product's picks.

The hero uses `catalog.hero`, defaulting to the most expensive seed model, **Tutus ab uno** (`img/models/tutus-ab-uno.jpg`). In **Fotografie → Foto principale**, the picker includes model photographs, site photographs and the library, labelled by file name; save the form to publish the choice.

On backend startup, existing databases migrate `buyEnabled: true` to `availability: buy`, and false/missing to `no-buy`, preserving any existing availability state and removing the old flag. Catalogs below `catalogVersion` 3 have the retired `sold` state rewritten to `out-of-stock`. The former default hero `img/hero/new_hero.jpg` becomes the Tutus ab uno photograph; custom hero choices are kept. `catalogVersion` 8 adds `gender` (`uomo` | `donna` | `unisex`) to every watch, taken from the seed model with the same id (from the old site's Uomo/Donna menu) or `unisex`; the server rejects any other value. `catalogVersion` 5 retires the Scalea section's `img/storia/scalea-borgo.jpg` and `img/storia/scalea-palazzo.jpg` slots (and their overrides; uploaded library files stay) and adds the new page photos: the Storia main photo, the workshop portrait and the territory view. `catalogVersion` 6 gives every perfume an `availability` (missing → `no-buy`), adds Tesoro di Alarico as a `coming-soon` perfume when absent, and removes the `img/profumo/coming-soon.jpg` site slot and its override (the file stays as the perfume's photo; uploaded library files stay). `catalogVersion` 7 replaces N°7 Oud's old photo `img/profumo/n7-oud.jpg` with the client's new `img/profumo/nuovo.jpg` (in the perfume and any site slot); an owner replacement of the old photo is kept and moved to the new key, and a photo the owner already removed is not brought back. New databases are seeded at version 7. Missing `certificate` and `certificate_code` columns are automatically added to the orders table.

## Languages and translated product content

The language selector provides Italian (default), Russian, English, Ukrainian, German and Polish. It updates the storefront, story, product specifications, perfume, contacts, cart, admin interface, accessible labels and document metadata. The selection is saved in browser storage; `?lang=ru` (or `it`, `en`, `uk`, `de`, `pl`) opens a shareable language-specific view.

In **Prodotti** or **Profumi**, use the **Lingua dei contenuti** tabs:

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

Cart lines carry `kind`: `model` (watch, with an optional variant) or `perfume` (`variantId` always `null`). Lines stored before perfumes were sold have no `kind` and count as watches. The server prices every line itself and rejects a perfume that is no longer `buy` with 409.
Every cart line (watch or perfume) has two optional sections. **Certificato della proprietà e garanzia** shows the certificate front/back; once any of Nome, Cognome, Email is filled all three are required. **Incisione** takes up to 10 words / 120 characters for the case back (perfumes: the bottle) with a live word counter; when filled, the cart states “Un articolo con incisione è personalizzato: non può essere restituito né cambiato.” and requires the checkbox “Ho letto: l’articolo inciso non è restituibile.”. A personalized line is always quantity 1; the same product can sit on several lines with different personalization. Checkout sends `items[].certificate`, `items[].engraving`, `items[].engravingAccepted`; the server rejects over-long engravings, unaccepted engravings and personalized quantities above 1 with 400, and stores each line with its photo at order time.

Privacy: certificate holders, engravings and customer emails are stored with the order. The PayPal capture receipt also records the payer's name and email. These details are visible to the authenticated administrator, appear in order emails and are included in database backups. The public order page exposes only items, personalization and status, behind a 256-bit random token.

GitHub Pages preview: every priced product can be added to the cart and personalized; **Paga con PayPal** stays disabled. `?ordine=anteprima` shows a demo order page.
When the cart contains a watch, the cart's **Certificato di proprietà** form shows the certificate front and back and requires **Nome di battesimo**, **Cognome** and **Email**, with a note that the warranty certificate is issued in this name and delivered with the watch. **Paga con PayPal** stays disabled until all three are valid. Checkout sends `certificate: { firstName, lastName, email }` in `POST /api/payments/orders`; for any order holding a watch the server rejects a missing or invalid certificate with 400. A perfume-only cart hides the form and sends `certificate: null`, and the order stores no holder. The PayPal payer's name is never used as the holder. The owner assigns the certificate code later in **Admin → Ordini**; shoppers do not enter the code.

Privacy: certificate-holder names and email addresses are stored with the order when it is created. The PayPal capture receipt also records the payer's name and email. These details are visible to the authenticated administrator and are included in database backups.

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

### VPS (zito1950.it)

The live site runs on an Ubuntu 24.04 VPS (`195.231.64.190`): Docker Compose runs the app on `127.0.0.1:8080`, and Caddy (`deploy/Caddyfile` → `/etc/caddy/Caddyfile`) terminates TLS with automatic Let's Encrypt certificates for `zito1950.it` and redirects `www.zito1950.it` to it. The checkout lives in `/srv/zito1950`, owned by `deploy`; `.env` there is mode 600 and never committed.

- SSH: key-only, user `deploy` only (root login disabled); `deploy` has `sudo` with a password and is in the `docker` group.
- Firewall (ufw): 22 rate-limited, 80, 443 tcp/udp; everything else incoming denied. fail2ban bans an IP after 4 failed SSH logins in 10 minutes (any user, including root attempts), for 1 hour at first and longer for repeat offenders, up to a week; a banned IP sees `Connection refused` on port 22. Wait for the ban to expire, or connect from another IP or the Aruba web console and run `sudo fail2ban-client set sshd unbanip <ip>`.
- Unattended security upgrades, with an automatic reboot at 04:30 when one is required.

Deploy the latest `main`:

```sh
ssh deploy@195.231.64.190 /srv/zito1950/deploy/deploy.sh
```

The script pulls `main`, rebuilds the image, restarts the container and waits for `/api/payments/config`. App logs: `docker compose logs web` in `/srv/zito1950`. Failed PayPal calls log PayPal's issue code and `debug_id` (needed by PayPal support).

## Change record — 2026-10-07–2026-10-13

- Initially replaced the panoramic watch hero with a square storefront photograph. The current default is the Tutus ab uno product photograph; automatic migration replaces only the former default, preserving owner-selected heroes.
- Added styled `/admin`, persistent catalog/media management and per-watch purchase toggles. Previously all product data was hard-coded; browser-only administration was rejected because it cannot enforce access control or publish durable changes.
- Added a persistent cart and server-side PayPal order/capture integration with price validation and duplicate-charge protection. Previously the site only offered information requests.
- Replaced the static-only Docker runtime with a non-root Node service and persistent volume; added build/test CI and a separate Pages-only public UI preview. Static hosting cannot safely implement real admin edits or payments, so the preview makes no API calls and disables publication rather than simulating a successful backend. Added isolated regressions for authorization, CSRF, concurrent edits, uploads, payment totals, disabled products, capture recovery and amount verification.
- Added Russian, English, Ukrainian, German and Polish alongside Italian across the storefront, admin, cart and accessibility/metadata; product names stay shared. Added remembered language selection and shareable language queries. Previously all content was Italian.
- Added independent product-content language tabs, shared pricing/media, multilingual variant and photograph text, missing-translation feedback and Italian fallback. Bundled public-copy translations seed once. Kept all locales in one catalog revision to avoid language-specific saves overwriting each other, and added persistence/validation/fallback regressions.
- Fixed admin product-editor intrinsic sizing for narrow screens; multilingual controls wrap without horizontal scrolling.
- Added admin auto-translation into empty fields of other languages (Enter / Ctrl+Enter) via a server-side MyMemory → unofficial Google fallback, with session/CSRF protection. Previously each language was typed manually; the client never calls the translation services directly.
- Reordered the storefront around the catalog, added the Scalea place block and a separate social section (both later removed by the new layout below), and moved the cart opener into the header. Product availability states replace the old purchase toggle so sold, out-of-stock and hidden models are distinct; limited-edition labels, filtering and in-dialog recommendations expose the collection without changing those states.
- Added certificate-holder details at checkout (optional at first, mandatory since the new layout below) and an owner-assigned certificate code in admin orders, replacing the old standalone certificate request with order-linked data. Existing databases gain the certificate columns automatically.
- Brand name is now written `ZITO 1950®` everywhere (copy, metadata, manifest, PayPal brand, logo with a red ®); the handwritten dedication keeps its original wording. Contact email changed from the PEC to customer@zito1950.it. Added the **Linea** (Uomo/Donna) filter as the first group of **Filtri e ordinamento**, a Uomo/Donna/Unisex tag on every watch page, the admin **Linea** radio group with a v8 catalog migration, and a name search for the catalog.
- Replaced the two-button limited-edition toggle with a **Filtri e ordinamento** sheet (sort, novelty, limited, availability, movement, functions, case, price) whose movement/function/case facets come from the Italian spec text, with gold-plated cases kept apart from solid gold. Added an admin **Nuovo** flag (label plus first place in the featured order) and owner-ordered **Modelli simili** picks; **Scopri anche** now shows every other public model in a paged horizontal row, picks first, then by similarity, instead of four by price. The server sanitizes picks and removes deleted products from them, with a regression test.
- Reworked admin photo handling. Galleries in **Prodotti** and **Profumo** upload directly instead of requiring a trip to **Fotografie** and back; a successful upload no longer remounts open editors, so unsaved edits survive. **Fotografie del sito** replaced the two dropdowns (one slot, one library photo, one save per swap) with a preview list of every photo in use, multi-select and a searchable picker grid with upload, saved in one atomic multi-replace call so a batch never half-applies; the old single `PUT /api/admin/image` route was removed. Uploaded file names are kept as admin labels because paths and empty alt texts were unidentifiable. Removed **Usa il modello più costoso**: it duplicated a one-time choice already available in the picker.
- Retired the **Venduto** state: it showed the same thing as **Esaurito** with a different word. Existing sold models migrate to `out-of-stock`; the server rejects `sold`. A limited edition at 0 pieces now reads as **Esaurito** and is not purchasable, so the owner no longer has to change two fields when the last piece goes; the effective state is derived (not stored) so restoring a positive count restores the configured availability. Quotation text and author can now be blank instead of being required.
- Limited-edition counts now go down automatically when a sale is paid, instead of only being changed by hand. The decrement happens on capture (abandoned checkouts don't consume stock), commits atomically with order completion, and is guarded so a recovered capture response counts once. Pieces held by in-flight captures are reserved in memory, which is sufficient because the deployment is one app instance on one SQLite database. The storefront reloads the catalog after a successful payment so the new count shows immediately.
- Turned the single optional perfume into a perfume list (`catalog.perfumes`, each with a unique `id`) managed from **Profumi**, replacing `PUT /api/admin/perfume` with `PUT`/`DELETE /api/admin/perfumes/:id`; the site could only show one perfume. Added owner-chosen homepage watches (`catalog.featured`, max 4) for the compact watch preview. Catalog version 4 migrates the old perfume (or its removal) into the list once, starts `featured` empty and adds the workshop portrait (`img/storia/owner.jpg`) to the replaceable site photos. **Fotografie del sito** now labels each photo by the section it appears in.
- Rebuilt the storefront on the client's new layout (`public/img/newphotos/new_layout.jpeg`): Hero → three links → Storia → Orologi → Profumi (with the coming-soon Tesoro di Alarico) → Officina → Territorio → Perché Zito → Contatti, with socials moved into the mockup's footer and the Social and Scalea sections removed; catalog version 5 retires the Scalea photo slots and adds the new page photos. The warranty certificate holder (Nome, Cognome, Email) is now mandatory at checkout and enforced by the server, replacing the optional custom certificate with a PayPal-payer fallback, because every watch ships with a named warranty certificate and the payer is not always the owner.
- Replaced the order-level mandatory certificate with optional per-item **Certificato della proprietà e garanzia** and **Incisione** (max 10 words, non-returnable once engraved, explicit acknowledgement) for watches and perfumes. Added owner and customer order emails (nodemailer SMTP, logged, never blocking capture), admin-editable customer templates per readiness status, status-change emails, an order readiness control in **Admin → Ordini**, a public order page `/ordine/<token>`, and the cart with disabled PayPal on GitHub Pages. Brand inscriptions use TeX Gyre Adventor, the Avant-Garde-style face of the logo.
- Perfumes can now be sold, so the upcoming Tesoro di Alarico can be ordered at release: perfumes gained availability states (including **Prossimamente**), an **Acquista** button, `kind`-tagged cart lines and a price requirement for selling, and the warranty certificate is asked only when the cart holds a watch. Tesoro di Alarico is now a seeded Prossimamente perfume instead of a static coming-soon block; catalog version 6 migrates existing databases.
- Brand now written `ZITO1950®` (no space) in copy, metadata, logos, emails and the PayPal brand; the handwritten «a Zito 1950» dedication keeps its wording. Cart lines show the product code under the name, and the photo or name now leads back to the product (watch dialog at the chosen finish, perfume card scrolled into view). Fixed the watch dialog scrolling sideways: off-screen sr-only labels in **Scopri anche** widened it. The Perché section gained the client's photo; the Officina button now reads **Assistenza**.
- Production now runs on the zito1950.it VPS (Docker + Caddy, `deploy/Caddyfile`, `deploy/deploy.sh`). Failed PayPal calls are now logged with PayPal's issue code and `debug_id`, which the server previously discarded; a declined payment method (`INSTRUMENT_DECLINED`) or a not-yet-approved order now tells the buyer what to do instead of the generic retry message, and the same order can still be paid afterwards.
- Email images (logo, product photos, social icons) were blocked in the admin preview and in mail clients that load images in the browser: helmet's default `Cross-Origin-Resource-Policy: same-origin` applied to them. Image paths now allow cross-origin loading. Added a limit on new PayPal orders, JSON 429 errors (the default plain-text reply showed a generic error), and kept `/admin` and order pages out of search engines.