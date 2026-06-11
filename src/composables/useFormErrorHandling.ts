import type { Result } from 'ts-results'
import { ref, type Ref } from 'vue'
import type { Errors } from '@/stores/types'
import { errorToString, notifySentry } from '@/utils/errors'

type SubmitHandler<SuccessType> = () => Promise<Result<SuccessType, Errors>>
type SuccessHandler<SuccessType> = (result: SuccessType) => void | Promise<void>
type ErrorHandler = (errors: Errors | string) => void | Promise<void>

interface ReturnType {
  submitHandler: () => Promise<void>
  errors: Ref<Errors>
  error: Ref<string | null>
  isProcessing: Ref<boolean>
}

/**
 * Wraps a form submission in shared error handling: field-level validation errors land in
 * `errors`, unexpected failures land in `error` (and Sentry), and `isProcessing` tracks the
 * in-flight state.
 *
 * @param onSubmit Performs the submission and resolves to a Result.
 * @param onSuccess Runs when the Result is Ok.
 * @param onError Optionally runs when the Result is Err or the submission throws.
 * @returns Handlers and reactive state for the form template.
 */
export default function useFormErrorHandling<SuccessType>(
  onSubmit: SubmitHandler<SuccessType>,
  onSuccess: SuccessHandler<SuccessType>,
  onError?: ErrorHandler,
): ReturnType {
  const errors = ref<Errors>({})
  const error = ref<string | null>(null)
  const isProcessing = ref(false)

  const submitHandler = async () => {
    isProcessing.value = true
    errors.value = {}
    error.value = null

    try {
      const result = await onSubmit()
      if (result.ok) {
        await onSuccess(result.val)
      } else {
        errors.value = result.val
        if (onError !== undefined) await onError(result.val)
      }
    } catch (err) {
      notifySentry(err)
      error.value = errorToString(err)
      if (onError !== undefined) await onError(error.value)
    }

    isProcessing.value = false
  }

  return {
    submitHandler,
    errors,
    error,
    isProcessing,
  }
}
