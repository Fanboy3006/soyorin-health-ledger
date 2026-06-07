// ═══════════════════════════════════════════════════════════════════
// File Storage — 日终清算报告保存
// ═══════════════════════════════════════════════════════════════════

/**
 * 保存日终清算报告。
 *
 * - 开发环境（import.meta.env.DEV）：通过 /api/save-report 写入 daily_logs/{userId}/
 * - 生产环境（Vercel）：降级为浏览器下载
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

  // ── Dev: save via API middleware ───────────────────────────────
  if (import.meta.env.DEV) {
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
      console.error('[FileStorage] API save failed, falling back to download:', e)
      // Fall through to download
    }
  }

  // ── Production / fallback: trigger browser download ───────────
  return triggerDownload(markdown, filename)
}

/**
 * 通过 <a download> 触发浏览器下载
 */
function triggerDownload(content: string, fileName: string): string {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return fileName
}
