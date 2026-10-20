import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import type { Consent } from '@/services/mcp'
import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import McpConsent from '@/views/auth/mcpConsent.vue'
import Connections from '@/components/account/connections.vue'
import i18n from '@/i18n'

const api = vi.hoisted(() => ({
  loadConsent: vi.fn(),
  decideConsent: vi.fn(),
  denyConsent: vi.fn(),
  loadConnections: vi.fn(),
  revokeConnection: vi.fn(),
}))
vi.mock('@/services/mcp', () => api)
vi.mock('@/composables/requireAuth', () => ({ default: vi.fn() }))
vi.mock('@/stores/modules/auth', () => ({ useAuthStore: () => ({ loggedIn: true }) }))
vi.mock('vue-router', () => ({ useRoute: vi.fn() }))

function pendingConsent(): { promise: Promise<Consent>; resolve: (value: Consent) => void } {
  let resolve!: (value: Consent) => void
  const promise = new Promise<Consent>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

const mountOptions = { global: { plugins: [i18n, PrimeVue] } }

describe('assistant consent', () => {
  beforeEach(() => {
    vi.mocked(useRoute, { partial: true }).mockReturnValue(
      reactive({ params: { requestId: 'pending' } }),
    )
  })
  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  it('requires explicit group selection, defaults to read-only, and submits the chosen access', async () => {
    api.loadConsent.mockResolvedValue({
      client_name: 'Assistant',
      redirect_uri: 'https://assistant.example/callback',
      write_requested: true,
      groups: [
        { id: 7, name: 'Raccoons' },
        { id: 9, name: 'Foxes' },
      ],
    })
    api.decideConsent.mockResolvedValue('https://assistant.example/callback?code=one')
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    const wrapper = mount(McpConsent, mountOptions)
    await flushPromises()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    const choices = wrapper.findAll('input[type="checkbox"]')
    expect(choices.every((input) => !(input.element as HTMLInputElement).checked)).toBe(true)
    await choices[0].setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.decideConsent).toHaveBeenCalledWith('pending', [7], false)
    expect(assign).toHaveBeenCalledWith('https://assistant.example/callback?code=one')
  })

  it('keeps the displayed client and decision bound together when consent loads arrive out of order', async () => {
    const first = pendingConsent()
    const second = pendingConsent()
    api.loadConsent.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    api.decideConsent.mockResolvedValue('https://second.example/callback?code=two')
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    const wrapper = mount(McpConsent, mountOptions)
    useRoute().params.requestId = 'second'
    await flushPromises()
    const details = {
      client_name: 'Second Assistant',
      redirect_uri: 'https://second.example/callback',
      write_requested: false,
      groups: [{ id: 9, name: 'Foxes' }],
    }
    second.resolve(details)
    await flushPromises()
    first.resolve({
      ...details,
      client_name: 'First Assistant',
      redirect_uri: 'https://first.example/callback',
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Second Assistant')
    expect(wrapper.text()).not.toContain('First Assistant')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.decideConsent).toHaveBeenCalledWith('second', [9], false)
    expect(assign).toHaveBeenCalledWith('https://second.example/callback?code=two')
    wrapper.unmount()
  })

  it('keeps a failed revocation visible and refreshes the connection after success', async () => {
    const connection = {
      id: 2,
      client_name: 'Assistant',
      scopes: ['mcp:read'],
      groups: [{ id: 7, name: 'Raccoons' }],
      expires_at: '2099-01-01T00:00:00Z',
      revoked_at: null,
    }
    api.loadConnections.mockResolvedValue({ enabled: true, connections: [connection] })
    api.revokeConnection.mockRejectedValueOnce(new Error('Try again'))
    const wrapper = mount(Connections, mountOptions)
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Try again')
    api.revokeConnection.mockResolvedValue(undefined)
    api.loadConnections.mockResolvedValue({
      enabled: true,
      connections: [{ ...connection, revoked_at: '2026-10-20T12:00:00Z' }],
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Revoked')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
