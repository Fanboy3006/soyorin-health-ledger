// ═══════════════════════════════════════════════════════════════════
// File Storage — 日终清算报告保存到 daily_logs/{userId}/
// ═══════════════════════════════════════════════════════════════════

/**
 * 保存日终清算报告到 daily_logs/{userId}/ 目录。
 *
 * 通过 Vite 开发服务器的 /api/save-report 中间件写入文件。
 * 路径结构：daily_logs/{userId}/YYYY-MM-DD_Health_Ledger.md
 *
 * @param markdown - 报告内容
 * @param date - 日期 YYYY-MM-DD
 * @param userId - 当前登录用户的 ID
 * @returns 保存的文件名或 null（失败）
 */
export async function saveReportToFile(
  markdown: string,
  date: string,
  userId: string,
): Promise<string | null> {
  const filename = `${date}_Health_Ledger.md`

  try {
    const res = await fetch('/api/save-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, content: markdown, filename }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || '保存失败')
    }

    const data = await res.json()
    if (data.success) {
      return filename
    }
    throw new Error(data.error || '保存失败')
  } catch (e) {
    console.error('[FileStorage] Save failed:', e)
    throw e
  }
}
