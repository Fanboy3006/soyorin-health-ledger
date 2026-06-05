import Dexie from 'dexie'
import { db } from './db'
import { supabase } from './supabaseClient'

// ═══════════════════════════════════════════════════════════════════
// Table name mapping (local → Supabase)
// ═══════════════════════════════════════════════════════════════════

const TABLES = {
  presetAssets: 'preset_assets',
  ledgerEntries: 'ledger_entries',
  dailySummaries: 'daily_summaries',
  biometrics: 'biometrics',
  aiSessions: 'ai_sessions',
  userProfile: 'user_profile',
  userPreferences: 'user_preferences',
} as const

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/** Convert a local record to a Supabase row (snake_case keys). */
function toRemoteRow(table: string, record: any, userId: string): Record<string, any> {
  const base = { user_id: userId }
  switch (table) {
    case 'preset_assets':
      return {
        ...base,
        name: record.name,
        type: record.type,
        calories: record.calories,
        calories_burned: record.caloriesBurned,
        protein_g: record.proteinG,
        fat_g: record.fatG,
        carb_g: record.carbG,
        fructose_g: record.fructoseG ?? 0,
        sodium_mg: record.sodiumMg,
        potassium_mg: record.potassiumMg,
        notes: record.notes,
        meta_json: record.metaJson ?? null,
        is_active: record.isActive,
        sort_order: record.sortOrder,
        unit: record.unit ?? '份',
        created_at: record.createdAt ?? new Date().toISOString(),
      }
    case 'ledger_entries':
      return {
        ...base,
        date: record.date,
        preset_id: record.presetId,
        type: record.type,
        quantity: record.quantity,
        manual_desc: record.manualDesc,
        manual_type: record.manualType ?? null,
        manual_calories: record.manualCalories ?? null,
        manual_fructose_g: record.manualFructoseG ?? null,
        created_at: record.createdAt,
      }
    case 'daily_summaries':
      return {
        ...base,
        date: record.date,
        total_cal: record.totalCal,
        total_burned_cal: record.totalBurnedCal,
        net_cal: record.netCal,
        total_protein_g: record.totalProteinG,
        total_fat_g: record.totalFatG,
        total_carb_g: record.totalCarbG,
        total_fructose_g: record.totalFructoseG ?? 0,
        total_sodium_mg: record.totalSodiumMg,
        total_potassium_mg: record.totalPotassiumMg,
        na_k_ratio: record.naKRatio,
        bmr: record.bmr,
        cal_diff: record.calDiff,
        entry_count: record.entryCount,
        markdown: record.markdown,
        created_at: new Date().toISOString(),
      }
    case 'biometrics':
      return {
        ...base,
        date: record.date,
        weight_lbs: record.weightLbs,
        bp_systolic: record.bpSystolic,
        bp_diastolic: record.bpDiastolic,
        resting_hr: record.restingHr,
        source: record.source,
        created_at: record.createdAt ?? new Date().toISOString(),
      }
    case 'ai_sessions':
      return {
        ...base,
        created_at: record.createdAt,
        session_type: record.sessionType,
        context_window_json: record.contextWindowJson,
        messages_json: record.messagesJson,
      }
    case 'user_profile':
      return {
        ...base,
        weight_lbs: record.weightLbs,
        height_cm: record.heightCm,
        age: record.age,
        gender: record.gender,
        activity_factor: record.activityFactor ?? 1.0,
        created_at: new Date().toISOString(),
      }
    case 'user_preferences':
      return {
        ...base,
        visible_metrics: record.visibleMetrics,
        created_at: new Date().toISOString(),
      }
    default:
      return { ...base, ...record }
  }
}

