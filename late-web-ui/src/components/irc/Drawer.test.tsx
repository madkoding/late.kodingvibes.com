import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import Drawer from './Drawer'

describe('Drawer', () => {
  it('renders null when closed', () => {
    const { container } = render(
      <Drawer open={false} onClose={vi.fn()}>
        <div>content</div>
      </Drawer>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders children when open', () => {
    const { getByText } = render(
      <Drawer open={true} onClose={vi.fn()}>
        <div>content</div>
      </Drawer>,
    )
    expect(getByText('content')).toBeDefined()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(
      <Drawer open={true} onClose={onClose}>
        <div>content</div>
      </Drawer>,
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalled()
  })
})
