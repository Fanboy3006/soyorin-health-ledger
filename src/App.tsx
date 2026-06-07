// ═══════════════════════════════════════════════════════════════════
// App — 主布局组件（状态协调、路由跳转）
// 重构后职责：仅负责布局、状态协调、路由跳转
// 所有业务逻辑已拆分到 hooks/ 和 components/
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type PresetAsset, type MetricKey } from './lib/db'
import { saveVisibleMetrics } from './lib/db'
import { todayStr } from './utils/formatters'
import { calcTotals } from './utils/calories'
import { useAuth } from './lib/auth'
import { useLedgerData } from './hooks/useLedgerData'
import { useSync } from './hooks/useSync'
import { useBMR } from './hooks/useBMR'

import SummaryCard from './components/SummaryCard'
import LedgerList from './components/LedgerList'
import ManualEntryModal from './components/ManualEntryModal'
import BmrSettings from './components/BmrSettings'
import MetricsSettings from './components/MetricsSettings'
import VisionRecognizeModal from './components/VisionRecognizeModal'
import DailySummaryModal from './components/DailySummaryModal'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import QuantityEditModal from './components/QuantityEditModal'

export default function App() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // ── Date state (local to App) ──────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // ── Modal visibility (local to App) ────────────────────────────
  const [showBmrModal, setShowBmrModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showMetricsModal, setShowMetricsModal] = useState(false)
  const [showVisionModal, setShowVisionModal] = useState(false)

  // ── Hooks ──────────────────────────────────────────────────────
  const { isOnline, syncMessage, handleManualSync } = useSync(selectedDate, user?.id)

  const {
    presets,
    entries,
    presetsLoaded,
    profile,
    visibleMetrics,
    undoTarget,
    deleteTarget,
    editTarget,
    reportData,
    showReportModal,
    setProfile,
    setVisibleMetrics,
    setShowReportModal,
    setDeleteTarget,
    setEditTarget,
    handleEntry,
    handleManualEntry,
    handleUndo,
    handleQuantityEdit,
    handleDeleteEntry,
    handleVisionSavePreset,
    handleVisionSaveEntry,
    handleSettle,
  } = useLedgerData(selectedDate, isOnline, navigate)

  const { bmr, baseBurn, handleBmrSave } = useBMR(profile, setProfile)

  // ── Derived totals ─────────────────────────────────────────────
  const totals = calcTotals(entries, presets)
  const netIntake = totals.intakeTotal - totals.burnedTotal
  const calSurplus = netIntake - baseBurn

  // ── Metrics save ───────────────────────────────────────────────
  const handleMetricsSave = async (keys: MetricKey[]) => {
    await saveVisibleMetrics(keys)
    setVisibleMetrics(keys)
    setShowMetricsModal(false)
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline banner */}
      {!isOnline && (
        <div className="sticky top-0 z-50 bg-yellow-400 text-yellow-900 text-center text-sm font-medium py-1.5 px-4">
          ⚠️ 离线模式 — 数据将在恢复网络后自动同步
        </div>
      )}

      {/* Sync toast */}
      {syncMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {syncMessage}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                健康账本
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSync}
                disabled={!isOnline}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={isOnline ? '手动同步' : '离线时无法同步'}
              >
                🔄
              </button>
              <button
                onClick={() => navigate('/ai-chat')}
                className="text-xs px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50 cursor-pointer"
              >
                🤖 AI 助手
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                历史报告
              </button>
              <button
                onClick={() => navigate('/trends')}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                趋势
              </button>
              <button
                onClick={() => navigate('/presets')}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                管理预设
              </button>
              <button
                onClick={() => setShowMetricsModal(true)}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
                title="追踪项设置"
              >
                📊
              </button>
              <button
                onClick={() => setShowBmrModal(true)}
                className="text-lg text-gray-400 hover:text-gray-600 cursor-pointer"
                title="BMR 设置"
              >
                ⚙️
              </button>
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    你好，{user.email?.split('@')[0] ?? '用户'}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
                    title="登出"
                  >
                    登出
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/auth')}
                  className="text-xs px-2 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  登录
                </button>
              )}
            </div>
          </div>
          {/* Date picker */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
            />
            {selectedDate !== todayStr() && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                回到今天
              </button>
            )}
          </div>
        </header>

        {/* ── Loading state ──────────────────────────────────────── */}
        {!presetsLoaded ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-400">加载中…</p>
            </div>
          </div>
        ) : (
          <>
        {/* ── Summary Card ────────────────────────────────────── */}
        <section className="mb-6">
          <SummaryCard
            totals={totals}
            bmr={bmr}
            baseBurn={baseBurn}
            netIntake={netIntake}
            calSurplus={calSurplus}
            visibleMetrics={visibleMetrics}
            onOpenBmr={() => setShowBmrModal(true)}
            onOpenMetrics={() => setShowMetricsModal(true)}
          />
        </section>

        {/* ── Main Content: Grid layout with order swap ── */}
        {/* Mobile (single column): presets on top (order-1), ledger on bottom (order-2) */}
        {/* Desktop (two columns): ledger on left (order-1), presets on right (order-2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── Preset Buttons — order-1 on mobile (top), order-2 on desktop (right) ── */}
          <section className="order-1 md:order-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              快捷记录
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              {presets
                .filter((p: PresetAsset) => p.isActive)
                .map((preset: PresetAsset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleEntry(preset)}
                    className={`
                      relative overflow-hidden rounded-xl p-4 text-left
                      transition-all active:scale-95 cursor-pointer
                      ${
                        preset.type === 'diet'
                          ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800'
                      }
                    `}
                  >
                    <p className="font-semibold text-sm leading-tight">
                      {preset.name}
                    </p>
                    <p className="text-xs opacity-70 mt-1">
                      {preset.type === 'diet'
                        ? `+${preset.calories} kcal`
                        : `-${preset.caloriesBurned} kcal`}
                    </p>
                    <span
                      className={`
                        absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full
                        ${
                          preset.type === 'diet'
                            ? 'bg-emerald-200 text-emerald-700'
                            : 'bg-rose-200 text-rose-700'
                        }
                      `}
                    >
                      {preset.type === 'diet' ? '饮食' : '训练'}
                    </span>
                  </button>
                ))}
            </div>
          </section>

          {/* ── Ledger + Actions — order-2 on mobile (bottom), order-1 on desktop (left) ── */}
          <section className="flex-1 min-w-0 order-2 md:order-1">
            {/* ── Undo Toast ──────────────────────────────────────── */}
            {undoTarget && (
              <div className="mb-4 flex items-center justify-between bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-700">
                  已记录{' '}
                  <span className="font-semibold">
                    {undoTarget.type === 'manual'
                      ? undoTarget.manualDesc
                      : presets.find((p: PresetAsset) => p.id === undoTarget.presetId)?.name ?? '未知'}
                  </span>
                </p>
                <button
                  onClick={handleUndo}
                  className="text-sm font-semibold text-rose-500 hover:text-rose-600 active:text-rose-700 transition-colors cursor-pointer"
                >
                  撤销
                </button>
              </div>
            )}

            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {selectedDate === todayStr() ? '今日流水' : `${selectedDate} 流水`}
            </h2>

            <LedgerList
              entries={entries}
              presets={presets}
              onDelete={(entry) => setDeleteTarget(entry)}
              onEdit={(entry) => setEditTarget(entry)}
            />

            {/* ── Action Buttons ────────────────────────────────── */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowManualModal(true)}
                className="flex-1 text-sm py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors cursor-pointer"
              >
                + 手动记录
              </button>
              <button
                onClick={() => setShowVisionModal(true)}
                className="flex-1 text-sm py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-400 hover:text-purple-600 hover:border-purple-400 transition-colors cursor-pointer"
              >
                🤖 AI 识别
              </button>
            </div>

            {/* ── Daily Settlement Button ───────────────────────── */}
            <button
              onClick={handleSettle}
              className="mt-3 w-full text-sm py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer font-semibold"
            >
              📊 日终结账
            </button>
          </section>
        </div>
          </>
        )}
      </div>

      {/* ── BMR Modal ─────────────────────────────────────────── */}
      {showBmrModal && profile && (
        <BmrSettings
          profile={profile}
          onSave={(p) => {
            handleBmrSave(p)
            setShowBmrModal(false)
          }}
          onClose={() => setShowBmrModal(false)}
        />
      )}

      {/* ── Manual Entry Modal ────────────────────────────────── */}
      {showManualModal && (
        <ManualEntryModal
          onSave={(data) => {
            handleManualEntry(data)
            setShowManualModal(false)
          }}
          onClose={() => setShowManualModal(false)}
        />
      )}

      {/* ── Daily Summary Modal ──────────────────────────────── */}
      {showReportModal && reportData && (
        <DailySummaryModal
          report={reportData}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* ── Metrics Settings Modal ───────────────────────────── */}
      {showMetricsModal && (
        <MetricsSettings
          visibleMetrics={visibleMetrics}
          onSave={handleMetricsSave}
          onClose={() => setShowMetricsModal(false)}
        />
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          entryName={
            deleteTarget.type === 'manual'
              ? deleteTarget.manualDesc
              : presets.find((p: PresetAsset) => p.id === deleteTarget.presetId)?.name ?? '未知'
          }
          onConfirm={handleDeleteEntry}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Quantity Edit Modal ──────────────────────────────── */}
      {editTarget && (
        <QuantityEditModal
          entry={editTarget}
          presets={presets}
          onSave={handleQuantityEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* ── AI Vision Recognize Modal ────────────────────────── */}
      {showVisionModal && (
        <VisionRecognizeModal
          onSavePreset={(result) => {
            handleVisionSavePreset(result)
            setShowVisionModal(false)
          }}
          onSaveEntry={(result) => {
            handleVisionSaveEntry(result)
            setShowVisionModal(false)
          }}
          onClose={() => setShowVisionModal(false)}
        />
      )}
    </div>
  )
}
