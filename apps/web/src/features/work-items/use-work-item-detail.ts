import { useCallback, useEffect, useState } from 'react'
import { getWorkItemDetail, isWorkItemRequestError } from './work-item-api'
import type { WorkItemDetail, WorkItemLoadStatus } from './work-item-types'

interface WorkItemDetailState {
  status: WorkItemLoadStatus
  workItem: WorkItemDetail | null
}

export interface UseWorkItemDetailResult extends WorkItemDetailState {
  reload: () => void
}

export function useWorkItemDetail(
  workItemId: string,
): UseWorkItemDetailResult {
  const [state, setState] = useState<WorkItemDetailState>({
    status: 'loading',
    workItem: null,
  })
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isCurrent = true

    void getWorkItemDetail(workItemId, controller.signal)
      .then((workItem) => {
        if (isCurrent) {
          setState({ status: 'success', workItem })
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent || controller.signal.aborted) {
          return
        }

        let status: WorkItemLoadStatus = 'error'

        if (isWorkItemRequestError(error, 'unauthorized')) {
          status = 'unauthorized'
        } else if (isWorkItemRequestError(error, 'not-found')) {
          status = 'not-found'
        }

        setState({ status, workItem: null })
      })

    return () => {
      isCurrent = false
      controller.abort()
    }
  }, [requestVersion, workItemId])

  const reload = useCallback(() => {
    setState((current) =>
      current.workItem ? current : { status: 'loading', workItem: null },
    )
    setRequestVersion((version) => version + 1)
  }, [])

  return { ...state, reload }
}
