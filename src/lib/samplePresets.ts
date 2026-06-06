// ═══════════════════════════════════════════════════════════════════
// Sample Presets — 注册后自动创建的示例预设
// ═══════════════════════════════════════════════════════════════════

import { db, type PresetAsset } from './db'

export const SAMPLE_PRESETS: Array<Omit<PresetAsset, 'id'>> = [
  {
    name: '2C1S',
    type: 'diet',
    calories: 120,
    caloriesBurned: 0,
    proteinG: 32,
    fatG: 12,
    carbG: 48,
    fructoseG: 0,
    sodiumMg: 320,
    potassiumMg: 600,
    notes: '含隐性乳脂、0糖代糖',
    isActive: true,
    sortOrder: 1,
    unit: '份',
    synced: false,
  },
  {
    name: '蹲日训练包',
    type: 'training',
    calories: 0,
    caloriesBurned: 350,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    fructoseG: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    notes: '徒手保加利亚蹲、角度腿举、B-stance RDL',
    metaJson: JSON.stringify([
      { name: '徒手保加利亚蹲', sets: 4, reps: 12 },
      { name: '角度腿举', sets: 4, reps: 10 },
      { name: 'B-stance RDL', sets: 3, reps: 12 },
    ]),
    isActive: true,
    sortOrder: 2,
    unit: '次',
    synced: false,
  },
  {
    name: '草莓 300g',
    type: 'diet',
    calories: 96,
    caloriesBurned: 0,
    proteinG: 2,
    fatG: 0.4,
    carbG: 23,
    fructoseG: 7,
    sodiumMg: 2,
    potassiumMg: 460,
    notes: '',
    isActive: true,
    sortOrder: 3,
    unit: '克',
    synced: false,
  },
  {
    name: 'Trio Ratio',
    type: 'diet',
    calories: 180,
    caloriesBurned: 0,
    proteinG: 32,
    fatG: 4,
    carbG: 28,
    fructoseG: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    notes: '1 Cup 克数与 32g 蛋白资产',
    isActive: true,
    sortOrder: 4,
    unit: '杯',
    synced: false,
  },
]

/**
 * 创建示例预设（仅在本地无预设时执行）。
 * 在用户注册成功后调用，确保新用户开箱即用。
 */
export async function createSamplePresets(): Promise<void> {
  const count = await db.presetAssets.count()
  if (count > 0) {
    console.log('[SamplePresets] Local presets already exist, skipping')
    return
  }

  await db.presetAssets.bulkAdd(SAMPLE_PRESETS)
  console.log(`[SamplePresets] Created ${SAMPLE_PRESETS.length} sample presets`)
}
