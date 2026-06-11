// Setup file for Vitest
// This ensures localStorage and document.cookie are properly available in the
// test environment

import { beforeEach } from 'vitest'

// jsdom's real cookie jar rejects cookies whose Domain doesn't match the test
// origin (the auth cookies are scoped to the configured apex domain), so
// replace document.cookie with a simple store that honors name/value and
// Max-Age expiry while ignoring the other attributes.
let cookieStore: Record<string, string> = {}

Object.defineProperty(document, 'cookie', {
  configurable: true,
  get: () =>
    Object.entries(cookieStore)
      .map(([name, value]) => `${name}=${value}`)
      .join('; '),
  set: (serialized: string) => {
    const [pair = '', ...attributes] = serialized.split(';')
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) return
    const name = pair.slice(0, separatorIndex).trim()
    const value = pair.slice(separatorIndex + 1).trim()
    const maxAge = attributes
      .map((attribute) => attribute.trim())
      .find((attribute) => attribute.toLowerCase().startsWith('max-age='))
    if (maxAge && Number(maxAge.split('=')[1]) <= 0) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete cookieStore[name]
    } else {
      cookieStore[name] = value
    }
  },
})

beforeEach(() => {
  cookieStore = {}
})

// Ensure localStorage has all required methods before any modules load
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    },
  }
})()

// Override localStorage completely
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})
