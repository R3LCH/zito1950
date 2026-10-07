import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// VITE_BASE: '/<repo>/' for GitHub Pages, '/' for a dedicated server, './' for a portable build.
// VITE_SITE_URL: public absolute URL of the site (with trailing slash), used for OG/canonical/sitemap.
const SITE_URL = (process.env.VITE_SITE_URL || 'https://r3lch.github.io/zito1950/').replace(/\/?$/, '/')

/** Absolute URLs in index.html (%SITE_URL%), plus robots.txt, sitemap.xml and design docs in dist/. */
function site(): Plugin {
  return {
    name: 'zito-site',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
    generateBundle() {
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })
      emit('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`)
      emit(
        'sitemap.xml',
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE_URL}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </url>\n</urlset>\n`,
      )
      for (const f of ['DESIGN.md', 'zito.tokens.json', 'components.json']) emit(`design/${f}`, readFileSync(`design/${f}`, 'utf8'))
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), site()],
})
