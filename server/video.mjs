import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'

const run = promisify(execFile)
/** Longest accepted clip; product videos are short showcase loops. */
export const MAX_VIDEO_SECONDS = 180

/**
 * Transcodes an uploaded clip to a muted H.264 MP4 (browsers only autoplay muted video) with the
 * moov atom up front so playback starts before the download ends, and writes its first frame as WebP.
 * Arguments are passed as an array: file names never reach a shell.
 * @returns {Promise<{ width: number, height: number }>}
 */
export async function transcodeVideo(input, output, poster, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', timeoutMs = 15 * 60 * 1000 } = {}) {
  const { stdout } = await run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', input], { timeout: 30000 })
  const probe = JSON.parse(stdout)
  const stream = probe.streams?.[0]
  const duration = Number(probe.format?.duration)
  if (!stream?.width || !stream?.height) throw new Error('No video stream')
  if (!(duration > 0) || duration > MAX_VIDEO_SECONDS) throw new Error('Video too long')
  await run(ffmpeg, [
    '-v', 'error', '-y', '-i', input,
    '-map', '0:v:0', '-an', '-sn', '-dn', '-map_metadata', '-1',
    // Fit inside 1920px, even dimensions for yuv420p.
    '-vf', "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-movflags', '+faststart', output,
  ], { timeout: timeoutMs, maxBuffer: 1024 * 1024 })
  const frame = await run(ffmpeg, ['-v', 'error', '-i', output, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { encoding: 'buffer', timeout: 60000, maxBuffer: 64 * 1024 * 1024 })
  const { width, height } = await sharp(frame.stdout).webp({ quality: 86 }).toFile(poster)
  return { width, height }
}
