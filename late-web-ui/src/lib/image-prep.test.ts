import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prepareImageForChat } from './image-prep'

describe('image-prep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for non-image types', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const result = await prepareImageForChat(file)
    expect(result).toBeNull()
  })

  it('returns null when createImageBitmap fails', async () => {
    const orig = globalThis.createImageBitmap
    globalThis.createImageBitmap = vi.fn().mockRejectedValue(new Error('fail'))
    const file = new File([''], 'test.png', { type: 'image/png' })
    const result = await prepareImageForChat(file)
    expect(result).toBeNull()
    globalThis.createImageBitmap = orig
  })
})
