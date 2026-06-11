import { computed, toValue, watchEffect, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { useNow } from '@vueuse/core'
import { global } from '@/i18n'

/** How often the countdown re-evaluates. Minute granularity makes a 30s tick plenty. */
const TICK_MS = 30_000

/** A remaining duration broken into calendar-style parts for display. */
export interface CountdownParts {
  days: number
  hours: number
  minutes: number
}

/**
 * Breaks a remaining duration into days/hours/minutes, rounding the total up to whole minutes so
 * a countdown never shows "0m" while time actually remains.
 *
 * @param remainingMS The milliseconds until the deadline.
 * @returns The parts, or `null` when the deadline has passed.
 */
export function countdownParts(remainingMS: number): CountdownParts | null {
  if (remainingMS <= 0) return null
  const totalMinutes = Math.ceil(remainingMS / 60_000)
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  }
}

/**
 * A live countdown to a deadline, as a localized string at day/hour/minute granularity (e.g.
 * `2d 5h`, `45m`). Once the deadline passes it reads "locked".
 *
 * @param deadline The instant counted down to (a ref, getter, or plain Date).
 * @returns The reactive countdown string.
 */
export default function useCountdown(deadline: MaybeRefOrGetter<Date>): ComputedRef<string> {
  const { now, pause, resume } = useNow({ interval: TICK_MS, controls: true })

  // No point ticking once the deadline has passed; resume if it moves into the
  // future again (lock times are editable).
  watchEffect(() => {
    if (toValue(deadline).getTime() - now.value.getTime() <= 0) pause()
    else resume()
  })

  return computed(() => {
    const parts = countdownParts(toValue(deadline).getTime() - now.value.getTime())
    if (parts === null) return global.t('countdown.locked')
    const { days, hours, minutes } = parts
    if (days > 0) return global.t('countdown.daysHours', { days, hours })
    if (hours > 0) return global.t('countdown.hoursMinutes', { hours, minutes })
    return global.t('countdown.minutes', { minutes })
  })
}
