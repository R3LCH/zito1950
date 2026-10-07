# ZITO 1950

Showcase site for ZITO 1950. Vite 8 + React 19 + TypeScript + Tailwind 4. Plan: `PLAN.md`; design system: `design/DESIGN.md`.

## Develop

```sh
npm ci
npm run dev       # http://localhost:5173
npm run build     # type-check + build to dist/
npm run preview
```

Env vars (build time):

- `VITE_BASE`: `/<repo>/` for GitHub Pages, `/` for a dedicated server (default `/`).
- `VITE_SITE_URL`: absolute public URL with trailing slash; used for canonical, OG, `robots.txt`, `sitemap.xml` (default `https://r3lch.github.io/zito1950/`).

The build emits `robots.txt`, `sitemap.xml` and `design/*` into `dist/` (see `site()` in `vite.config.ts`).

## GitHub Pages

`.github/workflows/pages.yml` builds on push to `main` with `VITE_BASE=/${{ github.event.repository.name }}/` and deploys `dist/`. Enable Pages → Source: GitHub Actions.

## Docker

```sh
docker compose build --build-arg VITE_SITE_URL=https://<domain>/
docker compose up -d   # http://localhost:8080
```

Builds with `VITE_BASE=/` and serves via nginx (`nginx.conf`).

## IONOS webspace

```sh
VITE_BASE=/ VITE_SITE_URL=https://<domain>/ npm run build
cp deploy/ionos.htaccess dist/.htaccess
```

Upload `dist/` contents via SFTP to the webspace folder bound to the domain.
