import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, type PresetAsset, estimateFructoseForAllDietPresets, loadVisibleMetrics } from '../lib/db'
import { supabase } from '../lib/supabaseClient'
import { deletePresetCompletely, deletePresetsBatch, fullSync, loadPresets } from '../engine'
import { useAuth } from '../lib/auth'
import { todayStr } from '../utils/formatters'

// ── Default empty preset ──────────────────────────────────────────

function emptyPreset(): Omit<PresetAsset, 'id'> {
  const now = new Date().toISOString()
  return {
    name: '',
    type: 'diet',
    calories: 0,
    caloriesBurned: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    fructoseG: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    notes: '',
    isActive: true,
    sortOrder: 0,
    unit: '份',
    lastUsedAt: now,
    createdAt: now,
    synced: false,
  }
}

// ── Sortable Item ─────────────────────────────────────────────────

function SortablePresetItem({
  preset,
  onEdit,
  onDelete,
  onToggleActive,
  deleteConfirm,
  setDeleteConfirm,
  selected,
  onToggleSelect,
}: {
  preset: PresetAsset
  onEdit: (p: PresetAsset) => void
  onDelete: (id: number) => void
  onToggleActive: (p: PresetAsset) => void
  deleteConfirm: number | null
  setDeleteConfirm: (id: number | null) => void
  selected: boolean
  onToggleSelect: (id: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preset.id! })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border shadow-sm ${
        preset.isActive
          ? 'border-gray-200'
          : 'border-gray-100 opacity-50'
      } ${selected ? 'ring-2 ring-blue-400' : ''}`}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {/* Checkbox for batch select */}
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(preset.id!)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
              title="选择"
            />
            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
              title="拖拽排序"
            >
              ⠿
            </button>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                preset.type === 'diet'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {preset.type === 'diet' ? '饮食' : '训练'}
            </span>
            <p className="text-sm font-medium text-gray-800 truncate">
              {preset.name}
            </p>
          </div>
          <span className="text-sm font-semibold text-gray-600 shrink-0 ml-2">
            {preset.type === 'diet'
              ? `${preset.calories} kcal`
              : `-${preset.caloriesBurned} kcal`}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(preset)}
              className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              编辑
            </button>
            <button
              onClick={() => setDeleteConfirm(preset.id!)}
              className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              删除
            </button>
          </div>
          <div className="flex items-center gap-2">
            {preset.type === 'diet' && (
              <span className="text-[10px] text-gray-400">
                果糖：<span className="font-medium text-gray-600">{preset.fructoseG}g</span>
              </span>
            )}
            <button
              onClick={() => onToggleActive(preset)}
              className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${
                preset.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {preset.isActive ? '已启用' : '已禁用'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm === preset.id && (
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">
            确认删除「{preset.name}」？
          </span>
          <button
            onClick={() => onDelete(preset.id!)}
            className="text-xs px-2 py-1 rounded bg-rose-500 text-white hover:bg-rose-600 cursor-pointer"
          >
            确认
          </button>
          <button
            onClick={() => setDeleteConfirm(null)}
            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            取消
          </button>
        </div>
      )}
    </li>
  )
}

// ── AI Generate Modal ─────────────────────────────────────────────

interface AiGeneratedPreset {
  name: string
  type: 'diet' | 'training'
  calories: number
  caloriesBurned: number
  protein_g: number
  fat_g: number
  carb_g: number
  fructose_g: number
  sodium_mg: number
  potassium_mg: number
  unit: string
  notes: string
}

function AiGenerateModal({
  onSave,
  onClose,
  trackedMetrics,
}: {
  onSave: (preset: Omit<PresetAsset, 'id'>) => void
  onClose: () => void
  trackedMetrics: string[]
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiGeneratedPreset | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'ai-generate-preset',
        {
          body: {
            prompt: prompt.trim(),
            trackedMetrics,
          },
        },
      )

      if (fnError) {
        throw new Error(fnError.message || '调用 AI 服务失败')
      }

      if (data.error) {
        throw new Error(data.error)
      }

      setResult(data as AiGeneratedPreset)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!result) return
    onSave({
      name: result.name,
      type: result.type,
      calories: result.calories ?? 0,
      caloriesBurned: result.caloriesBurned ?? 0,
      proteinG: result.protein_g ?? 0,
      fatG: result.fat_g ?? 0,
      carbG: result.carb_g ?? 0,
      fructoseG: result.fructose_g ?? 0,
      sodiumMg: result.sodium_mg ?? 0,
      potassiumMg: result.potassium_mg ?? 0,
      notes: result.notes ?? '',
      isActive: true,
      sortOrder: 0,
      unit: result.unit || '份',
      synced: false,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">🤖 AI 生成预设</h2>

        {/* Input */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">
            描述你想要的预设
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：给我一个增肌早餐，400卡，30g蛋白"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={loading}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full text-sm py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-4"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              生成中…
            </span>
          ) : (
            '🚀 生成'
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Result preview */}
        {result && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">生成结果</h3>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  result.type === 'diet'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {result.type === 'diet' ? '饮食' : '训练'}
              </span>
            </div>
            <p className="text-base font-bold text-gray-900 mb-2">{result.name}</p>
            {result.type === 'diet' ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-gray-500">热量：<span className="font-semibold text-gray-700">{result.calories} kcal</span></div>
                  <div className="text-gray-500">蛋白质：<span className="font-semibold text-gray-700">{result.protein_g}g</span></div>
                  <div className="text-gray-500">脂肪：<span className="font-semibold text-gray-700">{result.fat_g}g</span></div>
                  <div className="text-gray-500">碳水：<span className="font-semibold text-gray-700">{result.carb_g}g</span></div>
                  <div className="text-gray-500">钠：<span className="font-semibold text-gray-700">{result.sodium_mg}mg</span></div>
                  <div className="text-gray-500">钾：<span className="font-semibold text-gray-700">{result.potassium_mg}mg</span></div>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500">
                消耗热量：<span className="font-semibold text-gray-700">{result.caloriesBurned} kcal</span>
              </div>
            )}
            {result.notes && (
              <p className="text-xs text-gray-400 mt-2 italic">{result.notes}</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {result && (
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
              result ? 'flex-1' : 'w-full'
            }`}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────

