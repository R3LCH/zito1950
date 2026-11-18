import { useEffect, useRef, useState } from 'react'
import { asset } from '../lib/asset'
import { posterOf } from '../data/media'
import { t } from '../lib/i18n'

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * Product video inside the open dialog: muted autoplay loop (browsers allow only muted autoplay), a
 * play/pause button and a seek bar. Reduced-motion users start paused on the first frame.
 */
export default function ProductVideo({ src, label, width, height }: { src: string; label: string; width?: number; height?: number }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const video = ref.current
    if (!video || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // play() rejects when the browser blocks autoplay (e.g. power saving); the play button stays available.
    video.play().catch(() => setPlaying(false))
  }, [src])

  const toggle = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) void video.play().catch(() => setPlaying(false))
    else video.pause()
  }

  return (
    <figure className="w-full">
      <div className="relative overflow-hidden bg-well" style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}>
        <video
          ref={ref}
          src={asset(src)}
          poster={asset(posterOf(src))}
          width={width}
          height={height}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={label}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          className="block h-full w-full cursor-pointer object-contain"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t('Metti in pausa il video') : t('Riproduci il video')}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-ink transition-colors duration-200 hover:border-ink"
        >
          {playing ? (
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2.5" y="2" width="3" height="10" /><rect x="8.5" y="2" width="3" height="10" /></svg>
          ) : (
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3.5 1.8v10.4L12 7z" /></svg>
          )}
        </button>
        <input
          type="range"
          className="video-seek min-w-0 flex-1"
          min={0}
          max={duration || 0}
          step="any"
          value={Math.min(time, duration || 0)}
          disabled={!duration}
          aria-label={t('Posizione nel video')}
          aria-valuetext={`${clock(time)} / ${clock(duration)}`}
          style={{ '--seek': `${duration ? (time / duration) * 100 : 0}%` } as React.CSSProperties}
          onChange={(e) => {
            const video = ref.current
            if (!video) return
            video.currentTime = Number(e.target.value)
            setTime(video.currentTime)
          }}
        />
        <span className="w-[4.5rem] shrink-0 text-right text-xs tabular-nums text-muted" aria-hidden="true">{clock(time)} / {clock(duration)}</span>
      </div>
    </figure>
  )
}
