// ═══════════════════════════════════════════════════════════════════
// 自定义追踪指标设置弹窗组件
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { type MetricKey, saveVisibleMetrics } from '../lib/db'

interface MetricsSettingsProps {
  visibleMetrics: MetricKey[]
  onSave: (metrics: MetricKey[]) => void
  onClose: () => void
}

const ALL_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'calories', label: '卡路里（摄入/消耗/净热量）' },
  { key: 'protein', label: '蛋白质 (g)' },
  { key: 'fructose', label: '果糖 (g)' },
  { key: 'sodium', label: '钠 (mg)' },
  { key: 'potassium', label: '钾 (mg)' },
]

export default function MetricsSettings({
  visibleMetrics,
  onSave,
  onClose,
}: MetricsSettingsProps) {
  const [selected, setSelected] = useState<MetricKey[]>(visibleMetrics)

  const toggle = (key: MetricKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveVisibleMetrics(selected)
    onSave(selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">追踪指标设置</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {ALL_METRICS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={() => toggle(key)}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 text-sm py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              保存
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
