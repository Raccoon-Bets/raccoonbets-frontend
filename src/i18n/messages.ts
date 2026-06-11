import type { LocaleMessage } from '@intlify/core-base'
import type { VueMessageType } from 'vue-i18n'
import en from '@/i18n/en/messages'

// v1 ships English only. When a locale with a substantial catalog is added, code-split it and
// lazy-load from index.ts rather than bundling it eagerly here.
const messages: Record<string, LocaleMessage<VueMessageType>> = {
  en,
}
export default messages
