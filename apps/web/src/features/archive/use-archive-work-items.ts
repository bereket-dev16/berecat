import { useCallback, useEffect, useState } from 'react'
import { getArchiveWorkItems, isArchiveRequestError } from './archive-api'
import type {
  ArchiveFilters,
  ArchiveLoadStatus,
  ArchivePagination,
  ArchiveWorkItem,
} from './archive-types'

interface ArchiveState {
  status: ArchiveLoadStatus
  items: ArchiveWorkItem[]
  pagination: ArchivePagination
}

const emptyPagination: ArchivePagination = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
}

export interface UseArchiveWorkItemsResult extends ArchiveState {
  refresh: () => void
  retry: () => void
  removeItem: (workItemId: string) => void
}

export function useArchiveWorkItems(
  filters: ArchiveFilters,
): UseArchiveWorkItemsResult {
  const [requestVersion, setRequestVersion] = useState(0)
  const [state, setState] = useState<ArchiveState>({
    status: 'loading',
    items: [],
    pagination: emptyPagination,
  })

  useEffect(() => {
    const controller = new AbortController()
    let isCurrent = true

    void Promise.resolve().then(() => {
      if (isCurrent) {
        setState((current) => ({ ...current, status: 'loading' }))
      }
    })

    void getArchiveWorkItems(filters, controller.signal)
      .then((result) => {
        if (!isCurrent) {
          return
        }

        setState({ status: 'success', ...result })
      })
      .catch((error: unknown) => {
        if (!isCurrent || controller.signal.aborted) {
          return
        }

        setState((current) => ({
          ...current,
          status: isArchiveRequestError(error, 'unauthorized')
            ? 'unauthorized'
            : 'error',
        }))
      })

    return () => {
      isCurrent = false
      controller.abort()
    }
  }, [filters, requestVersion])

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1)
  }, [])

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading' }))
    setRequestVersion((version) => version + 1)
  }, [])

  const removeItem = useCallback((workItemId: string) => {
    setState((current) => {
      if (current.status !== 'success') {
        return current
      }

      const items = current.items.filter((item) => item.id !== workItemId)

      if (items.length === current.items.length) {
        return current
      }

      const total = Math.max(0, current.pagination.total - 1)

      return {
        ...current,
        items,
        pagination: {
          ...current.pagination,
          total,
          totalPages: Math.ceil(total / current.pagination.pageSize),
        },
      }
    })
  }, [])

  return { ...state, refresh, retry, removeItem }
}
