// ═══════════════════════════════════════════════════════════════════
// 热量计算函数
// ═══════════════════════════════════════════════════════════════════

import { type PresetAsset, type LedgerEntry } from '../lib/db'
import { r0, r1 } from './formatters'

export function entryType(
  e: LedgerEntry,
  presets: PresetAsset[],
): 'diet' | 'training' | undefined {
  if (e.type === 'manual') return e.manualType
  const preset = presets.find((p) => p.id === e.presetId)
  return preset?.type
}

export function entryCalories(
  e: LedgerEntry,
  presets: PresetAsset[],
): number {
  if (e.type === 'manual') return e.manualCalories ?? 0
  const preset = presets.find((p) => p.id === e.presetId)
  return (preset?.type === 'diet' ? preset.calories : preset?.caloriesBurned ?? 0) * e.quantity
}

export interface NutritionTotals {
  intakeTotal: number
  burnedTotal: number
  totalProteinG: number
  totalFructoseG: number
  totalSodiumMg: number
  totalPotassiumMg: number
}

export function calcTotals(
  entries: LedgerEntry[],
  presets: PresetAsset[],
): NutritionTotals {
  const intakeTotal = r0(entries.reduce((sum, e) => {
    return sum + (entryType(e, presets) === 'diet' ? entryCalories(e, presets) : 0)
  }, 0))

  const burnedTotal = r0(entries.reduce((sum, e) => {
    return sum + (entryType(e, presets) === 'training' ? entryCalories(e, presets) : 0)
  }, 0))

  const totalProteinG = r1(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.proteinG * e.quantity
  }, 0))

  const totalFructoseG = r1(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum + (e.manualFructoseG ?? 0)
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.fructoseG * e.quantity
  }, 0))

  const totalSodiumMg = r0(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.sodiumMg * e.quantity
  }, 0))

  const totalPotassiumMg = r0(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.potassiumMg * e.quantity
  }, 0))

  return { intakeTotal, burnedTotal, totalProteinG, totalFructoseG, totalSodiumMg, totalPotassiumMg }
}
