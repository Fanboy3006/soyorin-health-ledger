// ═══════════════════════════════════════════════════════════════════
// 修改数量弹窗组件
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { type PresetAsset, type LedgerEntry } from '../lib/db'

interface QuantityEditModalProps {
  entry: LedgerEntry
  presets: PresetAsset[]
  onSave: (entryId: number, newQuantity: number) => void
  onClose: () => void
}

export default function QuantityEditModal({
  entry,
  presets,
  onSave,
  onClose,
}: QuantityEditModalProps) {
  const isManual = entry.type === 'manual'
  const preset = isManual ? null : presets.find((p) => p.id === entry.presetId)
  const displayName = isManual
    ? entry.manualDesc
    : preset?.name ?? '未知预设'
  const unit = isManual ? '份' : preset?.unit ?? '份'

  const [quantity, setQuantity] = useState(entry.quantity)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (quantity < 0) return
    if (entry.id) {
      onSave(entry.id, quantity)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">修改数量</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">名称</label>
            <p className="text-sm font-medium text-gray-800 mt-1">{displayName}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">数量（{unit}）</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
          </div>
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
