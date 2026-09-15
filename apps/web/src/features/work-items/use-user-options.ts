import { useCallback, useEffect, useState } from 'react'
import { getUserOptions, isWorkItemRequestError } from './work-item-api'
import type { UserOption, UserOptionsStatus } from './work-item-types'

interface UserOptionsState {
  status: UserOptionsStatus
  users: UserOption[]
}

export interface UseUserOptionsResult extends UserOptionsState {
  retry: () => void
}

export function useUserOptions(enabled: boolean): UseUserOptionsResult {
  const [state, setState] = useState<UserOptionsState>({
    status: enabled ? 'loading' : 'idle',
    users: [],
  })
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()
    let isCurrent = true

    void getUserOptions(controller.signal)
      .then((users) => {
        if (isCurrent) {
          setState({ status: 'success', users })
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent || controller.signal.aborted) {
          return
        }

        setState({
          status: isWorkItemRequestError(error, 'unauthorized')
            ? 'unauthorized'
            : 'error',
          users: [],
        })
      })

    return () => {
      isCurrent = false
      controller.abort()
    }
  }, [enabled, requestVersion])

  const retry = useCallback(() => {
    setState({ status: 'loading', users: [] })
    setRequestVersion((version) => version + 1)
  }, [])

  return { ...state, retry }
}
