import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MarqueeLink } from './MarqueeLink'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: any) => <a href={to} className={className}>{children}</a>,
}))

describe('MarqueeLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Link', () => {
    const { container } = render(<MarqueeLink to="/icecast" text="hello" />)
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('/icecast')
  })

  it('renders without marquee when no overflow', () => {
    const { container } = render(<MarqueeLink to="/icecast" text="short" />)
    const link = container.querySelector('a')
    expect(link!.className).toContain('truncate')
  })
})
