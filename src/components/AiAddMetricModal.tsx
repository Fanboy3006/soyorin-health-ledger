// ═══════════════════════════════════════════════════════════════════
// AI 建议指标弹窗组件
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { type MetricKey } from '../lib/db'
import { supabase } from '../lib/supabaseClient'

interface AiAddMetricModalProps {
  onSave: (keys: MetricKey[]) => void
  onClose: () => void
}

export default function AiAddMetricModal({
  onSave,
  onClose,
}: AiAddMetricModalProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<
    Array<{ key: string; label: string; unit: string }> | null
  >(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setSuggestions(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'ai-add-metric',
        { body: { prompt: prompt.trim() } },
      )

      if (fnError) {
        throw new Error(fnError.message || '调用 AI 服务失败')
      }

      if (data.error) {
        throw new Error(data.error)
      }

      setSuggestions(data.metrics)
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!suggestions) return
    const newKeys = suggestions.map((s) => s.key as MetricKey)
    onSave(newKeys)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">🤖 AI 建议目标</h2>
        <p className="text-xs text-gray-400 mb-4">
          描述你想要追踪的营养目标，AI 会推荐合适的指标
        </p>

        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">
            你的需求
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：我想追踪果糖和膳食纤维"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={loading}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full text-sm py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-4"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI 分析中…
            </span>
          ) : (
            '🚀 AI 建议'
          )}
        </button>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {suggestions && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              AI 建议添加以下指标
            </h3>
            <ul className="space-y-1">
              {suggestions.map((s) => (
                <li
                  key={s.key}
                  className="text-sm text-gray-600 flex items-center gap-2"
                >
                  <span className="text-green-500">✓</span>
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-gray-400">({s.unit})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          {suggestions && (
            <button
              onClick={handleConfirm}
              className="flex-1 text-sm py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
            >
              ✅ 确认添加
            </button>
          )}
          <button
            onClick={onClose}
            className={`text-sm py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer ${
              suggestions ? 'flex-1' : 'w-full'
            }`}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
