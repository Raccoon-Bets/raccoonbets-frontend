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

/** Display urgency of a deadline, driving the "Locks in" pill's tone. */
export type CountdownUrgency = 'normal' | 'warning' | 'alert'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/**
 * Buckets a remaining duration by how soon it expires: `alert` under an hour, `warning` under a
 * day, and `normal` at 24 hours or more.
 *
 * @param remainingMS The milliseconds until the deadline.
 * @returns The urgency bucket. Elapsed deadlines (`remainingMS` ≤ 0) return `alert`, but callers
 * hide the countdown pill entirely once a market locks.
 */
export function urgency(remainingMS: number): CountdownUrgency {
  if (remainingMS < HOUR_MS) return 'alert'
  if (remainingMS < DAY_MS) return 'warning'
  return 'normal'
}

/** The reactive pieces of a live countdown. */
export interface Countdown {
  /** Localized remaining time at day/hour/minute granularity (e.g. `2d 5h`, `45m`); reads "locked" once the deadline passes. */
  countdown: ComputedRef<string>

  /** How urgently the deadline looms; see {@link urgency}. */
  urgency: ComputedRef<CountdownUrgency>
}

/**
 * A live countdown to a deadline: a localized remaining-time string plus an urgency bucket for
 * styling, both driven by one shared ticker.
 *
 * @param deadline The instant counted down to (a ref, getter, or plain Date).
 * @returns The reactive countdown text and urgency.
 */
export default function useCountdown(deadline: MaybeRefOrGetter<Date>): Countdown {
  const { now, pause, resume } = useNow({ interval: TICK_MS, controls: true })

  // No point ticking once the deadline has passed; resume if it moves into the
  // future again (lock times are editable).
  watchEffect(() => {
    if (toValue(deadline).getTime() - now.value.getTime() <= 0) pause()
    else resume()
  })

  const remainingMS = computed(() => toValue(deadline).getTime() - now.value.getTime())

  return {
    countdown: computed(() => {
      const parts = countdownParts(remainingMS.value)
      if (parts === null) return global.t('countdown.locked')
      const { days, hours, minutes } = parts
      if (days > 0) return global.t('countdown.daysHours', { days, hours })
      if (hours > 0) return global.t('countdown.hoursMinutes', { hours, minutes })
      return global.t('countdown.minutes', { minutes })
    }),
    urgency: computed(() => urgency(remainingMS.value)),
  }
}
