import type { NumberFormat } from '@intlify/core-base'

const en: NumberFormat = {
  // The currency is always overridden per call with the group's currency:
  // n(amount, { key: 'currency', currency: group.currency })
  currency: {
    style: 'currency',
    currency: 'USD',
  },
}
export default en
