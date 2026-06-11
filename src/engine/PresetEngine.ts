// ═══════════════════════════════════════════════════════════════════
// PresetEngine — 预设引擎（CRUD + 排序 + 批量操作）
// ═══════════════════════════════════════════════════════════════════

import { db, type PresetAsset } from '../lib/db'
import { deletePresetCompletely, deletePresetsBatch } from './SyncEngine'

/**
 * 加载所有预设，按 lastUsedAt 倒序 > createdAt 倒序排序。
 * 排序规则：最近使用的排最前面，从未使用的按创建时间倒序。
 */
export async function loadPresets(): Promise<PresetAsset[]> {
  const all = await db.presetAssets.toArray()
  const sorted = all.sort((a, b) => {
    // lastUsedAt 倒序（有值的优先）
    if (a.lastUsedAt && b.lastUsedAt) {
      return b.lastUsedAt.localeCompare(a.lastUsedAt)
    }
    if (a.lastUsedAt && !b.lastUsedAt) return -1
    if (!a.lastUsedAt && b.lastUsedAt) return 1
    // 都没有 lastUsedAt，按 createdAt 倒序
    if (a.createdAt && b.createdAt) {
      return b.createdAt.localeCompare(a.createdAt)
    }
    if (a.createdAt && !b.createdAt) return -1
    if (!a.createdAt && b.createdAt) return 1
    // 最后按 sortOrder 兜底
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
  console.log('[PresetEngine] loadPresets sorted order:', sorted.map(p => ({
    id: p.id,
    name: p.name,
    lastUsedAt: p.lastUsedAt,
    createdAt: p.createdAt,
    sortOrder: p.sortOrder,
  })))
  return sorted
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
