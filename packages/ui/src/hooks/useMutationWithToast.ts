import { useMutation } from '@tanstack/react-query'
import { useToast } from '../Toast'

export function useMutationWithToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    successMessage?: string
    errorMessage?: string
    onSuccess?: (data: TData) => void
    onError?: (error: Error) => void
  }
) {
  const { success, error: toastError } = useToast()

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      if (options?.successMessage) success(options.successMessage)
      options?.onSuccess?.(data)
    },
    onError: (error) => {
      toastError(options?.errorMessage ?? error.message)
      options?.onError?.(error)
    },
  })
}