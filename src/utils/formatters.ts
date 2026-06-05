// ═══════════════════════════════════════════════════════════════════
// 数值格式化工具函数
// ═══════════════════════════════════════════════════════════════════

/** 获取 EST 时区的当前日期字符串 (YYYY-MM-DD) */
export function todayStr(): string {
  return estDateStr(new Date())
}

/** 获取 EST 时区的当前 ISO 时间戳 */
export function nowISO(): string {
  return estNow().toISOString()
}

/** 将 ISO 时间戳格式化为 HH:MM（按 EST 显示） */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  return estDatePart(d).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/New_York',
  })
}

/** 将任意 Date 转换为 EST 时区的 YYYY-MM-DD 字符串 */
function estDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** 返回一个表示 EST 当前时间的 Date 对象（用于生成 ISO 时间戳） */
function estNow(): Date {
  const estStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  return new Date(estStr)
}

/** 将任意 Date 转换为 EST 时区的 Date 对象（保留日期部分） */
function estDatePart(date: Date): Date {
  const estStr = date.toLocaleString('en-US', { timeZone: 'America/New_York' })
  return new Date(estStr)
}

export function r1(n: number): number {
  return Math.round(n * 10) / 10
}

export function r0(n: number): number {
  return Math.round(n)
}
