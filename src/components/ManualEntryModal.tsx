// ═══════════════════════════════════════════════════════════════════
// 手动录入弹窗组件
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'

interface ManualEntryModalProps {
  onSave: (data: { name: string; type: 'diet' | 'training'; calories: number; notes: string }) => void
  onClose: () => void
}

export default function ManualEntryModal({ onSave, onClose }: ManualEntryModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'diet' | 'training'>('diet')
  const [calories, setCalories] = useState(0)
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name: name.trim(), type, calories, notes: notes.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">手动记录</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="例如：鸡胸肉 200g"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">类型</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setType('diet')}
                className={`flex-1 text-sm py-2 rounded-lg cursor-pointer ${
                  type === 'diet'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                饮食
              </button>
              <button
                type="button"
                onClick={() => setType('training')}
                className={`flex-1 text-sm py-2 rounded-lg cursor-pointer ${
                  type === 'training'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                训练
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">
              {type === 'diet' ? '热量 (kcal)' : '消耗热量 (kcal)'}
            </label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">备注（可选）</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="可选备注"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 text-sm py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              disabled={!name.trim()}
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
