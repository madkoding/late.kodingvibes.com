import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import EmojiPicker from './EmojiPicker'

describe('EmojiPicker', () => {
  it('renders grid', () => {
    const { container } = render(<EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('click calls onEmojiSelect', () => {
    const onSelect = vi.fn()
    const { container } = render(<EmojiPicker onSelect={onSelect} onClose={vi.fn()} />)
    const firstButton = container.querySelector('button')
    firstButton?.click()
    expect(onSelect).toHaveBeenCalled()
  })
})
