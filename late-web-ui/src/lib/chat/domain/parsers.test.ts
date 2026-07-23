import { describe, it, expect } from 'vitest'
import { parseStreamTitle, getAttachmentMarker, hasImageMarker, extractImageUrl, extractImageUrls, extractImageCaption, extractImagesCaption } from './parsers'

describe('parseStreamTitle', () => {
  it('returns null for empty string', () => {
    expect(parseStreamTitle('')).toEqual({ track: null, artist: null })
  })

  it('returns null for whitespace-only string', () => {
    expect(parseStreamTitle('   ')).toEqual({ track: null, artist: null })
  })

  it('parses "Artist - Track" format', () => {
    expect(parseStreamTitle('David Bowie - Space Oddity')).toEqual({ artist: 'David Bowie', track: 'Space Oddity' })
  })

  it('handles multiple dashes in title', () => {
    expect(parseStreamTitle('The Band - Song - Live')).toEqual({ artist: 'The Band', track: 'Song - Live' })
  })

  it('returns track only when no separator', () => {
    expect(parseStreamTitle('Just a track name')).toEqual({ artist: null, track: 'Just a track name' })
  })

  it('trims whitespace', () => {
    expect(parseStreamTitle('  Artist - Track  ')).toEqual({ artist: 'Artist', track: 'Track' })
  })
})

describe('getAttachmentMarker', () => {
  it('detects audio marker', () => {
    const result = getAttachmentMarker('__late_audio__:abc123')
    expect(result).toEqual({ marker: '__late_audio__:', id: 'abc123', kind: 'audio' })
  })

  it('detects video marker', () => {
    const result = getAttachmentMarker('__late_video__:xyz789')
    expect(result).toEqual({ marker: '__late_video__:', id: 'xyz789', kind: 'video' })
  })

  it('detects document marker', () => {
    const result = getAttachmentMarker('__late_document__:doc1')
    expect(result).toEqual({ marker: '__late_document__:', id: 'doc1', kind: 'document' })
  })

  it('detects file marker', () => {
    const result = getAttachmentMarker('__late_file__:file1')
    expect(result).toEqual({ marker: '__late_file__:', id: 'file1', kind: 'file' })
  })

  it('detects voicenote marker', () => {
    const result = getAttachmentMarker('__late_voicenote__:vn1')
    expect(result).toEqual({ marker: '__late_voicenote__:', id: 'vn1', kind: 'voicenote' })
  })

  it('returns null for plain text', () => {
    expect(getAttachmentMarker('hello world')).toBeNull()
  })

  it('trims whitespace after marker', () => {
    const result = getAttachmentMarker('__late_audio__:  abc123  ')
    expect(result?.id).toBe('abc123')
  })
})

describe('hasImageMarker', () => {
  it('returns true for __late_image__:', () => {
    expect(hasImageMarker('__late_image__:img1')).toBe(true)
  })

  it('returns true for late_image__: (fallback)', () => {
    expect(hasImageMarker('late_image__:img1')).toBe(true)
  })

  it('returns true for __late_images__:', () => {
    expect(hasImageMarker('__late_images__:["a"]')).toBe(true)
  })

  it('returns false for other markers', () => {
    expect(hasImageMarker('__late_audio__:x')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(hasImageMarker('hello')).toBe(false)
  })
})

describe('extractImageUrl', () => {
  it('extracts url from __late_image__:', () => {
    expect(extractImageUrl('__late_image__:img123')).toBe('img123')
  })

  it('extracts url from late_image__: (fallback)', () => {
    expect(extractImageUrl('late_image__:img123')).toBe('img123')
  })

  it('returns null for non-image content', () => {
    expect(extractImageUrl('hello')).toBeNull()
  })
})

describe('extractImageUrls', () => {
  it('parses JSON array from __late_images__:', () => {
    expect(extractImageUrls('__late_images__:["a","b","c"]')).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array for non-image', () => {
    expect(extractImageUrls('hello')).toEqual([])
  })

  it('returns empty array for malformed JSON', () => {
    expect(extractImageUrls('__late_images__:not-json')).toEqual([])
  })
})

describe('extractImageCaption', () => {
  it('extracts caption before __late_image__:', () => {
    expect(extractImageCaption('my caption __late_image__:img1')).toBe('my caption ')
  })

  it('returns null when no caption', () => {
    expect(extractImageCaption('__late_image__:img1')).toBeNull()
  })

  it('returns null for non-image', () => {
    expect(extractImageCaption('hello')).toBeNull()
  })
})

describe('extractImagesCaption', () => {
  it('extracts caption before __late_images__:', () => {
    expect(extractImagesCaption('my caption __late_images__:["a"]')).toBe('my caption ')
  })

  it('falls back to extractImageCaption for __late_image__:', () => {
    expect(extractImagesCaption('caption __late_image__:img1')).toBe('caption ')
  })
})
