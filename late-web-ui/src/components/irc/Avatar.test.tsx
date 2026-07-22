import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar', () => {
  it('renders with nick color', () => {
    const { container } = render(<Avatar nick="alice" />)
    const div = container.firstChild as HTMLElement
    expect(div).not.toBeNull()
    expect(div.style.backgroundColor).toBeTruthy()
    expect(div.textContent).toBe('AL')
  })

  it('renders initials from nick', () => {
    const { container } = render(<Avatar nick="bob" />)
    expect(container.textContent).toBe('BO')
  })

  it('renders ? for empty nick', () => {
    const { container } = render(<Avatar nick="" />)
    expect(container.textContent).toBe('?')
  })
})
