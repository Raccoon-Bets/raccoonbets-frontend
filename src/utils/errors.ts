import * as Sentry from '@sentry/vue'

/**
 * An anticipated, user-facing failure (e.g. an authentication rejection) that
 * should be surfaced to the user but is not a bug worth reporting to Sentry.
 */
export class ExpectedError extends Error {}

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
  // Anticipated, user-facing failures are shown to the user but aren't bugs.
  if (error instanceof ExpectedError) return
  if (error instanceof Error) {
    Sentry.captureException(error)
  } else if (typeof error === 'string') {
    Sentry.captureMessage(error)
  }
}
