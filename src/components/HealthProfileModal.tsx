// ═══════════════════════════════════════════════════════════════════
// HealthProfileModal — 健康档案编辑弹窗
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import {
  getHealthProfile,
  saveHealthProfile,
  getDefaultHealthProfile,
} from '../lib/healthProfile'

interface HealthProfileModalProps {
  onClose: () => void
}

export default function HealthProfileModal({
  onClose,
}: HealthProfileModalProps) {
  const { user } = useAuth()

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // ── Load profile on mount ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return

      setLoading(true)
      try {
        const existing = await getHealthProfile(user.id)
        if (existing) {
          setContent(existing)
        } else {
          const defaultProfile = await getDefaultHealthProfile(user.id)
          setContent(defaultProfile)
        }
      } catch (e) {
        console.error('[HealthProfile] Load failed:', e)
        setContent('加载失败，请重试')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  // ── Save ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.id) return

    setSaving(true)
    setMessage(null)

    try {
      await saveHealthProfile(user.id, content)
      setMessage('✅ 健康档案已保存')
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage('❌ 保存失败')
      console.error('[HealthProfile] Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  // ── Reset to default ───────────────────────────────────────────
  const handleReset = async () => {
    if (!user?.id) return

    try {
      const defaultProfile = await getDefaultHealthProfile(user.id)
      setContent(defaultProfile)
      setMessage('✅ 已重置为默认模板')
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setMessage('❌ 重置失败')
      console.error('[HealthProfile] Reset failed:', e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] flex flex-col">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">健康档案</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              编辑你的健康信息，AI 助手将参考这些数据提供个性化建议
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* ── Loading ──────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-400">加载中…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Editor ────────────────────────────────────────── */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 resize-none border border-gray-300 rounded-xl p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder="在此编辑你的健康档案（Markdown 格式）"
              style={{ minHeight: '300px' }}
            />

            {/* ── Message ────────────────────────────────────────── */}
            {message && (
              <div className="mt-3 shrink-0 text-sm text-center text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                {message}
              </div>
            )}

            {/* ── Actions ────────────────────────────────────────── */}
            <div className="mt-4 flex gap-2 shrink-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 text-sm py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '⏳ 保存中…' : '💾 保存'}
              </button>
              <button
                onClick={handleReset}
                className="text-sm px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                🔄 重置
              </button>
              <button
                onClick={onClose}
                className="flex-1 text-sm py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
