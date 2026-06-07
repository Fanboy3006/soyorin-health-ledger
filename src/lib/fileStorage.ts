// ═══════════════════════════════════════════════════════════════════
// File Storage — 日终清算报告自动保存到本地文件
// ═══════════════════════════════════════════════════════════════════

import { db } from './db'

const SETTINGS_KEY = 'report_save_dir'

/**
 * 保存日终清算报告到本地文件。
 *
 * 流程：
 * 1. 首次保存时弹出目录选择器，用户选择保存位置
 * 2. 将目录句柄保存到 IndexedDB（userPreferences）
 * 3. 后续保存直接写入同一目录
 * 4. 如果 File System Access API 不支持，降级为下载
 *
 * @param markdown - 报告内容
 * @param date - 日期 YYYY-MM-DD
 * @returns 保存的文件路径或 null（用户取消）
 */
export async function saveReportToFile(
  markdown: string,
  date: string,
): Promise<string | null> {
  const fileName = `${date}_Health_Ledger.md`

  // ── Try File System Access API ────────────────────────────────
  if ('showDirectoryPicker' in window) {
    try {
      const result = await saveWithFileSystemAPI(markdown, fileName)
      if (result !== null) return result
    } catch (e) {
      // User cancelled directory picker or other error
      if ((e as DOMException)?.name === 'AbortError') {
        return null
      }
      console.warn('[FileStorage] File System Access API failed, falling back to download:', e)
    }
  }

  // ── Fallback: trigger download ────────────────────────────────
  return triggerDownload(markdown, fileName)
}

/**
 * 使用 File System Access API 保存文件。
 * 首次保存时弹出目录选择器，后续自动写入同一目录。
 */
async function saveWithFileSystemAPI(
  content: string,
  fileName: string,
): Promise<string | null> {
  // 1. Get saved directory handle
  let dirHandle: FileSystemDirectoryHandle | null = null
  const saved = await db.userPreferences
    .where('visibleMetrics')
    .equals(SETTINGS_KEY)
    .first()

  if (saved?.remoteId) {
    try {
      dirHandle = await (window as any).showDirectoryPicker({
        id: saved.remoteId,
        mode: 'readwrite',
      })
    } catch {
      // Stored handle is invalid, reset
      await db.userPreferences.delete(saved.id!)
      dirHandle = null
    }
  }

  // 2. If no saved handle, ask user to pick a directory
  if (!dirHandle) {
    dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    })
    // Store the directory name as identifier
    await db.userPreferences.add({
      visibleMetrics: SETTINGS_KEY,
      remoteId: dirHandle!.name,
      synced: false,
    })
  }

  // dirHandle is guaranteed non-null from here (either restored or just picked)
  const handle: FileSystemDirectoryHandle = dirHandle!

  // 3. Check if file already exists
  let fileHandle: FileSystemFileHandle
  let finalFileName = fileName

  try {
    // Try to get existing file
    fileHandle = await handle.getFileHandle(fileName)
    // File exists — ask user what to do
    const action = confirm(
      `文件 "${fileName}" 已存在。\n\n确定覆盖？\n取消则自动添加后缀 (_v2)。`,
    )
    if (action) {
      // Overwrite — proceed
    } else {
      // Add suffix
      finalFileName = fileName.replace('.md', '_v2.md')
      fileHandle = await handle.getFileHandle(finalFileName, {
        create: true,
      })
    }
  } catch {
    // File doesn't exist, create new
    fileHandle = await handle.getFileHandle(fileName, { create: true })
  }

  // 4. Write content
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()

  return finalFileName
}

/**
 * 降级方案：通过 <a download> 触发文件下载
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
