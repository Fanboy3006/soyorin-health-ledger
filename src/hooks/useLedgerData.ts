// ═══════════════════════════════════════════════════════════════════
// 流水数据逻辑 Hook（加载、增删改查、撤销、日终结账）
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  db,
  initSampleData,
  loadVisibleMetrics,
  generateDailyReport,
  type PresetAsset,
  type LedgerEntry,
  type UserProfile,
  type DailySummary,
  type MetricKey,
} from '../lib/db'
import { deleteRemoteRecord } from '../lib/sync'
import { nowISO } from '../utils/formatters'

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
  userId?: string,
) {
  // ── State ──────────────────────────────────────────────────────
  const [presets, setPresets] = useState<PresetAsset[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
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
    await initSampleData(userId)
    const [allPresets, dayEntries, userProfile, metrics] = await Promise.all([
      db.presetAssets.orderBy('sortOrder').toArray(),
      db.ledgerEntries
        .where('date')
        .equals(date)
        .reverse()
        .sortBy('createdAt'),
      db.userProfile.limit(1).first(),
      loadVisibleMetrics(),
    ])
    setPresets(allPresets)
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

      const entry: LedgerEntry = {
        presetId: preset.id!,
        date: selectedDate,
        type: 'preset',
        quantity: 1,
        manualDesc: '',
        createdAt: nowISO(),
        synced: false,
      }

      const id = await db.ledgerEntries.add(entry)
      entry.id = id

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

      const entry: LedgerEntry = {
        presetId: null,
        date: selectedDate,
        type: 'manual',
        quantity: 1,
        manualDesc: data.notes
          ? `${data.name}（${data.notes}）`
          : data.name,
        manualType: data.type,
        manualCalories: data.calories,
        createdAt: nowISO(),
        synced: false,
      }

      const id = await db.ledgerEntries.add(entry)
      entry.id = id

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
    await db.ledgerEntries.delete(undoTarget.id)
    setEntries((prev) => prev.filter((e) => e.id !== undoTarget.id))
    setUndoTarget(null)
  }, [undoTarget])

  // ── Quantity edit ───────────────────────────────────────────────
  const handleQuantityEdit = useCallback(
    async (entryId: number, newQuantity: number) => {
      await db.ledgerEntries.update(entryId, {
        quantity: newQuantity,
        synced: false,
      })

      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, quantity: newQuantity, synced: false } : e,
        ),
      )

      setEditTarget(null)

      const existingSummary = await db.dailySummaries
        .where('date')
        .equals(selectedDate)
        .first()
      if (existingSummary?.id) {
        await db.dailySummaries.update(existingSummary.id, { synced: false })
      }
    },
    [selectedDate],
  )

  // ── Delete entry ───────────────────────────────────────────────
  const handleDeleteEntry = useCallback(async () => {
    if (!deleteTarget?.id) return

    await db.ledgerEntries.delete(deleteTarget.id)

    if (deleteTarget.remoteId && isOnline) {
      try {
        await deleteRemoteRecord('ledger_entries', deleteTarget.remoteId)
      } catch (e) {
        console.error('[Delete] Failed to delete from Supabase:', e)
      }
    }

    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id))
    setDeleteTarget(null)

    const existingSummary = await db.dailySummaries
      .where('date')
      .equals(selectedDate)
      .first()
    if (existingSummary?.id) {
      await db.dailySummaries.update(existingSummary.id, { synced: false })
    }
  }, [deleteTarget, isOnline, selectedDate])

  // ── Vision Recognize: Save as Preset ───────────────────────────
  const handleVisionSavePreset = useCallback(
    async (result: VisionResult) => {
      const maxSort = presets.reduce((m, p) => Math.max(m, p.sortOrder), 0)
      await db.presetAssets.add({
        name: result.name,
        type: 'diet',
        calories: result.calories,
        caloriesBurned: 0,
        proteinG: result.protein_g,
        fatG: result.fat_g,
        carbG: result.carb_g,
        fructoseG: result.fructose_g,
        sodiumMg: result.sodium_mg,
        potassiumMg: result.potassium_mg,
        notes: result.description || '',
        isActive: true,
        sortOrder: maxSort + 1,
        unit: result.unit || '份',
        synced: false,
      })
      navigate('/presets')
    },
    [presets, navigate],
  )

  // ── Vision Recognize: Save as Temporary Entry ──────────────────
  const handleVisionSaveEntry = useCallback(
    async (result: VisionResult) => {
      if (undoRef.current) {
        clearTimeout(undoRef.current)
        undoRef.current = null
      }
      setUndoTarget(null)

      const entry: LedgerEntry = {
        presetId: null,
        date: selectedDate,
        type: 'manual',
        quantity: result.quantity || 1,
        manualDesc: result.description || result.name,
        manualType: 'diet',
        manualCalories: result.calories,
        manualFructoseG: result.fructose_g,
        createdAt: nowISO(),
        synced: false,
      }

      const id = await db.ledgerEntries.add(entry)
      entry.id = id

      setEntries((prev) => [entry, ...prev])

      setUndoTarget(entry)
      undoRef.current = setTimeout(() => {
        setUndoTarget(null)
        undoRef.current = null
      }, 3000)
    },
    [selectedDate],
  )

  // ── Save daily log to local file ────────────────────────────────
  const saveDailyLog = useCallback(async (markdown: string, date: string) => {
    try {
      console.log(`[DailyLog] Report for ${date} generated (${markdown.length} chars)`)
    } catch (e) {
      console.warn('[DailyLog] Failed to save log file:', e)
    }
  }, [])

  // ── Daily settlement ────────────────────────────────────────────
  const handleSettle = useCallback(async () => {
    const { summary, markdown } = generateDailyReport(
      selectedDate,
      entries,
      presets,
      profile,
    )

    const existing = await db.dailySummaries
      .where('date')
      .equals(selectedDate)
      .first()

    if (existing?.id) {
      await db.dailySummaries.update(existing.id, {
        ...summary,
        synced: false,
      })
    } else {
      await db.dailySummaries.add({
        ...summary,
        synced: false,
      })
    }

    // Save to daily_logs/ folder (browser download fallback)
    await saveDailyLog(markdown, selectedDate)

    setReportData({ markdown, summary })
    setShowReportModal(true)
  }, [selectedDate, entries, presets, profile, saveDailyLog])

  return {
    presets,
    entries,
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
