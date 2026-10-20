import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia, type TestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import type { McpConnection, McpConsent } from '@/types'
import McpConsentView from '@/views/auth/mcpConsent.vue'
import Connections from '@/components/account/connections.vue'
import { useMcpConnectionsStore } from '@/stores/modules/mcpConnections'
import i18n from '@/i18n'
import { JWT } from '../util'

vi.mock('@/composables/requireAuth', () => ({ default: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: vi.fn() }))

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function consent(overrides: Partial<McpConsent> = {}): McpConsent {
  return {
    clientName: 'Assistant',
    redirectHost: 'assistant.example',
    writeRequested: true,
    lifetimeDays: 30,
    groups: [
      { id: 7, name: 'Raccoons' },
      { id: 9, name: 'Foxes' },
    ],
    account: { name: 'Sancho', email: 'sancho@example.com' },
    ...overrides,
  }
}

function loggedInPinia(): TestingPinia {
  return createTestingPinia({ createSpy: vi.fn, initialState: { auth: { JWT } } })
}

function mountWith<C>(component: C, pinia: TestingPinia) {
  return mount(component, { global: { plugins: [pinia, i18n, PrimeVue] } })
}

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
    const pinia = loggedInPinia()
    const store = useMcpConnectionsStore(pinia)
    vi.mocked(store.loadConsent).mockResolvedValue(consent())
    vi.mocked(store.approve).mockResolvedValue('https://assistant.example/callback?code=one')
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    const wrapper = mountWith(McpConsentView, pinia)
    await flushPromises()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    const choices = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(choices.every((input) => !input.element.checked)).toBe(true)
    await choices[0].setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(store.approve).toHaveBeenCalledWith('pending', [7], false)
    expect(assign).toHaveBeenCalledWith('https://assistant.example/callback?code=one')
  })

  it('keeps the displayed client and decision bound together when consent loads arrive out of order', async () => {
    const pinia = loggedInPinia()
    const store = useMcpConnectionsStore(pinia)
    const first = deferred<McpConsent>()
    const second = deferred<McpConsent>()
    vi.mocked(store.loadConsent)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    vi.mocked(store.approve).mockResolvedValue('https://second.example/callback?code=two')
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    const wrapper = mountWith(McpConsentView, pinia)
    useRoute().params.requestId = 'second'
    await flushPromises()
    const details = consent({
      clientName: 'Second Assistant',
      redirectHost: 'second.example',
      writeRequested: false,
      groups: [{ id: 9, name: 'Foxes' }],
    })
    second.resolve(details)
    await flushPromises()
    first.resolve({ ...details, clientName: 'First Assistant', redirectHost: 'first.example' })
    await flushPromises()
    expect(wrapper.text()).toContain('Second Assistant')
    expect(wrapper.text()).not.toContain('First Assistant')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(store.approve).toHaveBeenCalledWith('second', [9], false)
    expect(assign).toHaveBeenCalledWith('https://second.example/callback?code=two')
    wrapper.unmount()
  })

  it('confirms before revoking and keeps a failed revocation visible', async () => {
    const pinia = loggedInPinia()
    const store = useMcpConnectionsStore(pinia)
    const connection: McpConnection = {
      id: 2,
      clientName: 'Assistant',
      canAct: false,
      groups: [{ id: 7, name: 'Raccoons' }],
      expiresAt: new Date('2099-01-01T00:00:00Z'),
    }
    vi.mocked(store.loadConnections).mockImplementation(() => {
      store.connections = {
        enabled: true,
        serverURL: 'https://api.example/mcp',
        connections: [connection],
      }
      return Promise.resolve()
    })
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    vi.mocked(store.revoke).mockRejectedValueOnce(new Error('Try again'))
    const wrapper = mountWith(Connections, pinia)
    await flushPromises()
    const revoke = wrapper.get('button[aria-label="Revoke access for Assistant"]')

    await revoke.trigger('click')
    expect(store.revoke).not.toHaveBeenCalled()

    await revoke.trigger('click')
    await flushPromises()
    expect(store.revoke).toHaveBeenCalledWith(connection)
    expect(wrapper.get('[role="alert"]').text()).toContain('Try again')
  })
})
