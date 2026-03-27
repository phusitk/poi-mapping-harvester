/**
 * Shared helper — captures NextResponse.json() calls so tests
 * can inspect the returned body and HTTP status without a real
 * HTTP server.
 */
import { vi } from 'vitest'

export function mockNextResponse() {
  vi.mock('next/server', () => ({
    NextResponse: {
      json: vi.fn((body, init) => ({
        _body: body,
        _status: init?.status ?? 200,
        json: async () => body,
      })),
    },
  }))
}

/** Read body + status from a mocked NextResponse return value */
export function getResponse(ret) {
  return { body: ret._body, status: ret._status }
}
