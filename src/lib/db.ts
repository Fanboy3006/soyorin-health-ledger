import Dexie, { type EntityTable } from 'dexie'

// ═══════════════════════════════════════════════════════════════════
// Type Definitions — mirrors Supabase 5-table schema
// ═══════════════════════════════════════════════════════════════════

/** 表 1：preset_assets（模块预设资产） */
export interface PresetAsset {
  id?: number
  /** Supabase uuid — stored as string for offline-first, set after sync */
  remoteId?: string
  name: string
  type: 'diet' | 'training'
  /** 饮食热量 (kcal) — 仅 diet 类型使用 */
  calories: number
  /** 训练消耗热量 (kcal) — 仅 training 类型使用 */
  caloriesBurned: number
  proteinG: number
  fatG: number
  carbG: number
  fructoseG: number // 果糖 (g)
  sodiumMg: number
  potassiumMg: number
  notes: string
  metaJson?: string // JSON string — training action list or diet extras
  isActive: boolean
  sortOrder: number
  /** 计量单位，如"份"、"克"、"个"、"次"等 */
  unit: string
  /** 最近使用时间 (ISO 8601)，用于动态排序 */
  lastUsedAt?: string
  /** 创建时间 (ISO 8601)，用于排序兜底 */
  createdAt?: string
  synced: boolean
}

/** 表 2：ledger_entries（流水记录） */
export interface LedgerEntry {
  id?: number
  remoteId?: string
  date: string // YYYY-MM-DD
  presetId: number | null // FK → presetAssets.id (local)
  type: 'preset' | 'manual'
  quantity: number
  manualDesc: string
  /** 手动录入时的饮食/训练类型 — 仅 type='manual' 时使用 */
  manualType?: 'diet' | 'training'
  /** 手动录入时的热量值 (kcal) — 仅 type='manual' 时使用 */
  manualCalories?: number
  /** 手动录入时的果糖 (g) — 仅 type='manual' 时使用 */
  manualFructoseG?: number
  createdAt: string // ISO 8601
  synced: boolean
}

/** 表 3：daily_summaries（日终清算） */
export interface DailySummary {
  id?: number
  remoteId?: string
  date: string // YYYY-MM-DD (unique)
  totalCal: number
  totalBurnedCal: number
  netCal: number
  totalProteinG: number
  totalFatG: number
  totalCarbG: number
  totalFructoseG: number // 果糖
  totalSodiumMg: number
  totalPotassiumMg: number
  naKRatio: number
  bmr: number
  calDiff: number
  entryCount: number
  markdown: string // full Markdown report
  synced: boolean
}

/** 表 4：biometrics（体征数据） */
export interface Biometric {
  id?: number
  remoteId?: string
  date: string // YYYY-MM-DD
  weightLbs: number
  bpSystolic: number
  bpDiastolic: number
  restingHr: number
  source: 'manual' | 'healthkit' | 'webhook'
  synced: boolean
}

/** 表 5：ai_sessions（AI 对话存档） */
export interface AiSession {
  id?: number
  remoteId?: string
  createdAt: string // ISO 8601
  sessionType: 'audit' | 'parse'
  contextWindowJson: string
  messagesJson: string
  synced: boolean
}

/** 表 6：user_profile（用户档案 — BMR 计算用） */
export interface UserProfile {
  id?: number
  remoteId?: string
  weightLbs: number
  heightCm: number
  age: number
  gender: 'male' | 'female'
  /** 活动系数，BMR × activityFactor = 每日基础消耗，范围 0.5 ~ 1.5，默认 1.0 */
  activityFactor: number
  synced: boolean
}

/** 表 7：user_preferences（用户偏好 — 追踪项设置） */
export interface UserPreferences {
  id?: number
  remoteId?: string
  /** 逗号分隔的可见指标 key 列表 */
  visibleMetrics: string
  synced: boolean
}

/** 表 8：user_settings（用户设置 — 键值对存储，如文件保存目录） */
export interface UserSetting {
  id?: number
  key: string
  value: string
}

