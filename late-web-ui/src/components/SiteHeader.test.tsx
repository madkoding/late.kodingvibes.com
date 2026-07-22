import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import SiteHeader from './SiteHeader'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: any) => <a href={to} className={className}>{children}</a>,
  useLocation: vi.fn(),
}))

import { useLocation } from 'react-router-dom'

describe('SiteHeader', () => {
  beforeEach(() => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/', search: '', hash: '', state: null, key: '' })
  })

  it('renders version pill', () => {
    const { container } = render(<SiteHeader />)
    expect(container.textContent).toContain('v1.23.0')
  })

  it('renders nav links', () => {
    const { getAllByText } = render(<SiteHeader />)
    expect(getAllByText('Radio').length).toBeGreaterThan(0)
    expect(getAllByText('Chat').length).toBeGreaterThan(0)
  })

  it('active state for /icecast path', () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/icecast', search: '', hash: '', state: null, key: '' })
    const { container } = render(<SiteHeader />)
    const links = container.querySelectorAll('a')
    const radioLink = Array.from(links).find(l => l.textContent?.includes('Radio'))
    expect(radioLink?.className).toContain('bg-indigo-500')
  })
})
