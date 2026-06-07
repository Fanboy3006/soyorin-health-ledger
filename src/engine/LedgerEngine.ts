// ═══════════════════════════════════════════════════════════════════
// LedgerEngine — 流水引擎（CRUD + 撤销 + 计算）
// ═══════════════════════════════════════════════════════════════════

import { db, type LedgerEntry, type PresetAsset } from '../lib/db'
import { deleteRemoteRecord } from './SyncEngine'
import { nowISO } from '../utils/formatters'

/**
 * 加载指定日期的流水记录，按 createdAt 倒序。
 */
export async function loadEntries(date: string): Promise<LedgerEntry[]> {
  return await db.ledgerEntries
    .where('date')
    .equals(date)
    .reverse()
    .sortBy('createdAt')
}

/**
 * 一键记录预设。
 */
export async function addEntry(
  preset: PresetAsset,
  date: string,
): Promise<LedgerEntry> {
  const entry: LedgerEntry = {
    presetId: preset.id!,
    date,
    type: 'preset',
    quantity: 1,
    manualDesc: '',
    createdAt: nowISO(),
    synced: false,
  }

  const id = await db.ledgerEntries.add(entry)
  entry.id = id
  return entry
}

/**
 * 手动记录。
 */
export async function addManualEntry(
  data: {
    name: string
    type: 'diet' | 'training'
    calories: number
    notes: string
  },
  date: string,
): Promise<LedgerEntry> {
  const entry: LedgerEntry = {
    presetId: null,
    date,
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
  return entry
}

/**
 * 撤销（删除）流水记录。
 */
export async function undoEntry(id: number): Promise<void> {
  await db.ledgerEntries.delete(id)
}

/**
 * 修改流水数量。
 */
export async function updateEntryQuantity(
  entryId: number,
  newQuantity: number,
  date: string,
): Promise<void> {
  await db.ledgerEntries.update(entryId, {
    quantity: newQuantity,
    synced: false,
  })

  // Mark daily summary as unsynced if exists
  const existingSummary = await db.dailySummaries
    .where('date')
    .equals(date)
    .first()
  if (existingSummary?.id) {
    await db.dailySummaries.update(existingSummary.id, { synced: false })
  }
}

/**
 * 删除流水记录（本地 + 远程）。
 */
export async function deleteEntry(
  id: number,
  remoteId: string | undefined,
  isOnline: boolean,
  date: string,
): Promise<void> {
  await db.ledgerEntries.delete(id)

  if (remoteId && isOnline) {
    try {
      await deleteRemoteRecord('ledger_entries', remoteId)
    } catch (e) {
      console.error('[Delete] Failed to delete from Supabase:', e)
    }
  }

  // Mark daily summary as unsynced if exists
  const existingSummary = await db.dailySummaries
    .where('date')
    .equals(date)
    .first()
  if (existingSummary?.id) {
    await db.dailySummaries.update(existingSummary.id, { synced: false })
  }
}

/**
 * AI 识别：保存为预设。
 */
export async function saveVisionPreset(
  result: {
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
  },
  maxSortOrder: number,
): Promise<void> {
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
    sortOrder: maxSortOrder + 1,
    unit: result.unit || '份',
    synced: false,
  })
}

/**
 * AI 识别：保存为临时流水记录。
 */
export async function saveVisionEntry(
  result: {
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
  },
  date: string,
): Promise<LedgerEntry> {
  const entry: LedgerEntry = {
    presetId: null,
    date,
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
  return entry
}
