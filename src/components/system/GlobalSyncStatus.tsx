import { useEffect, useState } from 'react'
import { Badge, Toast } from '../ui'
import {
  getSyncConflicts,
  getSyncMetadata,
  getSyncQueue,
} from '../../lib/db'
import {
  subscribeToAppNotices,
  subscribeToSyncState,
  type AppNoticeDetail,
  type SyncUiState,
} from '../../lib/app-events'

interface Snapshot {
  state: SyncUiState
  pending: number
  conflicts: number
  message: string
}

function stateLabel(snapshot: Snapshot): string {
  if (snapshot.state === 'offline') return 'Sin conexión'
  if (snapshot.state === 'syncing') return 'Sincronizando'
  if (snapshot.conflicts > 0 || snapshot.state === 'conflict') {
    return snapshot.conflicts === 1
      ? '1 conflicto'
      : snapshot.conflicts + ' conflictos'
  }
  if (snapshot.state === 'error') return 'Error de sync'
  if (snapshot.pending > 0 || snapshot.state === 'pending') {
    return snapshot.pending === 1
      ? '1 cambio pendiente'
      : snapshot.pending + ' cambios pendientes'
  }
  return 'Sincronizado'
}

function stateTone(
  snapshot: Snapshot,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (snapshot.state === 'error') return 'danger'
  if (snapshot.state === 'offline' || snapshot.pending > 0) return 'warning'
  if (snapshot.conflicts > 0 || snapshot.state === 'conflict') return 'danger'
  if (snapshot.state === 'synced') return 'success'
  return 'neutral'
}

export function GlobalSyncStatus() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    state: navigator.onLine ? 'synced' : 'offline',
    pending: 0,
    conflicts: 0,
    message: '',
  })
  const [notice, setNotice] = useState<AppNoticeDetail | null>(null)

  async function refresh(
    override?: Partial<Pick<Snapshot, 'state' | 'message'>>,
  ) {
    const [queue, conflicts, metadata] = await Promise.all([
      getSyncQueue(),
      getSyncConflicts(),
      getSyncMetadata(),
    ])

    const pending = queue.filter((item) => item.status !== 'conflict').length
    const nextState: SyncUiState = !navigator.onLine
      ? 'offline'
      : conflicts.length > 0
        ? 'conflict'
        : metadata.lastError
          ? 'error'
          : pending > 0
            ? 'pending'
            : 'synced'

    setSnapshot({
      state: override?.state ?? nextState,
      pending,
      conflicts: conflicts.length,
      message: override?.message ?? metadata.lastError ?? '',
    })
  }

  useEffect(() => {
    void refresh()

    const unsubscribeSync = subscribeToSyncState((detail) => {
      void refresh({
        state: detail.state,
        message: detail.message ?? '',
      })
    })

    const unsubscribeNotice = subscribeToAppNotices((detail) => {
      setNotice(detail)
    })

    const online = () => void refresh()
    const offline = () =>
      setSnapshot((current) => ({
        ...current,
        state: 'offline',
        message: 'Tus cambios permanecen guardados en este dispositivo.',
      }))

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)

    const timer = window.setInterval(() => {
      void refresh()
    }, 5000)

    return () => {
      unsubscribeSync()
      unsubscribeNotice()
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <>
      <div
        className="fixed bottom-24 right-3 z-50 lg:bottom-4 lg:right-4"
        aria-live="polite"
        aria-atomic="true"
      >
        <Badge
          tone={stateTone(snapshot)}
          className="shadow-gym backdrop-blur-xl"
        >
          {snapshot.state === 'syncing' && (
            <span
              aria-hidden="true"
              className="mr-1 size-3 animate-spin rounded-full border border-current border-r-transparent"
            />
          )}
          {stateLabel(snapshot)}
        </Badge>
      </div>

      {notice && (
        <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,32rem)] -translate-x-1/2">
          <Toast
            message={notice.message}
            tone={notice.tone}
            onClose={() => setNotice(null)}
          />
        </div>
      )}
    </>
  )
}
