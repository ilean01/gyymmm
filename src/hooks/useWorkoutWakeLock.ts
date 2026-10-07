import { useEffect, useState } from 'react'

type WakeLockStatus =
  | 'requesting'
  | 'active'
  | 'released'
  | 'unsupported'
  | 'error'

interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(
    type: 'release',
    listener: () => void,
  ): void
}

interface WakeLockNavigator extends Navigator {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>
  }
}

export function useWorkoutWakeLock(enabled: boolean) {
  const [status, setStatus] = useState<WakeLockStatus>('released')

  useEffect(() => {
    if (!enabled) {
      setStatus('released')
      return
    }

    const wakeLockNavigator = navigator as WakeLockNavigator

    if (!wakeLockNavigator.wakeLock) {
      setStatus('unsupported')
      return
    }

    let sentinel: WakeLockSentinelLike | null = null
    let disposed = false

    const request = async () => {
      if (
        disposed ||
        document.visibilityState !== 'visible' ||
        sentinel?.released === false
      ) {
        return
      }

      setStatus('requesting')

      try {
        sentinel = await wakeLockNavigator.wakeLock!.request('screen')

        if (disposed) {
          await sentinel.release()
          return
        }

        setStatus('active')
        sentinel.addEventListener('release', () => {
          sentinel = null
          if (!disposed) {
            setStatus('released')
          }
        })
      } catch {
        if (!disposed) {
          setStatus('error')
        }
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void request()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void request()

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)

      if (sentinel && !sentinel.released) {
        void sentinel.release()
      }
    }
  }, [enabled])

  return status
}
