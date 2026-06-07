// ═══════════════════════════════════════════════════════════════════
// PresetEngine — 预设引擎（CRUD + 排序 + 批量操作）
// ═══════════════════════════════════════════════════════════════════

import { db, type PresetAsset } from '../lib/db'
import { deletePresetCompletely, deletePresetsBatch } from './SyncEngine'

/**
 * 加载所有预设，按 sortOrder 排序。
 */
export async function loadPresets(): Promise<PresetAsset[]> {
  return await db.presetAssets.orderBy('sortOrder').toArray()
}

/**
 * 添加预设。
 */
export async function addPreset(preset: Omit<PresetAsset, 'id'>): Promise<number | undefined> {
  return await db.presetAssets.add(preset as PresetAsset)
}

/**
 * 更新预设。
 */
export async function updatePreset(id: number, changes: Partial<PresetAsset>): Promise<void> {
  await db.presetAssets.update(id, changes)
}

/**
 * 删除预设（本地 + 远程）。
 */
export async function deletePreset(id: number): Promise<boolean> {
  return await deletePresetCompletely(id)
}

/**
 * 批量删除预设。
 */
export async function deletePresets(ids: number[]): Promise<number> {
  return await deletePresetsBatch(ids)
}

/**
 * 获取最大 sortOrder 值。
 */
export async function getMaxSortOrder(): Promise<number> {
  const all = await db.presetAssets.orderBy('sortOrder').toArray()
  return all.reduce((m, p) => Math.max(m, p.sortOrder), 0)
}

/**
 * 根据 type 过滤预设。
 */
export async function getPresetsByType(type: 'diet' | 'training'): Promise<PresetAsset[]> {
  return await db.presetAssets.where('type').equals(type).toArray()
}

/**
 * 获取活跃预设。
 */
export async function getActivePresets(): Promise<PresetAsset[]> {
  return await db.presetAssets
    .where('isActive')
    .equals(1)
    .toArray()
}
