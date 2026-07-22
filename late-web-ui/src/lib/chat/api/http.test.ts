import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, apiFetch, apiUpload } from './http'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ApiError', () => {
  it('sets status and detail', () => {
    const err = new ApiError(401, 'Unauthorized')
    expect(err.status).toBe(401)
    expect(err.detail).toBe('Unauthorized')
    expect(err.message).toBe('Unauthorized')
  })
})

describe('apiFetch', () => {
  it('sends GET with auth header', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 1 }) })
    vi.stubGlobal('fetch', mock)
    const result = await apiFetch('GET', '/api/chat/me', undefined, 'token123')
    expect(result).toEqual({ id: 1 })
    expect(mock).toHaveBeenCalledWith('/api/chat/me', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
      body: undefined,
    })
  })

  it('sends POST with body', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
    vi.stubGlobal('fetch', mock)
    await apiFetch('POST', '/api/chat/channels', { name: 'test' }, 'tok')
    expect(mock).toHaveBeenCalledWith('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ name: 'test' }),
    })
  })

  it('throws ApiError on 401', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'Unauthorized' }) })
    vi.stubGlobal('fetch', mock)
    await expect(apiFetch('GET', '/api/chat/me', undefined, 'bad')).rejects.toThrow(ApiError)
    await expect(apiFetch('GET', '/api/chat/me', undefined, 'bad')).rejects.toMatchObject({ status: 401, detail: 'Unauthorized' })
  })

  it('throws ApiError with fallback message when no detail', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) })
    vi.stubGlobal('fetch', mock)
    await expect(apiFetch('GET', '/test')).rejects.toMatchObject({ status: 500 })
  })

  it('works without token', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    vi.stubGlobal('fetch', mock)
    await apiFetch('GET', '/public')
    expect(mock).toHaveBeenCalledWith('/public', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: undefined,
    })
  })
})

describe('apiUpload', () => {
  it('sends FormData with auth header', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'att1' }) })
    vi.stubGlobal('fetch', mock)
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const result = await apiUpload('/api/chat/channels/1/attachments', file, 'tok')
    expect(result).toEqual({ id: 'att1' })
    const call = mock.mock.calls[0]
    expect(call[0]).toBe('/api/chat/channels/1/attachments')
    expect(call[1].method).toBe('POST')
    expect(call[1].headers).toEqual({ Authorization: 'Bearer tok' })
    expect(call[1].body instanceof FormData).toBe(true)
  })

  it('throws ApiError on failure', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: false, status: 413, json: () => Promise.resolve({ detail: 'Too large' }) })
    vi.stubGlobal('fetch', mock)
    const file = new File(['x'], 'x.txt', { type: 'text/plain' })
    await expect(apiUpload('/upload', file)).rejects.toMatchObject({ status: 413, detail: 'Too large' })
  })
})
