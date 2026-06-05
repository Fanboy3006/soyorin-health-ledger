// ═══════════════════════════════════════════════════════════════════
// BMR 设置弹窗组件
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { type UserProfile } from '../lib/db'

interface BmrSettingsProps {
  profile: UserProfile
  onSave: (p: UserProfile) => void
  onClose: () => void
}

export default function BmrSettings({ profile, onSave, onClose }: BmrSettingsProps) {
  const [weight, setWeight] = useState(profile.weightLbs)
  const [height, setHeight] = useState(profile.heightCm)
  const [age, setAge] = useState(profile.age)
  const [gender, setGender] = useState(profile.gender)
  const [activityFactor, setActivityFactor] = useState(profile.activityFactor ?? 1.0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ weightLbs: weight, heightCm: height, age, gender, activityFactor, synced: false })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">BMR 设置</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">体重 (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">身高 (cm)</label>
            <input
              type="number"
              step="0.1"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">年龄</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">性别</label>
            <select
              value={gender}
              onChange={(e) =>
                setGender(e.target.value as 'male' | 'female')
              }
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">活动系数</label>
            <input
              type="number"
              step="0.05"
              min="0.5"
              max="1.5"
              value={activityFactor}
              onChange={(e) => setActivityFactor(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              BMR × 系数 = 每日基础消耗，1.0 为标准 BMR
            </p>
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
