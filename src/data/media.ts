import type { Img } from './types.ts'

/** Uploaded product videos are transcoded to `uploads/<uuid>.mp4`; the opening frame sits beside it as `uploads/<uuid>.webp`. */
export const isVideo = (src: string) => src.endsWith('.mp4')
export const posterOf = (src: string) => src.replace(/\.mp4$/, '.webp')

/**
 * What a product shows outside its open dialog (cards, cart, emails, recommendations): its photos,
 * or the first video's opening frame when the product has no photos.
 */
export function stillImages(media: Img[]): Img[] {
  const photos = media.filter(item => !isVideo(item.src))
  if (photos.length) return photos
  const video = media.find(item => isVideo(item.src))
  return video ? [{ ...video, src: posterOf(video.src) }] : []
}
