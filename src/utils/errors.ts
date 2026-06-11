import * as Sentry from '@sentry/vue'

/**
 * Renders any thrown value as a human-readable message.
 *
 * @param error The thrown value.
 * @returns The error's message, or its string representation.
 */
export function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Logs an error to the console and forwards it to Sentry (when configured).
 *
 * @param error The thrown value.
 */
export function notifySentry(error: unknown): void {
  // eslint-disable-next-line no-console
  console.error(error)
  if (error instanceof Error) {
    Sentry.captureException(error)
  } else if (typeof error === 'string') {
    Sentry.captureMessage(error)
  }
}
