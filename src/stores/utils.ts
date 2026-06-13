import { Err, Ok } from 'ts-results'
import type { Result } from 'ts-results'
import type { APIFailure, APIResponse, Errors } from '@/stores/types'
import { ExpectedError } from '@/utils/errors'
import { global } from '@/i18n'

export class LocalizableError extends Error {
  constructor(key: string, params?: Record<string, unknown>) {
    if (params === undefined) {
      super(global.t(key))
    } else {
      super(global.t(key, params))
    }
  }
}

export function anythingToError(err: unknown): Error {
  if (err instanceof Error) return err
  return new Error(String(err))
}

function errorForResponseStatus(status: number): Error {
  if (status === 404) return new LocalizableError('error.notFound')
  if (status >= 300) {
    return new LocalizableError('error.badResponse', { status })
  }
  return new LocalizableError('error.unknown')
}

function returnErrorsForAPIResponse(failure: APIFailure): Errors {
  // Authentication failures (wrong credentials, an expired verification key) are expected,
  // user-facing rejections: surface a general error message without reporting them to Sentry.
  if (failure.response.status === 401 && failure.body.error) {
    throw new ExpectedError(failure.body.error)
  }

  // Validation errors are expected - return them
  if (failure.body.errors) return failure.body.errors

  // API internal errors are exceptional - throw
  if (failure.body.error) throw new Error(failure.body.error)

  // HTTP status errors without a proper error body are unexpected - throw
  throw errorForResponseStatus(failure.response.status)
}

function throwableErrorForAPIResponse(failure: APIFailure): Error {
  if (failure.body.error) return new Error(failure.body.error)
  return errorForResponseStatus(failure.response.status)
}

// use when you expect a JSON object but don't expect validation errors
export function loadAPIResponseBodyOrThrowErrors<T>(response: APIResponse<T>): T {
  if (!response.ok) throw throwableErrorForAPIResponse(response.val)
  if (response.val.body === undefined) {
    throw new LocalizableError('error.emptyBody')
  }

  return response.val.body
}

// use when you expect a JSON object or validation errors
export function loadAPIResponseBodyOrReturnErrors<T>(response: APIResponse<T>): Result<T, Errors> {
  if (response.ok) {
    if (response.val.body === undefined) {
      // Missing body when we expect one is unexpected - throw
      throw new LocalizableError('error.emptyBody')
    } else {
      return new Ok(response.val.body)
    }
  }
  return new Err(returnErrorsForAPIResponse(response.val))
}

// use when you expect only validation errors and don't care about the JSON object
export function ignoreAPIResponseBodyOrReturnErrors(
  response: APIResponse<unknown>,
): Result<void, Errors> {
  if (response.ok) return Ok.EMPTY
  return new Err(returnErrorsForAPIResponse(response.val))
}

// The backend renders business-rule rejections (a market that isn't locked yet, the group's last
// admin, a settlement the caller isn't party to) as 403/422 with a top-level `{error}` body.
function businessRuleError(response: APIResponse<unknown>): Errors | null {
  if (response.ok) return null
  const { body, response: raw } = response.val
  if ((raw.status === 422 || raw.status === 403) && body.error && !body.errors) {
    return { base: [body.error] }
  }
  return null
}

/**
 * Like {@link loadAPIResponseBodyOrReturnErrors}, but also returns business-rule rejections
 * (403/422 with a top-level `{error}` body) as a `base` field error instead of throwing.
 */
export function loadAPIResponseBodyOrReturnAllErrors<T>(
  response: APIResponse<T>,
): Result<T, Errors> {
  const businessErrors = businessRuleError(response)
  if (businessErrors !== null) return new Err(businessErrors)
  return loadAPIResponseBodyOrReturnErrors(response)
}

/**
 * Like {@link ignoreAPIResponseBodyOrReturnErrors}, but also returns business-rule rejections
 * (403/422 with a top-level `{error}` body) as a `base` field error instead of throwing.
 */
export function ignoreAPIResponseBodyOrReturnAllErrors(
  response: APIResponse<unknown>,
): Result<void, Errors> {
  const businessErrors = businessRuleError(response)
  if (businessErrors !== null) return new Err(businessErrors)
  return ignoreAPIResponseBodyOrReturnErrors(response)
}

// use when calling a non-JSON API
export function ignoreResponseBody(response: Response): void {
  if (!response.ok) throw errorForResponseStatus(response.status)
}
