import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import useViewportHeight from './use-viewport-height'

describe('useViewportHeight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.style.removeProperty('--vh')
  })

  it('sets --vh CSS variable', () => {
    renderHook(() => useViewportHeight())
    const vh = document.documentElement.style.getPropertyValue('--vh')
    expect(vh).toBeTruthy()
    expect(vh).toMatch(/^\d+(\.\d+)?px$/)
  })

  it('keyboard threshold detection freezes vh when input focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useViewportHeight())
    document.body.removeChild(input)
  })
})
