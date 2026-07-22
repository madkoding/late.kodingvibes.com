/**
 * Convert an image File to a WebP data URL at 1080p max and
 * 70% quality. Uses a canvas drawImage cycle so the result
 * lives entirely in the browser — no upload service needed.
 *
 * Returns null if the input isn't an image or if the source
 * already fits within the size cap (we still re-encode it to
 * WebP for consistent format and size savings, but the cap
 * on raw bytes is the caller's responsibility).
 */
export interface PreparedImage {
  dataUrl: string // data:image/webp;base64,...
  width: number
  height: number
  bytes: number
}

const MAX_DIM = 1920 // long-edge cap, generously above 1080p to keep quality
const QUALITY = 0.7

export async function prepareImageForChat(file: File): Promise<PreparedImage | null> {
  // Some browsers leave the type empty for clipboard images
  // (e.g. pasted from a screenshot tool). Probe with
  // createImageBitmap instead of trusting the MIME — if the
  // browser can decode it as an image, we accept it.
  if (file.type && !file.type.startsWith('image/')) return null

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return null

  const { width: srcW, height: srcH } = bitmap
  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH))
  const w = Math.round(srcW * scale)
  const h = Math.round(srcH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return null
  }
  // White background so transparent PNGs don't end up black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  // toBlob with image/webp; fall back to dataURL if the browser
  // doesn't expose toBlob for some reason.
  const dataUrl: string = await new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.readAsDataURL(blob)
        } else {
          resolve(canvas.toDataURL('image/webp', QUALITY))
        }
      },
      'image/webp',
      QUALITY,
    )
  })

  // Approximate byte size from the data URL. base64 inflates by
  // 4/3, so payload bytes = (chars - prefix) * 3/4.
  const comma = dataUrl.indexOf(',')
  const b64Len = comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length
  const bytes = Math.floor((b64Len * 3) / 4)

  return { dataUrl, width: w, height: h, bytes }
}
