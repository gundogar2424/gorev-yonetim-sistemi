// HTTP: APK icinde CapacitorHttp (CORS engeline takilmaz), tarayicida fetch.
import { Capacitor } from '@capacitor/core'

interface Req {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export async function httpJson<T>({ url, method = 'GET', headers = {}, body, timeoutMs = 30000 }: Req): Promise<T> {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: body,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      responseType: 'json'
    })
    const data = typeof res.data === 'string' ? safeParse(res.data) : res.data
    if (res.status < 200 || res.status >= 300) throw new HttpError(res.status, data)
    return data as T
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method, headers, body, signal: ctrl.signal })
    const text = await res.text()
    const data = safeParse(text)
    if (!res.ok) throw new HttpError(res.status, data)
    return data as T
  } finally {
    clearTimeout(t)
  }
}

export class HttpError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ??
      (typeof data === 'string' ? data.slice(0, 160) : `HTTP ${status}`)
    super(msg)
    this.status = status
    this.data = data
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