// ═══════════════════════════════════════════════════════════════════
// Dexie Database
// ═══════════════════════════════════════════════════════════════════

export class SoyorinDB extends Dexie {
  presetAssets!: EntityTable<PresetAsset, 'id'>
  ledgerEntries!: EntityTable<LedgerEntry, 'id'>
  dailySummaries!: EntityTable<DailySummary, 'id'>
  biometrics!: EntityTable<Biometric, 'id'>
  aiSessions!: EntityTable<AiSession, 'id'>
  userProfile!: EntityTable<UserProfile, 'id'>
  userPreferences!: EntityTable<UserPreferences, 'id'>
  userSettings!: EntityTable<UserSetting, 'id'>

  constructor() {
    super('SoyorinDB')
    this.version(8).stores({
      presetAssets: '++id, remoteId, name, type, isActive, sortOrder, lastUsedAt, createdAt, synced',
      ledgerEntries: '++id, remoteId, date, presetId, type, createdAt, synced',
      dailySummaries: '++id, remoteId, date, synced',
      biometrics: '++id, remoteId, date, source, synced',
      aiSessions: '++id, remoteId, sessionType, createdAt, synced',
      userProfile: '++id, remoteId, synced',
      userPreferences: '++id, remoteId, synced',
      userSettings: '++id, &key',
    })
  }
}

export const db = new SoyorinDB()

// ═══════════════════════════════════════════════════════════════════
// Default visible metrics
// ═══════════════════════════════════════════════════════════════════

export const ALL_METRICS = [
  { key: 'calories', label: '卡路里（摄入/消耗/净热量）', default: true },
  { key: 'protein', label: '蛋白质 (g)', default: true },
  { key: 'fructose', label: '果糖 (g)', default: false },
  { key: 'sodium', label: '钠 (mg)', default: true },
  { key: 'potassium', label: '钾 (mg)', default: true },
] as const

export type MetricKey = (typeof ALL_METRICS)[number]['key']

export function defaultVisibleMetrics(): MetricKey[] {
  return ALL_METRICS.filter((m) => m.default).map((m) => m.key)
}

export async function loadVisibleMetrics(): Promise<MetricKey[]> {
  const prefs = await db.userPreferences.limit(1).first()
  if (prefs?.visibleMetrics) {
    return prefs.visibleMetrics.split(',').filter(Boolean) as MetricKey[]
  }
  return defaultVisibleMetrics()
}

export async function saveVisibleMetrics(keys: MetricKey[]) {
  const existing = await db.userPreferences.limit(1).first()
  const value = keys.join(',')
  if (existing?.id) {
    await db.userPreferences.update(existing.id, { visibleMetrics: value, synced: false })
  } else {
    await db.userPreferences.add({ visibleMetrics: value, synced: false })
  }
}

// ═══════════════════════════════════════════════════════════════════
// BMR Calculation (Mifflin-St Jeor)
// ═══════════════════════════════════════════════════════════════════

export function calcBMR(
  weightLbs: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female',
): number {
  const weightKg = weightLbs / 2.205
  if (gender === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5)
  } else {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161)
  }
}

// ═══════════════════════════════════════════════════════════════════
// Sample Data Initialization
// ═══════════════════════════════════════════════════════════════════

export async function initSampleData() {
  // Initialize default user profile if not exists
  const profileCount = await db.userProfile.count()
  if (profileCount === 0) {
    await db.userProfile.add({
      weightLbs: 167,
      heightCm: 175,
      age: 37,
      gender: 'male',
      activityFactor: 1.0,
      synced: false,
    })
  }
}

// ═══════════════════════════════════════════════════════════════════
// Daily Report Generator
// ═══════════════════════════════════════════════════════════════════

export interface ReportResult {
  summary: Omit<DailySummary, 'id' | 'synced'>
  markdown: string
}

/**
 * Generate a daily end-of-day report from ledger entries + presets + profile.
 */
