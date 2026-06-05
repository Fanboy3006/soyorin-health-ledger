// ═══════════════════════════════════════════════════════════════════
// 数值格式化工具函数
// ═══════════════════════════════════════════════════════════════════

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function r1(n: number): number {
  return Math.round(n * 10) / 10
}

export function r0(n: number): number {
  return Math.round(n)
}
