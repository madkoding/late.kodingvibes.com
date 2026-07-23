export function parseStreamTitle(title: string): { track: string | null; artist: string | null } {
  const trimmed = title.trim();
  if (!trimmed) return { track: null, artist: null };
  const sep = trimmed.indexOf(" - ");
  if (sep !== -1) {
    return { artist: trimmed.slice(0, sep), track: trimmed.slice(sep + 3) };
  }
  return { track: trimmed, artist: null };
}

const ATTACHMENT_MARKERS = ['__late_audio__:', '__late_video__:', '__late_document__:', '__late_file__:', '__late_voicenote__:'] as const

export function getAttachmentMarker(content: string): { marker: string; id: string; kind: string } | null {
  for (const marker of ATTACHMENT_MARKERS) {
    const idx = content.indexOf(marker)
    if (idx >= 0) {
      const id = content.slice(idx + marker.length).trim()
      const kind = marker.replace('__late_', '').replace('__:', '').replace(':', '')
      return { marker, id, kind }
    }
  }
  return null
}

const IMAGE_PREFIX = '__late_image__:'
const IMAGE_PREFIX_FALLBACK = 'late_image__:'
const IMAGES_PREFIX = '__late_images__:'
const IMAGES_PREFIX_FALLBACK = 'late_images__:'

const ALL_IMAGE_MARKERS = [IMAGE_PREFIX, IMAGE_PREFIX_FALLBACK, IMAGES_PREFIX, IMAGES_PREFIX_FALLBACK]

export function hasImageMarker(content: string): boolean {
  return ALL_IMAGE_MARKERS.some(m => content.includes(m))
}

function findImageMarker(content: string): { marker: string; pos: number; prefixLen: number } | null {
  for (const m of ALL_IMAGE_MARKERS) {
    const idx = content.indexOf(m)
    if (idx !== -1) return { marker: m, pos: idx, prefixLen: m.length }
  }
  return null
}

export function extractImageUrl(content: string): string | null {
  let idx = content.indexOf(IMAGE_PREFIX)
  let prefixLen = IMAGE_PREFIX.length
  if (idx === -1) {
    idx = content.indexOf(IMAGE_PREFIX_FALLBACK)
    if (idx === -1) return null
    prefixLen = IMAGE_PREFIX_FALLBACK.length
  }
  return content.slice(idx + prefixLen)
}

export function extractImageCaption(content: string): string | null {
  let idx = content.indexOf(IMAGE_PREFIX)
  if (idx === -1) {
    idx = content.indexOf(IMAGE_PREFIX_FALLBACK)
    if (idx === -1) idx = findImagesPrefixPos(content)
  }
  if (idx === -1) return null
  if (idx <= 0) return null
  return content.slice(0, idx).replace(/\n+$/, '')
}

function findImagesPrefixPos(content: string): number {
  const i1 = content.indexOf(IMAGES_PREFIX)
  if (i1 !== -1) return i1
  return content.indexOf(IMAGES_PREFIX_FALLBACK)
}

export function extractImageUrls(content: string): string[] {
  const found = findImageMarker(content)
  if (!found) return []
  const rest = content.slice(found.pos + found.prefixLen)
  try {
    const parsed = JSON.parse(rest)
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string')
    return []
  } catch {
    return []
  }
}

export function extractImagesCaption(content: string): string | null {
  const idx = findImagesPrefixPos(content)
  if (idx === -1) return extractImageCaption(content)
  if (idx <= 0) return null
  return content.slice(0, idx).replace(/\n+$/, '')
}
