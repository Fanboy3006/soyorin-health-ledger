// ═══════════════════════════════════════════════════════════════════
// 日终清算报告弹窗（含 AI 评价）
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { type DailySummary } from '../lib/db'
import { supabase } from '../lib/supabaseClient'

interface DailySummaryModalProps {
  report: { markdown: string; summary: Omit<DailySummary, 'id' | 'synced'> }
  onClose: () => void
}

export default function DailySummaryModal({
  report,
  onClose,
}: DailySummaryModalProps) {
  const [copied, setCopied] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiCopied, setAiCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = report.markdown
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleAiAudit = async () => {
    setAiLoading(true)
    setAiError(null)
    setAiEvaluation(null)

    const s = report.summary

    try {
      const { data, error } = await supabase.functions.invoke('ai-daily-audit', {
        body: {
          date: s.date,
          intakeCal: s.totalCal ?? 0,
          burnedCal: s.totalBurnedCal ?? 0,
          netCal: s.netCal ?? 0,
          proteinG: s.totalProteinG ?? 0,
          sodiumMg: s.totalSodiumMg ?? 0,
          potassiumMg: s.totalPotassiumMg ?? 0,
          naKRatio: s.naKRatio ?? 0,
        },
      })

      if (error) {
        setAiError(error.message || 'AI 评价请求失败')
      } else if (data?.evaluation) {
        setAiEvaluation(data.evaluation)
      } else {
        setAiError('AI 返回了空结果')
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '请求失败，请检查网络')
    } finally {
      setAiLoading(false)
    }
  }

  const handleCopyEvaluation = async () => {
    if (!aiEvaluation) return
    try {
      await navigator.clipboard.writeText(aiEvaluation)
      setAiCopied(true)
      setTimeout(() => setAiCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = aiEvaluation
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setAiCopied(true)
      setTimeout(() => setAiCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            日终清算报告 — {report.summary.date}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Report preview */}
        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 mb-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
          {report.markdown}
        </div>

        {/* AI Evaluation section */}
        {aiEvaluation && (
          <div className="mb-4 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                🤖 AI 评价
              </p>
              <button
                onClick={handleCopyEvaluation}
                className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {aiCopied ? '✅ 已复制' : '📋 复制'}
              </button>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
              {aiEvaluation}
            </div>
          </div>
        )}

        {/* AI Error */}
        {aiError && (
          <div className="mb-4 shrink-0 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            ❌ {aiError}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleAiAudit}
            disabled={aiLoading}
            className="flex-1 text-sm py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiLoading ? '⏳ AI 分析中…' : '🤖 AI 评价'}
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 text-sm py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
          >
            {copied ? '✅ 已复制' : '📋 复制报告'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-sm py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
