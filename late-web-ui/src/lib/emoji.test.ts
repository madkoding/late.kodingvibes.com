import { describe, it, expect } from 'vitest'
import { getEmoji, listEmojis, renderEmojiShortcodes } from './emoji'

describe('emoji', () => {
  it('getEmoji returns correct svg for known name', () => {
    const result = getEmoji('smile')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('smile')
    expect(result!.svg).toContain('<svg')
    expect(result!.svg).toContain('viewBox="0 0 24 24"')
  })

  it('getEmoji returns null for unknown name', () => {
    expect(getEmoji('nonexistent')).toBeNull()
  })

  it('listEmojis returns all 28 emojis', () => {
    const all = listEmojis()
    expect(all).toHaveLength(28)
    expect(all[0].name).toBe('smile')
    expect(all[27].name).toBe('point')
  })

  it('renderEmojiShortcodes replaces :name: with svg', () => {
    const result = renderEmojiShortcodes('hello :smile: world')
    expect(result).toContain('<svg')
    expect(result).not.toContain(':smile:')
  })

  it('renderEmojiShortcodes leaves unknown shortcodes intact', () => {
    const result = renderEmojiShortcodes('hello :unknown: world')
    expect(result).toBe('hello :unknown: world')
  })

  it('renderEmojiShortcodes handles multiple shortcodes', () => {
    const result = renderEmojiShortcodes(':heart: :fire:')
    expect(result).toContain('<svg')
    expect(result.indexOf('<svg')).not.toBe(result.lastIndexOf('<svg'))
  })

  it('renderEmojiShortcodes handles text without shortcodes', () => {
    expect(renderEmojiShortcodes('plain text')).toBe('plain text')
  })
})
