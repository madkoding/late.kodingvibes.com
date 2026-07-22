import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { SpectrumCanvas } from './SpectrumCanvas'

describe('SpectrumCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders canvas', () => {
    const { container } = render(<SpectrumCanvas analyser={null} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
  })

  it('draws on animation frame when analyser provided', () => {
    const analyser = new AudioContext().createAnalyser()
    const spy = vi.spyOn(window, 'requestAnimationFrame')
    render(<SpectrumCanvas analyser={analyser} />)
    expect(spy).toHaveBeenCalled()
  })
})