export function generateDailyReport(
  date: string,
  entries: LedgerEntry[],
  presets: PresetAsset[],
  profile: UserProfile | null,
): ReportResult {
  // ── Aggregate nutrition from diet entries ──────────────────────
  let totalCal = 0
  let totalProteinG = 0
  let totalFatG = 0
  let totalCarbG = 0
  let totalFructoseG = 0
  let totalSodiumMg = 0
  let totalPotassiumMg = 0
  let totalBurnedCal = 0
  let entryCount = 0

  const dietEntries: string[] = []
  const trainingEntries: string[] = []

  for (const entry of entries) {
    entryCount++
    if (entry.type === 'manual') {
      if (entry.manualType === 'diet') {
        totalCal += entry.manualCalories ?? 0
        totalFructoseG += entry.manualFructoseG ?? 0
        dietEntries.push(
          `  - ${entry.manualDesc}：${entry.manualCalories ?? 0} kcal`,
        )
      } else if (entry.manualType === 'training') {
        totalBurnedCal += entry.manualCalories ?? 0
        trainingEntries.push(
          `  - ${entry.manualDesc}：${entry.manualCalories ?? 0} kcal`,
        )
      }
      continue
    }

    // preset entry
    const preset = presets.find((p) => p.id === entry.presetId)
    if (!preset) continue

    const qty = entry.quantity
    if (preset.type === 'diet') {
      totalCal += preset.calories * qty
      totalProteinG += preset.proteinG * qty
      totalFatG += preset.fatG * qty
      totalCarbG += preset.carbG * qty
      totalFructoseG += preset.fructoseG * qty
      totalSodiumMg += preset.sodiumMg * qty
      totalPotassiumMg += preset.potassiumMg * qty
      dietEntries.push(
        `  - ${preset.name} ×${qty}：${preset.calories * qty} kcal` +
          (preset.notes ? `（${preset.notes}）` : ''),
      )
    } else {
      totalBurnedCal += preset.caloriesBurned * qty
      trainingEntries.push(
        `  - ${preset.name} ×${qty}：${preset.caloriesBurned * qty} kcal` +
          (preset.notes ? `（${preset.notes}）` : ''),
      )
    }
  }

  const netCal = totalCal - totalBurnedCal
  const bmr = profile
    ? calcBMR(profile.weightLbs, profile.heightCm, profile.age, profile.gender)
    : 0
  const baseBurn = profile
    ? Math.round(bmr * (profile.activityFactor ?? 1.0))
    : 0
  const calDiff = totalCal - bmr
  const trueDeficit = totalCal - baseBurn - totalBurnedCal
  const naKRatio =
    totalPotassiumMg > 0
      ? Math.round((totalSodiumMg / totalPotassiumMg) * 100) / 100
      : 0

  // ── Build Markdown report ──────────────────────────────────────
  const lines: string[] = []
  lines.push(`# 日终清算报告 — ${date}`)
  lines.push('')
  lines.push('## 一、热量总览')
  lines.push('')
  lines.push(`| 指标 | 数值 |`)
  lines.push(`|------|------|`)
  lines.push(`| 总摄入 | ${totalCal} kcal |`)
  lines.push(`| 总消耗（运动） | ${totalBurnedCal} kcal |`)
  lines.push(`| 净摄入 | ${netCal} kcal |`)
  lines.push(`| BMR | ${bmr} kcal/d |`)
  lines.push(`| 基础消耗（BMR×系数） | ${baseBurn} kcal/d |`)
  lines.push(`| 热量盈亏 | ${trueDeficit > 0 ? '+' : ''}${trueDeficit} kcal |`)
  lines.push('')
  lines.push('> 净摄入 = 摄入 − 运动消耗 | 热量盈亏 = 净摄入 − 基础消耗')
  lines.push('')
  lines.push('## 二、宏量营养素')
  lines.push('')
  lines.push(`| 营养素 | 摄入量 |`)
  lines.push(`|--------|--------|`)
  lines.push(`| 蛋白质 | ${Math.round(totalProteinG * 10) / 10} g |`)
  lines.push(`| 脂肪 | ${Math.round(totalFatG * 10) / 10} g |`)
  lines.push(`| 碳水 | ${Math.round(totalCarbG * 10) / 10} g |`)
  lines.push(`| 果糖 | ${Math.round(totalFructoseG * 10) / 10} g |`)
  lines.push('')
  lines.push('## 三、电解质')
  lines.push('')
  lines.push(`| 指标 | 数值 |`)
  lines.push(`|------|------|`)
  lines.push(`| 钠 | ${Math.round(totalSodiumMg)} mg |`)
  lines.push(`| 钾 | ${Math.round(totalPotassiumMg)} mg |`)
  lines.push(`| 钠钾比 | ${naKRatio} |`)
  lines.push('')
  lines.push('## 四、饮食明细')
  lines.push('')
  if (dietEntries.length > 0) {
    lines.push(...dietEntries)
  } else {
    lines.push('  （无饮食记录）')
  }
  lines.push('')
  lines.push('## 五、训练明细')
  lines.push('')
  if (trainingEntries.length > 0) {
    lines.push(...trainingEntries)
  } else {
    lines.push('  （无训练记录）')
  }
  lines.push('')
  lines.push('---')
  lines.push(`*共 ${entryCount} 条流水记录 | 由 Soyorin 健康账本自动生成*`)

  const markdown = lines.join('\n')

  const summary: Omit<DailySummary, 'id' | 'synced'> = {
    date,
    totalCal: Math.round(totalCal),
    totalBurnedCal: Math.round(totalBurnedCal),
    netCal: Math.round(netCal),
    totalProteinG: Math.round(totalProteinG * 10) / 10,
    totalFatG: Math.round(totalFatG * 10) / 10,
    totalCarbG: Math.round(totalCarbG * 10) / 10,
    totalFructoseG: Math.round(totalFructoseG * 10) / 10,
    totalSodiumMg: Math.round(totalSodiumMg),
    totalPotassiumMg: Math.round(totalPotassiumMg),
    naKRatio,
    bmr,
    calDiff,
    entryCount,
    markdown,
  }

  return { summary, markdown }
}

