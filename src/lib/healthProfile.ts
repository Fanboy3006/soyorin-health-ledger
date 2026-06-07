// ═══════════════════════════════════════════════════════════════════
// Health Profile — 用户健康档案管理
// ═══════════════════════════════════════════════════════════════════

import { db } from './db'
import { supabase } from './supabaseClient'

const PROFILE_FILENAME = 'health_profile.md'

/**
 * 获取用户健康档案。
 *
 * 优先从本地 IndexedDB 读取，降级到 Supabase。
 *
 * @param userId - 当前登录用户的 ID
 * @returns Markdown 格式的健康档案内容，或 null（不存在）
 */
export async function getHealthProfile(
  userId: string,
): Promise<string | null> {
  // 1. Try local IndexedDB
  const local = await db.userSettings.get({ key: `health_profile_${userId}` })
  if (local?.value) return local.value

  // 2. Try Supabase
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'health_profile')
      .single()

    if (data?.value) {
      // Cache locally
      await db.userSettings.put({
        key: `health_profile_${userId}`,
        value: data.value,
      })
      return data.value
    }
  } catch {
    // Supabase not available, return null
  }

  return null
}

/**
 * 保存用户健康档案。
 *
 * - 本地：保存到 IndexedDB userSettings
 * - 开发环境：同时保存到 daily_logs/{userId}/health_profile.md
 *
 * @param userId - 当前登录用户的 ID
 * @param content - Markdown 格式的健康档案内容
 */
export async function saveHealthProfile(
  userId: string,
  content: string,
): Promise<void> {
  // 1. Save locally
  await db.userSettings.put({
    key: `health_profile_${userId}`,
    value: content,
  })

  // 2. Save to Supabase
  try {
    // Upsert: check if exists
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .eq('key', 'health_profile')
      .single()

    if (existing?.id) {
      await supabase
        .from('user_settings')
        .update({ value: content })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('user_settings')
        .insert({ user_id: userId, key: 'health_profile', value: content })
    }
  } catch {
    // Supabase not available, local save is enough
  }

  // 3. Dev: save to file
  if (import.meta.env.DEV) {
    try {
      await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          content,
          filename: PROFILE_FILENAME,
        }),
      })
    } catch {
      // File save is best-effort
    }
  }
}

/**
 * 生成默认健康档案。
 *
 * 从 user_profile 表读取 BMR 相关数据，生成 Markdown 格式的档案。
 *
 * @param userId - 当前登录用户的 ID
 * @returns Markdown 格式的默认健康档案
 */
export async function getDefaultHealthProfile(
  userId: string,
): Promise<string> {
  let profileText = ''

  // Try to get user profile from local DB
  const localProfile = await db.userProfile.limit(1).first()
  if (localProfile) {
    profileText += `## 基本信息\n\n`
    profileText += `- 体重：${localProfile.weightLbs} lbs\n`
    profileText += `- 身高：${localProfile.heightCm} cm\n`
    profileText += `- 年龄：${localProfile.age}\n`
    profileText += `- 性别：${localProfile.gender === 'male' ? '男' : '女'}\n`
    profileText += `- 活动系数：${localProfile.activityFactor ?? 1.0}\n`
  }

  // Try Supabase
  try {
    const { data } = await supabase
      .from('user_profile')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (data) {
      profileText = `## 基本信息\n\n`
      profileText += `- 体重：${data.weight_lbs} lbs\n`
      profileText += `- 身高：${data.height_cm} cm\n`
      profileText += `- 年龄：${data.age}\n`
      profileText += `- 性别：${data.gender === 'male' ? '男' : '女'}\n`
      profileText += `- 活动系数：${data.activity_factor ?? 1.0}\n`
    }
  } catch {
    // Use local data if available
  }

  if (!profileText) {
    profileText = `## 基本信息\n\n（请在下方填写你的健康信息）\n`
  }

  profileText += `\n## 健康目标\n\n`
  profileText += `- 目标体重：\n`
  profileText += `- 每日热量目标：\n`
  profileText += `- 蛋白质目标：\n`
  profileText += `- 钠摄入限制：\n\n`
  profileText += `## 健康状况\n\n`
  profileText += `- 过敏史：\n`
  profileText += `- 慢性病：\n`
  profileText += `- 用药情况：\n`
  profileText += `- 其他备注：\n\n`
  profileText += `## 饮食偏好\n\n`
  profileText += `- 偏好：\n`
  profileText += `- 禁忌：\n`

  return profileText
}
