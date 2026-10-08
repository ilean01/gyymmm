import { useEffect } from 'react'
import { syncPendingChanges } from '../../lib/sync'
import { emitSyncState } from '../../lib/app-events'

export function SyncHeartbeat() {
  useEffect(() => {
    let disposed = false

    const run = async () => {
      if (disposed || document.visibilityState !== 'visible') {
        return
      }

      if (!navigator.onLine) {
        emitSyncState({
          state: 'offline',
          message: 'Tus cambios siguen guardados en este dispositivo.',
        })
        return
      }

      emitSyncState({ state: 'syncing' })

      try {
        const summary = await syncPendingChanges()

        if (summary.conflicts > 0) {
          emitSyncState({
            state: 'conflict',
            message: 'Hay cambios que necesitan revisión.',
          })
        } else if (summary.failed > 0) {
          emitSyncState({
            state: 'error',
            message: 'Algunos cambios no pudieron sincronizarse.',
          })
        } else {
          emitSyncState({
            state: 'synced',
            message: 'GymBro está sincronizado.',
          })
        }
      } catch (error) {
        emitSyncState({
          state: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo sincronizar.',
        })
      }
    }

    const handleOnline = () => {
      void run()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void run()
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)

    const interval = window.setInterval(() => {
      void run()
    }, 5000)

    void run()

    return () => {
      disposed = true
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(interval)
    }
  }, [])

  return null
}
