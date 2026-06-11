import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import useSubdomainAvailability from '@/composables/useSubdomainAvailability'

describe('useSubdomainAvailability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags format problems immediately without calling the checker', async () => {
    const check = vi.fn()
    const subdomain = ref('')
    const status = useSubdomainAvailability(subdomain, check)

    subdomain.value = 'Not A Slug!'
    await nextTick()

    expect(status.value).toBe('invalid')
    await vi.runAllTimersAsync()
    expect(check).not.toHaveBeenCalled()
  })

  it('flags reserved names locally', async () => {
    const check = vi.fn()
    const subdomain = ref('')
    const status = useSubdomainAvailability(subdomain, check)

    subdomain.value = 'www'
    await nextTick()

    expect(status.value).toBe('reserved')
    await vi.runAllTimersAsync()
    expect(check).not.toHaveBeenCalled()
  })

  it('returns to idle when the field is cleared', async () => {
    const check = vi.fn()
    const subdomain = ref('')
    const status = useSubdomainAvailability(subdomain, check)

    subdomain.value = 'den'
    await nextTick()
    subdomain.value = ''
    await nextTick()

    expect(status.value).toBe('idle')
    await vi.runAllTimersAsync()
    expect(check).not.toHaveBeenCalled()
  })

  it('debounces the check and reports availability', async () => {
    const check = vi.fn().mockResolvedValue(true)
    const subdomain = ref('')
    const status = useSubdomainAvailability(subdomain, check)

    subdomain.value = 'Trash-Pandas ' // normalized before checking
    await nextTick()
    expect(status.value).toBe('checking')

    await vi.advanceTimersByTimeAsync(299)
    expect(check).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(check).toHaveBeenCalledExactlyOnceWith('trash-pandas')
    await vi.runAllTimersAsync()
    expect(status.value).toBe('available')
  })

  it('reports a taken subdomain', async () => {
    const check = vi.fn().mockResolvedValue(false)
    const subdomain = ref('')
    const status = useSubdomainAvailability(subdomain, check)

    subdomain.value = 'cypress-den'
    await nextTick()
    await vi.runAllTimersAsync()

    expect(status.value).toBe('taken')
  })

  it('discards responses superseded by further typing', async () => {
    let resolveFirst!: (available: boolean) => void
    const check = vi
      .fn<(subdomain: string) => Promise<boolean>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce(false)
    const subdomain = ref('')
    const status = useSubdomainAvailability(subdomain, check)

    subdomain.value = 'first'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    subdomain.value = 'second'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    await vi.runAllTimersAsync()
    expect(status.value).toBe('taken')

    // The stale "available" answer for "first" must not clobber the result.
    resolveFirst(true)
    await vi.runAllTimersAsync()
    expect(status.value).toBe('taken')
  })

  it('reports checker failures as an error state', async () => {
    const check = vi.fn().mockRejectedValue(new Error('boom'))
    const subdomain = ref('')
    const status = useSubdomainAvailability(subdomain, check)

    subdomain.value = 'den'
    await nextTick()
    await vi.runAllTimersAsync()

    expect(status.value).toBe('error')
  })
})
