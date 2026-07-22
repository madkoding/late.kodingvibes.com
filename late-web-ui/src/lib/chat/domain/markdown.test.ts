import { describe, it, expect } from 'vitest'
import { inlineMarkdown } from './markdown'

describe('inlineMarkdown', () => {
  it('renders **bold**', () => {
    const result = inlineMarkdown('hello **world**')
    expect(result).toContain('<strong>world</strong>')
  })

  it('renders *italic*', () => {
    const result = inlineMarkdown('hello *world*')
    expect(result).toContain('<em>world</em>')
  })

  it('renders ~~strikethrough~~', () => {
    const result = inlineMarkdown('hello ~~world~~')
    expect(result).toContain('<del>world</del>')
  })

  it('renders `code`', () => {
    const result = inlineMarkdown('hello `world`')
    expect(result).toContain('<code>world</code>')
  })

  it('renders links', () => {
    const result = inlineMarkdown('[click](https://example.com)')
    expect(result).toContain('<a href="https://example.com"')
    expect(result).toContain('>click</a>')
  })

  it('sanitizes <script> tags', () => {
    const result = inlineMarkdown('<script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
  })

  it('handles plain text', () => {
    expect(inlineMarkdown('hello world')).toBe('hello world')
  })

  it('handles mixed formatting', () => {
    const result = inlineMarkdown('**bold** and *italic*')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<em>italic</em>')
  })
})
