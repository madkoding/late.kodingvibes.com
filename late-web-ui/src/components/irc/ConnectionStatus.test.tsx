import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ConnectionStatus from './ConnectionStatus'

describe('ConnectionStatus', () => {
  it('renders connected state', () => {
    const { container } = render(<ConnectionStatus connected={true} nick="alice" />)
    expect(container.textContent).toContain('alice')
    const dot = container.querySelector('.bg-emerald-400')
    expect(dot).not.toBeNull()
  })

  it('renders disconnected state', () => {
    const { container } = render(<ConnectionStatus connected={false} nick="alice" />)
    expect(container.textContent).toContain('alice')
    const dot = container.querySelector('.bg-rose-400')
    expect(dot).not.toBeNull()
  })

  it('renders clickable nick when onChangeNick provided', () => {
    const onChangeNick = vi.fn()
    const { container } = render(<ConnectionStatus connected={true} nick="alice" onChangeNick={onChangeNick} />)
    const button = container.querySelector('button')
    expect(button).not.toBeNull()
  })
})
