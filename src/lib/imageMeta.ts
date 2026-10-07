import type { CSSProperties } from 'react'
import manifest from '../../public/img/manifest.json'

export interface Dims {
  w: number
  h: number
}

const table: Record<string, Dims | undefined> = manifest

/** Natural pixel size of a public image path, e.g. "img/models/n2.jpg". */
export function dims(src: string): Dims | undefined {
  return table[src]
}

/** Caps a box at the image's natural pixel size so it is never upscaled. */
export function naturalCap(src: string): CSSProperties | undefined {
  const d = dims(src)
  return d && { maxWidth: `${d.w}px`, maxHeight: `${d.h}px` }
}