/** Convert a Supabase row (snake_case) to a local record (camelCase). */
function toLocalRecord(table: string, row: any): any {
  switch (table) {
    case 'preset_assets':
      return {
        remoteId: row.id,
        name: row.name,
        type: row.type,
        calories: row.calories,
        caloriesBurned: row.calories_burned,
        proteinG: row.protein_g,
        fatG: row.fat_g,
        carbG: row.carb_g,
        fructoseG: row.fructose_g ?? 0,
        sodiumMg: row.sodium_mg,
        potassiumMg: row.potassium_mg,
        notes: row.notes ?? '',
        metaJson: row.meta_json,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        unit: row.unit ?? '份',
        createdAt: row.created_at,
        synced: true,
      }
    case 'ledger_entries':
      return {
        remoteId: row.id,
        date: row.date,
        presetId: row.preset_id,
        type: row.type,
        quantity: row.quantity,
        manualDesc: row.manual_desc ?? '',
        manualType: row.manual_type,
        manualCalories: row.manual_calories,
        manualFructoseG: row.manual_fructose_g,
        createdAt: row.created_at,
        synced: true,
      }
    case 'daily_summaries':
      return {
        remoteId: row.id,
        date: row.date,
        totalCal: row.total_cal,
        totalBurnedCal: row.total_burned_cal,
        netCal: row.net_cal,
        totalProteinG: row.total_protein_g,
        totalFatG: row.total_fat_g,
        totalCarbG: row.total_carb_g,
        totalFructoseG: row.total_fructose_g ?? 0,
        totalSodiumMg: row.total_sodium_mg,
        totalPotassiumMg: row.total_potassium_mg,
        naKRatio: row.na_k_ratio,
        bmr: row.bmr,
        calDiff: row.cal_diff,
        entryCount: row.entry_count,
        markdown: row.markdown,
        synced: true,
      }
    case 'biometrics':
      return {
        remoteId: row.id,
        date: row.date,
        weightLbs: row.weight_lbs,
        bpSystolic: row.bp_systolic,
        bpDiastolic: row.bp_diastolic,
        restingHr: row.resting_hr,
        source: row.source,
        createdAt: row.created_at,
        synced: true,
      }
    case 'ai_sessions':
      return {
        remoteId: row.id,
        createdAt: row.created_at,
        sessionType: row.session_type,
        contextWindowJson: row.context_window_json,
        messagesJson: row.messages_json,
        synced: true,
      }
    case 'user_profile':
      return {
        remoteId: row.id,
        weightLbs: row.weight_lbs,
        heightCm: row.height_cm,
        age: row.age,
        gender: row.gender,
        activityFactor: row.activity_factor ?? 1.0,
        synced: true,
      }
    case 'user_preferences':
      return {
        remoteId: row.id,
        visibleMetrics: row.visible_metrics ?? '',
        synced: true,
      }
    default:
      return row
  }
}

// ═══════════════════════════════════════════════════════════════════
// Push: local → Supabase
// ═══════════════════════════════════════════════════════════════════

