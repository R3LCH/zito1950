import { img } from '../lib/asset'
import { dims } from '../lib/imageMeta'
import { useShop } from '../lib/shop'

interface PictureProps {
  /** Public path to the JPG, e.g. "img/storia/scalea-borgo.jpg"; the .webp sibling is used when supported. */
  src: string
  alt: string
  sizes?: string
  className?: string
  /** Class for the <picture> wrapper. */
  pictureClassName?: string
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
  width?: number
  height?: number
}

export default function Picture({
  src,
  alt,
  sizes,
  className,
  pictureClassName,
  loading = 'lazy',
  fetchPriority,
  width,
  height,
}: PictureProps) {
  const { catalog } = useShop()
  const replacement = catalog.imageOverrides[src]
  const resolved = replacement?.src ?? src
  const s = img(resolved)
  // Intrinsic size reserves layout space before load, so anchor scrolling doesn't drift.
  const d = dims(resolved)
  return (
    <picture className={pictureClassName}>
      <source type="image/webp" srcSet={s.webp} sizes={sizes} />
      <img
        src={s.src}
        alt={replacement?.alt ?? alt}
        sizes={sizes}
        className={className}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        width={width ?? d?.w}
        height={height ?? d?.h}
      />
    </picture>
  )
}
