export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export async function apiFetch<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = `${method} ${path} failed: ${res.status}`
    try {
      const json = await res.json()
      if (json.detail) detail = json.detail
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

export async function apiUpload<T>(path: string, file: File, token?: string): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { method: 'POST', headers, body: formData })
  if (!res.ok) {
    let detail = `Upload failed: ${res.status}`
    try {
      const json = await res.json()
      if (json.detail) detail = json.detail
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}
