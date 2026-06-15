import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import MoneyField from '@/components/moneyField.vue'

function mountField(props: Record<string, unknown> = {}) {
  return mount(MoneyField, {
    props: {
      inputId: 'group-min_amount_cents',
      field: 'min_amount_cents',
      label: 'Smallest amount',
      currency: 'USD',
      testid: 'group-min-amount',
      ...props,
    },
    global: { plugins: [PrimeVue] },
  })
}

describe('moneyField.vue', () => {
  it('prefixes the field with the currency symbol', () => {
    expect(mountField().text()).toContain('$')
    expect(mountField({ currency: 'JPY' }).text()).toContain('¥')
  })

  it('threads the testid through to the underlying input so e2e can drive it', () => {
    const input = mountField().get('[data-testid="group-min-amount"]')
    expect(input.element.tagName).toBe('INPUT')
  })

  it('names the currency in the input accessible name for screen readers', () => {
    const input = mountField({ currency: 'JPY' }).get('[data-testid="group-min-amount"]')
    expect(input.attributes('aria-label')).toBe('Smallest amount (JPY)')
  })

  it('associates the label with the input', () => {
    const wrapper = mountField()
    expect(wrapper.get('label').attributes('for')).toBe('group-min_amount_cents')
    expect(wrapper.get('#group-min_amount_cents').element.tagName).toBe('INPUT')
  })

  it('requests a decimal keypad so mobile users can enter fractional amounts', () => {
    const input = mountField().get('[data-testid="group-min-amount"]')
    expect(input.attributes('inputmode')).toBe('decimal')
  })
})
