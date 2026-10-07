/** Resolve a public-folder path against Vite's base URL (works under sub-path deploys). */
export const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, '')

export interface ImgSources {
  src: string
  webp: string
  w?: number
  h?: number
}

/**
 * JPG source plus its WebP sibling, both base-resolved.
 * Dimensions are not looked up here; components reserve space with CSS aspect-ratio.
 */
export function img(p: string): ImgSources {
  return { src: asset(p), webp: asset(p.replace(/\.jpe?g$/i, '.webp')) }
}
