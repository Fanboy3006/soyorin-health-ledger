// ═══════════════════════════════════════════════════════════════════
// 同步逻辑 Hook（薄层，调用 engine）
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { fullSync } from '../engine'

export function useSync(selectedDate: string, userId: string | undefined) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const syncMsgRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Network status
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Background sync (only when user is logged in)
  useEffect(() => {
    if (!isOnline || !userId) return

    const sync = async () => {
      try {
        await fullSync(selectedDate, userId)
      } catch (e) {
        console.error('[Sync] Error during background sync:', e)
      }
    }

    sync()
    const interval = setInterval(sync, 15_000)
    return () => clearInterval(interval)
  }, [isOnline, selectedDate, userId])

  // Manual sync
  const handleManualSync = useCallback(async () => {
    if (!isOnline || !userId) return
    setSyncMessage('同步中…')
    try {
      await fullSync(selectedDate, userId)
      setSyncMessage('✅ 同步完成')
    } catch (e) {
      console.error('[Sync] Manual sync error:', e)
      setSyncMessage('❌ 同步失败')
    }
    if (syncMsgRef.current) clearTimeout(syncMsgRef.current)
    syncMsgRef.current = setTimeout(() => setSyncMessage(null), 3000)
  }, [isOnline, selectedDate, userId])

  return { isOnline, syncMessage, handleManualSync }
}
