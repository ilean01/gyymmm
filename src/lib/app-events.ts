export type AppNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface AppNoticeDetail {
  message: string
  tone: AppNoticeTone
}

export type SyncUiState =
  | 'offline'
  | 'syncing'
  | 'synced'
  | 'pending'
  | 'conflict'
  | 'error'

export interface SyncStateDetail {
  state: SyncUiState
  message?: string
}

const NOTICE_EVENT = 'gymbro:app-notice'
const SYNC_EVENT = 'gymbro:sync-state'

export function emitAppNotice(detail: AppNoticeDetail): void {
  window.dispatchEvent(
    new CustomEvent<AppNoticeDetail>(NOTICE_EVENT, { detail }),
  )
}

export function subscribeToAppNotices(
  listener: (detail: AppNoticeDetail) => void,
): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<AppNoticeDetail>).detail)
  }

  window.addEventListener(NOTICE_EVENT, handler)
  return () => window.removeEventListener(NOTICE_EVENT, handler)
}

export function emitSyncState(detail: SyncStateDetail): void {
  window.dispatchEvent(
    new CustomEvent<SyncStateDetail>(SYNC_EVENT, { detail }),
  )
}

export function subscribeToSyncState(
  listener: (detail: SyncStateDetail) => void,
): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<SyncStateDetail>).detail)
  }

  window.addEventListener(SYNC_EVENT, handler)
  return () => window.removeEventListener(SYNC_EVENT, handler)
}
