import { onScopeDispose, watch } from 'vue'
import type { Subscription } from '@rails/actioncable'
import { z, type ZodType } from 'zod'
import { useAuthStore } from '@/stores/modules/auth'
import { notifySentry } from '@/utils/errors'

/**
 * A realtime event from {@link https://github.com/anycable | AnyCable}. Every backend channel
 * broadcasts `{type, ...}` payloads; subscribers refetch what they display, so the extra fields
 * are not modeled.
 */
export const channelEventSchema = z.looseObject({ type: z.string() })

/**
 * Parses a raw Action Cable message against a schema, reporting (and swallowing) payloads that
 * don't conform.
 *
 * @param schema The Zod schema for the channel's payloads.
 * @param data The raw message from the cable.
 * @returns The parsed message, or `null` if it didn't conform.
 */
export function parseChannelMessage<T>(schema: ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  notifySentry(result.error)
  return null
}

/**
 * Subscribes the current component scope to an Action Cable channel on the auth store's
 * consumer, delivering Zod-parsed payloads to `received`.
 *
 * The subscription follows the session: it is (re)created whenever the consumer changes (the
 * auth store mints a new consumer per JWT) or the params change, and torn down when params
 * become `null` or the scope is disposed. When no cable server is reachable, Action Cable
 * retries in the background and the view simply receives no events — nothing breaks.
 *
 * @param options.channel The backend channel class name (e.g. `"GroupChannel"`).
 * @param options.params The subscription params, re-evaluated reactively; return `null` while
 *   the view isn't ready to subscribe (e.g. membership not yet confirmed).
 * @param options.schema The Zod schema for the channel's payloads.
 * @param options.received Called with each parsed payload.
 */
export default function useChannel<T>(options: {
  channel: string
  params: () => Record<string, unknown> | null
  schema: ZodType<T>
  received: (message: T) => void
}): void {
  const authStore = useAuthStore()
  let subscription: Subscription | null = null

  const unsubscribe = (): void => {
    subscription?.unsubscribe()
    subscription = null
  }

  watch(
    [() => authStore.actionCableConsumer, options.params],
    ([consumer, params]) => {
      unsubscribe()
      if (consumer === null || params === null) return
      subscription = consumer.subscriptions.create(
        { channel: options.channel, ...params },
        {
          received: (data: unknown) => {
            const message = parseChannelMessage(options.schema, data)
            if (message !== null) options.received(message)
          },
        },
      )
    },
    { immediate: true },
  )

  onScopeDispose(unsubscribe)
}