export default function PresetManager() {
  const navigate = useNavigate()
  const [presets, setPresets] = useState<PresetAsset[]>([])
  const [editing, setEditing] = useState<PresetAsset | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [trackedMetrics, setTrackedMetrics] = useState<string[]>([])
  // ── Batch delete state ──────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const msgRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showMsg = useCallback((msg: string) => {
    setMessage(msg)
    if (msgRef.current) clearTimeout(msgRef.current)
    msgRef.current = setTimeout(() => setMessage(null), 3000)
  }, [])

  // ── Sensors ─────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px threshold before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // ── Load ──────────────────────────────────────────────────────
  const loadPresetsList = useCallback(async () => {
    const all = await loadPresets()
    console.log('[PresetManager] loadPresetsList result:', all.map(p => ({
      id: p.id,
      name: p.name,
      lastUsedAt: p.lastUsedAt,
      createdAt: p.createdAt,
    })))
    setPresets(all)
  }, [])

  useEffect(() => {
    loadPresetsList()
    loadVisibleMetrics().then(setTrackedMetrics)
  }, [loadPresetsList])

  // ── Drag end handler ────────────────────────────────────────────
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = presets.findIndex((p) => p.id === active.id)
      const newIndex = presets.findIndex((p) => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(presets, oldIndex, newIndex)

      // Update sortOrder in IndexedDB
      const updates = reordered.map((p, i) => {
        if (p.sortOrder !== i + 1) {
          return db.presetAssets.update(p.id!, { sortOrder: i + 1 })
        }
        return Promise.resolve()
      })
      await Promise.all(updates)

      setPresets(reordered)
    },
    [presets],
  )

  // ── Save (create or update) ───────────────────────────────────
  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!editing) return
      if (!editing.name.trim()) {
        showMsg('请输入预设名称')
        return
      }

      if (isNew) {
        const maxSort = presets.reduce(
          (m, p) => Math.max(m, p.sortOrder),
          0,
        )
        const now = new Date().toISOString()
        await db.presetAssets.add({
          ...editing,
          sortOrder: maxSort + 1,
          lastUsedAt: now,
          createdAt: now,
          synced: false,
        })
        showMsg('预设已创建')
      } else {
        await db.presetAssets.update(editing.id!, {
          ...editing,
          synced: false,
        })
        showMsg('预设已更新')
      }

      setEditing(null)
      setIsNew(false)
      await loadPresetsList()
    },
    [editing, isNew, presets, loadPresetsList, showMsg],
  )

  // ── Batch select helpers ──────────────────────────────────────
  const allSelected = presets.length > 0 && selectedIds.size === presets.length

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(presets.map((p) => p.id!)))
    }
  }, [allSelected, presets])

  // ── Delete (single) ───────────────────────────────────────────
  const handleDelete = useCallback(
    async (id: number) => {
      await deletePresetCompletely(id)
      setDeleteConfirm(null)
      // Remove from selection if selected
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      showMsg('预设已删除')
      await loadPresetsList()
    },
    [loadPresetsList, showMsg],
  )

  // ── Batch delete ──────────────────────────────────────────────
  const handleBatchDelete = useCallback(async () => {
    setBatchDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const count = await deletePresetsBatch(ids)
      setSelectedIds(new Set())
      setBatchDeleteConfirm(false)
      showMsg(`已批量删除 ${count} 个预设`)
      await loadPresetsList()
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '批量删除失败')
    } finally {
      setBatchDeleting(false)
    }
  }, [selectedIds, loadPresetsList, showMsg])

  // ── Toggle active ─────────────────────────────────────────────
  const handleToggleActive = useCallback(
    async (preset: PresetAsset) => {
      await db.presetAssets.update(preset.id!, {
        isActive: !preset.isActive,
        synced: false,
      })
      await loadPresetsList()
    },
    [loadPresetsList],
  )

  // ── JSON Import ───────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    try {
      const data = JSON.parse(importText)
      const arr = Array.isArray(data) ? data : [data]
      const toAdd: PresetAsset[] = []
      let sort = (await db.presetAssets.count()) + 1
      const now = new Date().toISOString()
      for (const item of arr) {
        toAdd.push({
          name: item.name || '未命名',
          type: item.type === 'training' ? 'training' : 'diet',
          calories: item.calories ?? 0,
          caloriesBurned: item.caloriesBurned ?? 0,
          proteinG: item.proteinG ?? 0,
          fatG: item.fatG ?? 0,
          carbG: item.carbG ?? 0,
          fructoseG: item.fructoseG ?? 0,
          sodiumMg: item.sodiumMg ?? 0,
          potassiumMg: item.potassiumMg ?? 0,
          notes: item.notes ?? '',
          metaJson: item.metaJson ?? undefined,
          isActive: item.isActive ?? true,
          sortOrder: sort++,
          unit: item.unit ?? '份',
          lastUsedAt: now,
          createdAt: now,
          synced: false,
        })
      }
      await db.presetAssets.bulkAdd(toAdd)
      showMsg(`成功导入 ${toAdd.length} 个预设`)
      setImportText('')
      setShowImport(false)
      await loadPresetsList()
    } catch {
      showMsg('JSON 格式错误，请检查')
    }
  }, [importText, loadPresetsList, showMsg])

  // ── JSON Export ───────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const json = JSON.stringify(presets, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'soyorin-presets.json'
    a.click()
    URL.revokeObjectURL(url)
    showMsg('预设已导出')
  }, [presets, showMsg])

  // ── Edit existing ─────────────────────────────────────────────
  const startEdit = useCallback((preset: PresetAsset) => {
    setEditing({ ...preset })
    setIsNew(false)
  }, [])

  // ── AI Generate save ──────────────────────────────────────────
  const handleAiSave = useCallback(
    async (preset: Omit<PresetAsset, 'id'>) => {
      const maxSort = presets.reduce((m, p) => Math.max(m, p.sortOrder), 0)
      const now = new Date().toISOString()
      await db.presetAssets.add({
        ...preset,
        sortOrder: maxSort + 1,
        lastUsedAt: now,
        createdAt: now,
        synced: false,
      })
      setShowAiGenerate(false)
      showMsg('✅ AI 生成的预设已添加')
      await loadPresetsList()
    },
    [presets, loadPresetsList, showMsg],
  )

  // ── New preset ────────────────────────────────────────────────
  const startNew = useCallback(() => {
    setEditing({ ...emptyPreset(), sortOrder: presets.length + 1 } as PresetAsset)
    setIsNew(true)
  }, [presets.length])

  // ── Batch Fructose Estimation ─────────────────────────────────
  const handleEstimateFructose = useCallback(async () => {
    setEstimating(true)
    try {
      const count = await estimateFructoseForAllDietPresets(
        (name, options) => supabase.functions.invoke(name, options),
      )
      if (count > 0) {
        showMsg(`✅ 已为 ${count} 个预设估算果糖含量`)
      } else {
        showMsg('所有饮食预设已有果糖数据，无需估算')
      }
      await loadPresetsList()
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '估算失败，请重试')
    } finally {
      setEstimating(false)
    }
  }, [loadPresetsList, showMsg])

  // ── Reset presets from cloud ──────────────────────────────────
  const { user } = useAuth()
  const [resetting, setResetting] = useState(false)

  const handleResetPresets = useCallback(async () => {
    if (!user?.id) {
      showMsg('请先登录后再同步')
      return
    }
    if (!confirm('清空本地预设并重新从云端拉取？云端数据不会被删除。')) return
    setResetting(true)
    try {
      await db.presetAssets.clear()
      await fullSync(todayStr(), user.id)
      await loadPresetsList()
      showMsg('✅ 预设已从云端恢复')
    } catch (e) {
      showMsg(e instanceof Error ? e.message : '同步失败，请重试')
    } finally {
      setResetting(false)
    }
  }, [user, loadPresetsList, showMsg])

  // ── Render ────────────────────────────────────────────────────
  const isTraining = editing?.type === 'training'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 cursor-pointer"
            >
              ← 返回首页
            </button>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              预设管理
            </h1>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <button
              onClick={handleResetPresets}
              disabled={resetting}
              className="text-xs px-2 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? '⏳ 同步中…' : '🔄 同步修复'}
            </button>
            <button
              onClick={handleEstimateFructose}
              disabled={estimating}
              className="text-xs px-2 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {estimating ? '⏳ 估算中…' : '🍬 果糖'}
            </button>
            <button
              onClick={() => setShowAiGenerate(true)}
              className="text-xs px-2 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 cursor-pointer"
            >
              🤖 AI
            </button>
            <button
              onClick={() => setShowImport(!showImport)}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              导入
            </button>
            <button
              onClick={handleExport}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              导出
            </button>
            <button
              onClick={startNew}
              className="text-xs px-2 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              + 新增
            </button>
          </div>
        </header>

        {/* Toast */}
        {message && (
          <div className="mb-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg text-center">
            {message}
          </div>
        )}

        {/* Import panel */}
        {showImport && (
          <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              JSON 导入
            </h3>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='粘贴 JSON 数组，例如：[{"name":"2C1S","type":"diet","calories":120}]'
              className="w-full border border-gray-300 rounded-lg p-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleImport}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                确认导入
              </button>
              <button
                onClick={() => setShowImport(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Edit / New Form */}
        {editing && (
          <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {isNew ? '新增预设' : '编辑预设'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">名称</label>
                  <input
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="预设名称"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">类型</label>
                  <select
                    value={editing.type}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        type: e.target.value as 'diet' | 'training',
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="diet">饮食</option>
                    <option value="training">训练</option>
                  </select>
                </div>
              </div>

              {/* Conditional calorie field */}
              <div>
                <label className="text-xs text-gray-500">
                  {isTraining ? '消耗热量 (kcal)' : '热量 (kcal)'}
                </label>
                <input
                  type="number"
                  value={isTraining ? editing.caloriesBurned : editing.calories}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    if (isTraining) {
                      setEditing({ ...editing, caloriesBurned: val })
                    } else {
                      setEditing({ ...editing, calories: val })
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Macro fields — only for diet */}
              {!isTraining && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">蛋白质 (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editing.proteinG}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            proteinG: Number(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">脂肪 (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editing.fatG}
                        onChange={(e) =>
                          setEditing({ ...editing, fatG: Number(e.target.value) })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">碳水 (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editing.carbG}
                        onChange={(e) =>
                          setEditing({ ...editing, carbG: Number(e.target.value) })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">果糖 (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editing.fructoseG}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            fructoseG: Number(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">钠 (mg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editing.sodiumMg}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            sodiumMg: Number(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">钾 (mg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editing.potassiumMg}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            potassiumMg: Number(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">单位</label>
                  <input
                    value={editing.unit}
                    onChange={(e) =>
                      setEditing({ ...editing, unit: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="份、克、个、次"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">备注</label>
                  <input
                    value={editing.notes}
                    onChange={(e) =>
                      setEditing({ ...editing, notes: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="可选备注"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  {isNew ? '创建' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setIsNew(false)
                  }}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Batch select toolbar */}
        {presets.length > 0 && (
          <div className="mb-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              全选
            </label>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  已选择 {selectedIds.size} 项
                </span>
                <button
                  onClick={() => setBatchDeleteConfirm(true)}
                  className="text-xs px-2 py-1 rounded bg-rose-500 text-white hover:bg-rose-600 cursor-pointer"
                >
                  批量删除
                </button>
              </div>
            )}
          </div>
        )}

        {/* Preset List with Drag & Drop */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            全部预设 ({presets.length})
            <span className="ml-2 font-normal text-gray-300 normal-case">
              （拖拽 ⠿ 排序）
            </span>
          </h2>
          {presets.length === 0 ? (
            <p className="text-center text-gray-300 py-8 text-sm">
              暂无预设，点击右上角"新增"添加
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={presets.map((p) => p.id!)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {presets.map((preset) => (
                    <SortablePresetItem
                      key={preset.id}
                      preset={preset}
                      onEdit={startEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      deleteConfirm={deleteConfirm}
                      setDeleteConfirm={setDeleteConfirm}
                      selected={selectedIds.has(preset.id!)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>

        {/* ── Batch Delete Confirmation Modal ────────────────────── */}
        {batchDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">确认批量删除</h2>
              <p className="text-sm text-gray-600 mb-4">
                确定要删除已选择的 <strong>{selectedIds.size}</strong> 个预设吗？此操作不可撤销。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleBatchDelete}
                  disabled={batchDeleting}
                  className="flex-1 text-sm py-2.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {batchDeleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      删除中…
                    </span>
                  ) : (
                    '确认删除'
                  )}
                </button>
                <button
                  onClick={() => setBatchDeleteConfirm(false)}
                  disabled={batchDeleting}
                  className="flex-1 text-sm py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Generate Modal ──────────────────────────────────── */}
        {showAiGenerate && (
          <AiGenerateModal
            onSave={handleAiSave}
            onClose={() => setShowAiGenerate(false)}
            trackedMetrics={trackedMetrics}
          />
        )}
      </div>
    </div>
  )
}