async function pushTable<T extends { id?: number; remoteId?: string; synced?: boolean }>(
  localTable: Dexie.Table<T, number>,
  remoteTable: string,
  userId: string,
  dateField?: string,
  dateValue?: string,
) {
  let unsynced: T[]
  if (dateField && dateValue) {
    unsynced = await (localTable as any)
      .where(dateField)
      .equals(dateValue)
      .filter((r: any) => !r.synced)
      .toArray()
  } else {
    unsynced = await (localTable as any)
      .filter((r: any) => !r.synced)
      .toArray()
  }

  console.log(`[Sync] pushTable ${remoteTable}: ${unsynced.length} unsynced records, userId=${userId}`)

  for (const record of unsynced) {
    const row = toRemoteRow(remoteTable, record, userId)
    console.log(`[Sync] pushTable ${remoteTable}: pushing record id=${record.id}, remoteId=${record.remoteId}`, JSON.stringify(row))

    if (record.remoteId) {
      const { error } = await supabase
        .from(remoteTable)
        .update(row)
        .eq('id', record.remoteId)
        .eq('user_id', userId)
        .select('id')

      if (error) {
        console.error(`[Sync] Failed to update ${remoteTable} ${record.remoteId}:`, error)
      } else {
        console.log(`[Sync] Successfully updated ${remoteTable} ${record.remoteId}`)
        await (localTable as any).update(record.id!, { synced: true })
      }
    } else {
      const { data, error } = await supabase
        .from(remoteTable)
        .insert(row)
        .select('id')
        .single()

      if (error) {
        console.error(`[Sync] Failed to insert ${remoteTable}:`, error)
      } else if (data) {
        console.log(`[Sync] Successfully inserted ${remoteTable}, got remoteId=${data.id}`)
        await (localTable as any).update(record.id!, {
          remoteId: data.id,
          synced: true,
        })
      } else {
        console.warn(`[Sync] Insert ${remoteTable} returned no data and no error`)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Pull: Supabase → local
// ═══════════════════════════════════════════════════════════════════

async function pullTable<T extends { id?: number; remoteId?: string; createdAt?: string }>(
  localTable: Dexie.Table<T, number>,
  remoteTable: string,
  userId: string,
  options?: { dateField?: string; dateValue?: string },
) {
  let query = supabase
    .from(remoteTable)
    .select('*')
    .eq('user_id', userId)

  if (options?.dateField && options?.dateValue) {
    query = query.eq(options.dateField, options.dateValue)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error(`[Sync] Failed to pull ${remoteTable}:`, error)
    return
  }

  if (!data || data.length === 0) return

  for (const row of data) {
    const existing = await (localTable as any)
      .where('remoteId')
      .equals(row.id)
      .first()

    const localRecord = toLocalRecord(remoteTable, row)

    if (!existing) {
      await (localTable as any).add(localRecord)
    } else if (
      localRecord.createdAt &&
      existing.createdAt &&
      new Date(localRecord.createdAt) > new Date(existing.createdAt)
    ) {
      await (localTable as any).update(existing.id!, localRecord)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Delete from Supabase
// ═══════════════════════════════════════════════════════════════════

export async function deleteRemoteRecord(remoteTable: string, remoteId: string) {
  const { error } = await supabase
    .from(remoteTable)
    .delete()
    .eq('id', remoteId)

  if (error) {
    console.error(`[Sync] Failed to delete ${remoteTable} ${remoteId}:`, error)
    throw error
  }
}

/**
 * Delete a preset from both local IndexedDB and remote Supabase.
 * If remoteId exists, also deletes from Supabase.
 * Returns true if the local record was found and deleted.
 */
export async function deletePresetCompletely(id: number): Promise<boolean> {
  const preset = await db.presetAssets.get(id)
  if (!preset) return false

  // Delete from Supabase if it has been synced
  if (preset.remoteId) {
    try {
      await deleteRemoteRecord('preset_assets', preset.remoteId)
    } catch (e) {
      console.error('[Sync] Failed to delete remote preset:', e)
      // Continue with local deletion even if remote fails
    }
  }

  // Delete from local IndexedDB
  await db.presetAssets.delete(id)
  return true
}

/**
 * Batch delete multiple presets from both local and remote.
 */
export async function deletePresetsBatch(ids: number[]): Promise<number> {
  let deletedCount = 0
  for (const id of ids) {
    const ok = await deletePresetCompletely(id)
    if (ok) deletedCount++
  }
  return deletedCount
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export async function pushAll(userId: string) {
  await Promise.all([
    pushTable(db.presetAssets as any, TABLES.presetAssets, userId),
    pushTable(db.ledgerEntries as any, TABLES.ledgerEntries, userId),
    pushTable(db.dailySummaries as any, TABLES.dailySummaries, userId),
    pushTable(db.biometrics as any, TABLES.biometrics, userId),
    pushTable(db.aiSessions as any, TABLES.aiSessions, userId),
    pushTable(db.userProfile as any, TABLES.userProfile, userId),
    pushTable(db.userPreferences as any, TABLES.userPreferences, userId),
  ])
}

export async function pullAll(date: string, userId: string) {
  await Promise.all([
    pullTable(db.ledgerEntries as any, TABLES.ledgerEntries, userId, {
      dateField: 'date',
      dateValue: date,
    }),
    pullTable(db.dailySummaries as any, TABLES.dailySummaries, userId, {
      dateField: 'date',
      dateValue: date,
    }),
    pullTable(db.biometrics as any, TABLES.biometrics, userId, {
      dateField: 'date',
      dateValue: date,
    }),
    pullTable(db.presetAssets as any, TABLES.presetAssets, userId),
    pullTable(db.aiSessions as any, TABLES.aiSessions, userId),
    pullTable(db.userProfile as any, TABLES.userProfile, userId),
    pullTable(db.userPreferences as any, TABLES.userPreferences, userId),
  ])
}

export async function fullSync(date: string, userId: string) {
  console.log('[Sync] Starting full sync...')

  await pushAll(userId)

  await pullAll(date, userId)

  console.log('[Sync] Full sync complete.')
}
