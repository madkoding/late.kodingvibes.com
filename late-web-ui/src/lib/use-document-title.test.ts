import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import useDocumentTitle from './use-document-title'

vi.mock('react-router-dom', () => ({
  useLocation: vi.fn(),
}))

import { useLocation } from 'react-router-dom'

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = ''
  })

  it('sets document.title based on pathname /', () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/', search: '', hash: '', state: null, key: '' })
    renderHook(() => useDocumentTitle())
    expect(document.title).toBe('late.kodingvibes.com — un rinconcito comfy, tarde en la noche')
  })

  it('sets document.title for /icecast', () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/icecast', search: '', hash: '', state: null, key: '' })
    renderHook(() => useDocumentTitle())
    expect(document.title).toBe('icecast · late.kodingvibes.com')
  })

  it('sets document.title for /irc', () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/irc', search: '', hash: '', state: null, key: '' })
    renderHook(() => useDocumentTitle())
    expect(document.title).toBe('chat · late.kodingvibes.com')
  })

  it('uses fallback for unknown path', () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/unknown', search: '', hash: '', state: null, key: '' })
    renderHook(() => useDocumentTitle('fallback title'))
    expect(document.title).toBe('fallback title')
  })
})