// ═══════════════════════════════════════════════════════════════════
// Batch Fructose Estimation via AI
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate fructose_g for all diet presets that have fructoseG === 0.
 * Calls the ai-add-metric Edge Function with existing preset data.
 * Returns the number of presets updated.
 */
export async function estimateFructoseForAllDietPresets(
  invokeFn: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>,
): Promise<number> {
  const dietPresets = await db.presetAssets
    .where('type')
    .equals('diet')
    .filter((p) => p.fructoseG === 0)
    .toArray()

  if (dietPresets.length === 0) return 0

  // Build existingPresets payload for AI
  const existingPresets = dietPresets.map((p) => ({
    name: p.name,
    type: p.type,
    calories: p.calories,
    protein_g: p.proteinG,
    fat_g: p.fatG,
    carb_g: p.carbG,
    notes: p.notes,
  }))

  const { data, error } = await invokeFn('ai-add-metric', {
    body: {
      prompt: '请为以下所有预设估算果糖含量（fructose_g），根据食物名称、热量和营养素合理推断。',
      existingPresets,
    },
  })

  if (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }

  const result = data as {
    metrics?: Array<{ key: string }>
    presetEstimates?: Array<{ name: string; values: Record<string, number> }>
  }

  if (!result?.presetEstimates || result.presetEstimates.length === 0) {
    throw new Error('AI 未返回估算结果')
  }

  // Update each preset with estimated fructose_g
  let updatedCount = 0
  for (const estimate of result.presetEstimates) {
    const fructoseG = estimate.values?.fructose_g
    if (fructoseG === undefined || fructoseG === null) continue

    const preset = dietPresets.find(
      (p) => p.name === estimate.name && p.id !== undefined,
    )
    if (!preset?.id) continue

    await db.presetAssets.update(preset.id, {
      fructoseG: Math.round(fructoseG * 10) / 10,
      synced: false,
    })
    updatedCount++
  }

  return updatedCount
}
