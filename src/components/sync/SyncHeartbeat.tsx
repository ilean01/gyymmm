import { useEffect } from 'react'
import { syncPendingChanges } from '../../lib/sync'

export function SyncHeartbeat() {
  useEffect(() => {
    let disposed = false

    const run = async () => {
      if (
        disposed ||
        !navigator.onLine ||
        document.visibilityState !== 'visible'
      ) {
        return
      }

      try {
        await syncPendingChanges()
      } catch {
        // Los cambios permanecen en IndexedDB/outbox.
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
