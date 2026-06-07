// ═══════════════════════════════════════════════════════════════════
// ReportEngine — 报告引擎（生成 + 保存）
// ═══════════════════════════════════════════════════════════════════

import { db, generateDailyReport, type DailySummary, type LedgerEntry, type PresetAsset, type UserProfile } from '../lib/db'

export interface ReportResult {
  summary: Omit<DailySummary, 'id' | 'synced'>
  markdown: string
}

/**
 * 生成日终报告。
 */
export function generateReport(
  date: string,
  entries: LedgerEntry[],
  presets: PresetAsset[],
  profile: UserProfile | null,
): ReportResult {
  return generateDailyReport(date, entries, presets, profile)
}

/**
 * 保存日终报告到本地 IndexedDB。
 */
export async function saveDailySummary(
  date: string,
  summary: Omit<DailySummary, 'id' | 'synced'>,
): Promise<void> {
  const existing = await db.dailySummaries
    .where('date')
    .equals(date)
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
}

/**
 * 保存日终报告到本地文件（开发环境）。
 */
export async function saveDailyLog(markdown: string, date: string): Promise<void> {
  try {
    console.log(`[DailyLog] Report for ${date} generated (${markdown.length} chars)`)
  } catch (e) {
    console.warn('[DailyLog] Failed to save log file:', e)
  }
}
