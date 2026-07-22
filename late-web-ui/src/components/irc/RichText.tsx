import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { renderEmojiShortcodes } from '../../lib/emoji'

interface RichTextProps {
  text: string
  members?: { id: number; display_name: string }[]
  isOwn?: boolean
}

/**
 * Render a message body as markdown.
 *
 * Why a custom mini-renderer instead of dropping react-markdown in:
 * - The chat is the most-used screen in the app, so the bundle cost
 *   of pulling in a full markdown runtime is real.
 * - We have a single pre-baked "shape" we want (paragraphs, inline
 *   bold/italic/code, links, lists, blockquote, code blocks, tables,
 *   hr, br, strikethrough). No need for the kitchen sink.
 * - Headings (#, ##, …) are explicitly dropped per the product
 *   decision: the chat isn't a doc, it's a stream of thoughts.
 *
 * @mention handling: we escape any '@' + known display_name before
 * the markdown pass and put it back as <strong> via a sentinel
 * placeholder, then the post-processor re-injects the markup. This
 * lets marked keep the token intact instead of escaping or mangling
 * it inside code spans or link URLs.
 */
export default function RichText({ text, members, isOwn }: RichTextProps) {
  const html = useMemo(() => renderMarkdown(text, members, isOwn), [text, members, isOwn])

  return (
    <div
      className={`rich-text ${isOwn ? 'rich-text-own' : ''}`}
      // Sanitized: marked output is HTML, and even though marked
      // tries to escape raw HTML inside text tokens, DOMPurify
      // is the canonical XSS guard for user-supplied markup.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function renderMarkdown(
  text: string,
  members: { id: number; display_name: string }[] | undefined,
  _isOwn: boolean | undefined,
): string {
  // 1) Replace :name: shortcodes with inline SVG emoji.
  //    Done before the markdown pass so marked doesn't try
  //    to parse colons inside the SVG path data.
  const withEmojis = renderEmojiShortcodes(text)

  // 2) Mass mentions: @todos, @all, @here, @aqui, @channel, @everyone
  const withMassMentions = withEmojis.replace(
    /@(todos|all|here|aqui|channel|everyone)\b/gi,
    '<strong class="mention mention-mass">@$1</strong> ',
  )

  // 3) Protect mentions: replace @nick with a placeholder so
  //    marked doesn't interpret characters in the nick as
  //    markdown syntax.
  const protectedText = protectMentions(withMassMentions, members)

  // 2) Parse with marked. Headings and other unwanted nodes
  //    are filtered out in the custom walk below. We disable
  //    headings directly in marked as a first line of defense.
  const renderer = new marked.Renderer()
  // Drop headings entirely. Walk every text token and if a
  // line starts with #s, just emit the line as a plain
  // paragraph. marked has no built-in 'no headings' switch,
  // so we override the heading() callback to return ''.
  // marked calls heading(token) for each heading token in the
  // AST. Returning '' strips it; the surrounding paragraphs
  // are unaffected.
  renderer.heading = () => ''
  // Strip <hr> for now too — chats don't need horizontal rules.
  // (User can ask to add it back if needed.)
  renderer.hr = () => ''
  // Render plain autolinks without a label.
  renderer.link = (token) => {
    const href = token.href
    const title = token.title ? ` title="${escapeAttr(token.title)}"` : ''
    return `<a href="${escapeAttr(href)}"${title} target="_blank" rel="noopener noreferrer">${escapeHtml(token.text)}</a>`
  }

  const rawHtml = marked.parse(protectedText, {
    gfm: true,
    breaks: true,
    renderer,
  }) as string

  // 3) Run the HTML through DOMPurify with a tight allowlist.
  //    The 'rich-text' wrapper class is added on the
  //    <div className="rich-text"> in the component, not on
  //    individual elements.
  const sanitized = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'del', 'code', 'pre',
      'blockquote', 'ul', 'ol', 'li',
      'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'span', 'hr',
      'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'class', 'target', 'rel',
      'viewbox', 'width', 'height', 'fill', 'stroke',
      'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'd', 'points',
    ],
    ALLOW_DATA_ATTR: false,
  })

  // Mentions were already injected as <strong class="mention">
  // tags in protectMentions(). marked parsed them as inline
  // HTML, DOMPurify kept them. No post-processing needed.
  return sanitized
}

function protectMentions(
  text: string,
  members: { id: number; display_name: string }[] | undefined,
): string {
  if (!members || members.length === 0) return text
  // Sort by length desc so 'mr' doesn't match inside 'mrman'
  // before 'mrman' is replaced.
  const nicks = members
    .map(m => m.display_name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (nicks.length === 0) return text
  // Replace @nick with a literal HTML <strong> that marked
  // parses as inline HTML and DOMPurify passes through.
  // The nick is HTML-escaped so a nick like '<script>' can't
  // inject markup. The trailing ' ' after the </strong>
  // keeps the next word from running into the closing tag.
  const pattern = new RegExp(`@(${nicks.map(escapeRe).join('|')})(?=\\b)`, 'g')
  return text.replace(pattern, (_, name) => {
    return `<strong class="mention">@${escapeHtml(name)}</strong> `
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
