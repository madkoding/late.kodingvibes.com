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

export function hasImageMarker(content: string): boolean {
  return content.startsWith('__late_image__:')
}

export function extractImageUrl(content: string): string | null {
  if (!hasImageMarker(content)) return null
  const rest = content.slice('__late_image__:'.length).trim()
  if (!rest) return null
  const parts = rest.split(/\s+/)
  return parts[0] || null
}

export function extractImageUrls(content: string): string[] {
  if (!hasImageMarker(content)) return []
  const rest = content.slice('__late_image__:'.length).trim()
  if (!rest) return []
  const parts = rest.split(/\s+/)
  return parts.filter(Boolean)
}

export function extractImageCaption(content: string): string | null {
  if (!hasImageMarker(content)) return null
  const rest = content.slice('__late_image__:'.length).trim()
  if (!rest) return null
  const parts = rest.split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : null
}

export function extractImagesCaption(content: string): string | null {
  return extractImageCaption(content)
}
