// ═══════════════════════════════════════════════════════════════════
// 流水数据逻辑 Hook（薄层，调用 engine）
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  db,
  initSampleData,
  loadVisibleMetrics,
  type PresetAsset,
  type LedgerEntry,
  type UserProfile,
  type DailySummary,
  type MetricKey,
} from '../lib/db'
import {
  loadEntries,
  addEntry,
  addManualEntry,
  undoEntry,
  updateEntryQuantity,
  deleteEntry,
  saveVisionPreset,
  saveVisionEntry,
  loadPresets,
  getMaxSortOrder,
  generateReport,
  saveDailySummary,
  saveDailyLog,
} from '../engine'

export interface VisionResult {
  name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  fat_g: number
  carb_g: number
  fructose_g: number
  sodium_mg: number
  potassium_mg: number
  description: string
}

export function useLedgerData(
  selectedDate: string,
  isOnline: boolean,
  navigate: (path: string) => void,
) {
  // ── State ──────────────────────────────────────────────────────
  const [presets, setPresets] = useState<PresetAsset[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [presetsLoaded, setPresetsLoaded] = useState(false)
  const [undoTarget, setUndoTarget] = useState<LedgerEntry | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>([])
  const [reportData, setReportData] = useState<{
    markdown: string
    summary: Omit<DailySummary, 'id' | 'synced'>
  } | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LedgerEntry | null>(null)
  const [editTarget, setEditTarget] = useState<LedgerEntry | null>(null)
  const undoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ──────────────────────────────────────────────────
  const loadData = useCallback(async (date: string) => {
    await initSampleData()

    // Step 1: Load presets first — entries depend on presets for name lookup
    const allPresets = await loadPresets()
    setPresets(allPresets)
    setPresetsLoaded(true)

    // Step 2: Now load entries and other data
    const [dayEntries, userProfile, metrics] = await Promise.all([
      loadEntries(date),
      db.userProfile.limit(1).first(),
      loadVisibleMetrics(),
    ])
    setEntries(dayEntries.reverse())
    setVisibleMetrics(metrics)
    if (userProfile) {
      setProfile(userProfile)
    } else {
      const defaultProfile: UserProfile = {
        weightLbs: 167,
        heightCm: 175,
        age: 37,
        gender: 'male',
        activityFactor: 1.0,
        synced: false,
      }
      const id = await db.userProfile.add(defaultProfile)
      defaultProfile.id = id
      setProfile(defaultProfile)
    }
  }, [])

  useEffect(() => {
    loadData(selectedDate)
  }, [loadData, selectedDate])

  // ── One-click entry ────────────────────────────────────────────
  const handleEntry = useCallback(
    async (preset: PresetAsset) => {
      if (undoRef.current) {
        clearTimeout(undoRef.current)
        undoRef.current = null
      }
      setUndoTarget(null)

      const entry = await addEntry(preset, selectedDate)

      setEntries((prev) => [entry, ...prev])

      setUndoTarget(entry)
      undoRef.current = setTimeout(() => {
        setUndoTarget(null)
        undoRef.current = null
      }, 3000)
    },
    [selectedDate],
  )

  // ── Manual entry ────────────────────────────────────────────────
  const handleManualEntry = useCallback(
    async (data: { name: string; type: 'diet' | 'training'; calories: number; notes: string }) => {
      if (undoRef.current) {
        clearTimeout(undoRef.current)
        undoRef.current = null
      }
      setUndoTarget(null)

      const entry = await addManualEntry(data, selectedDate)

      setEntries((prev) => [entry, ...prev])

      setUndoTarget(entry)
      undoRef.current = setTimeout(() => {
        setUndoTarget(null)
        undoRef.current = null
      }, 3000)
    },
    [selectedDate],
  )

  // ── Undo ───────────────────────────────────────────────────────
  const handleUndo = useCallback(async () => {
    if (!undoTarget?.id) return
    if (undoRef.current) {
      clearTimeout(undoRef.current)
      undoRef.current = null
    }
    await undoEntry(undoTarget.id)
    setEntries((prev) => prev.filter((e) => e.id !== undoTarget.id))
    setUndoTarget(null)
  }, [undoTarget])

  // ── Quantity edit ───────────────────────────────────────────────
  const handleQuantityEdit = useCallback(
    async (entryId: number, newQuantity: number) => {
      await updateEntryQuantity(entryId, newQuantity, selectedDate)

      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, quantity: newQuantity, synced: false } : e,
        ),
      )

      setEditTarget(null)
    },
    [selectedDate],
  )

  // ── Delete entry ───────────────────────────────────────────────
  const handleDeleteEntry = useCallback(async () => {
    if (!deleteTarget?.id) return

    await deleteEntry(deleteTarget.id, deleteTarget.remoteId, isOnline, selectedDate)

    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id))
    setDeleteTarget(null)
  }, [deleteTarget, isOnline, selectedDate])

  // ── Vision Recognize: Save as Preset ───────────────────────────
  const handleVisionSavePreset = useCallback(
    async (result: VisionResult) => {
      const maxSort = await getMaxSortOrder()
      await saveVisionPreset(result, maxSort)
      navigate('/presets')
    },
    [navigate],
  )

  // ── Vision Recognize: Save as Temporary Entry ──────────────────
  const handleVisionSaveEntry = useCallback(
    async (result: VisionResult) => {
      if (undoRef.current) {
        clearTimeout(undoRef.current)
        undoRef.current = null
      }
      setUndoTarget(null)

      const entry = await saveVisionEntry(result, selectedDate)

      setEntries((prev) => [entry, ...prev])

      setUndoTarget(entry)
      undoRef.current = setTimeout(() => {
        setUndoTarget(null)
        undoRef.current = null
      }, 3000)
    },
    [selectedDate],
  )

  // ── Daily settlement ────────────────────────────────────────────
  const handleSettle = useCallback(async () => {
    const { summary, markdown } = generateReport(
      selectedDate,
      entries,
      presets,
      profile,
    )

    await saveDailySummary(selectedDate, summary)

    // Save to daily_logs/ folder (browser download fallback)
    await saveDailyLog(markdown, selectedDate)

    setReportData({ markdown, summary })
    setShowReportModal(true)
  }, [selectedDate, entries, presets, profile])

  return {
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
  }
}
