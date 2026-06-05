// ═══════════════════════════════════════════════════════════════════
// 今日流水列表组件（含删除、修改数量）
// ═══════════════════════════════════════════════════════════════════

import { type PresetAsset, type LedgerEntry } from '../lib/db'
import { entryType, entryCalories } from '../utils/calories'
import { formatTime } from '../utils/formatters'

interface LedgerListProps {
  entries: LedgerEntry[]
  presets: PresetAsset[]
  onDelete: (entry: LedgerEntry) => void
  onEdit: (entry: LedgerEntry) => void
}

function entryName(e: LedgerEntry, presets: PresetAsset[]): string {
  if (e.type === 'manual') return e.manualDesc || '(手动)'
  const preset = presets.find((p) => p.id === e.presetId)
  return preset?.name ?? '(未知)'
}

export default function LedgerList({
  entries,
  presets,
  onDelete,
  onEdit,
}: LedgerListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        暂无记录，点击上方预设快速添加
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const type = entryType(entry, presets)
        const cal = entryCalories(entry, presets)
        const name = entryName(entry, presets)

        return (
          <div
            key={entry.id}
            className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-50"
          >
            {/* Left: time + name */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-[10px] text-gray-400 w-10 shrink-0">
                {entry.createdAt ? formatTime(entry.createdAt) : ''}
              </span>
              <span className="text-sm text-gray-800 truncate">{name}</span>
            </div>

            {/* Right: quantity + calories + actions */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Quantity badge */}
              <button
                onClick={() => onEdit(entry)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
                title="修改数量"
              >
                ×{entry.quantity}
              </button>

              {/* Calories */}
              <span
                className={`text-xs font-medium w-16 text-right ${
                  type === 'training' ? 'text-rose-500' : 'text-gray-700'
                }`}
              >
                {type === 'training' ? '-' : '+'}
                {cal}
              </span>

              {/* Delete */}
              <button
                onClick={() => onDelete(entry)}
                className="text-gray-300 hover:text-red-400 text-sm cursor-pointer"
                title="删除"
              >
                ✕
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
