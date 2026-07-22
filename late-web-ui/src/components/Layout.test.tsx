import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Layout } from './Layout'

describe('Layout', () => {
  it('renders children and footer', () => {
    const { getByText } = render(
      <Layout>
        <div>content</div>
      </Layout>,
    )
    expect(getByText('content')).toBeDefined()
    expect(getByText('late.kodingvibes.com')).toBeDefined()
    expect(getByText('kodingvibes')).toBeDefined()
  })
})
