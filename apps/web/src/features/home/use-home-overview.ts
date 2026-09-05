import { useCallback, useEffect, useState } from 'react'

import {
  getHomeOverview,
  isUnauthorizedHomeOverviewError,
} from './home-api'
import type { HomeModule, HomeOverviewStatus } from './home-types'

interface HomeOverviewState {
  status: HomeOverviewStatus
  modules: HomeModule[]
}

export interface UseHomeOverviewResult extends HomeOverviewState {
  retry: () => void
}

const initialState: HomeOverviewState = {
  status: 'loading',
  modules: [],
}

export function useHomeOverview(): UseHomeOverviewResult {
  const [state, setState] = useState<HomeOverviewState>(initialState)
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isCurrentRequest = true

    void getHomeOverview(controller.signal)
      .then((overview) => {
        if (!isCurrentRequest) {
          return
        }

        setState({
          status: 'success',
          modules: overview.modules,
        })
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest || controller.signal.aborted) {
          return
        }

        setState({
          status: isUnauthorizedHomeOverviewError(error)
            ? 'unauthorized'
            : 'error',
          modules: [],
        })
      })

    return () => {
      isCurrentRequest = false
      controller.abort()
    }
  }, [requestVersion])

  const retry = useCallback(() => {
    setState(initialState)
    setRequestVersion((version) => version + 1)
  }, [])

  return {
    status: state.status,
    modules: state.modules,
    retry,
  }
}
