import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function inlineMarkdown(text: string): string {
  const raw = marked.parseInline(text, { gfm: true, breaks: true }) as string
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  })
}
