// ═══════════════════════════════════════════════════════════════════
// Reports — 历史报告查看与下载
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/auth'

// ── Types ─────────────────────────────────────────────────────────

interface Report {
  id: string
  date: string
  total_cal: number
  total_burned_cal: number
  net_cal: number
  total_protein_g: number
  total_fat_g: number
  total_carb_g: number
  total_fructose_g: number
  total_sodium_mg: number
  total_potassium_mg: number
  na_k_ratio: number
  bmr: number
  cal_diff: number
  entry_count: number
  markdown: string
  created_at: string
}

// ── Component ─────────────────────────────────────────────────────

export default function Reports() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  // ── Fetch reports from Supabase ─────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const fetchReports = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .from('daily_summaries')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        if (error) throw error
        setReports(data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败')
        console.error('[Reports] Fetch failed:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [user?.id])

  // ── Download report as Markdown file ────────────────────────────
  const handleDownload = (report: Report) => {
    const blob = new Blob([report.markdown], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.date}_Health_Ledger.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Format helpers ──────────────────────────────────────────────
  const formatKcal = (v: number) => `${Math.round(v).toLocaleString()} kcal`
  const formatG = (v: number) => `${Math.round(v * 10) / 10} g`
  const formatMg = (v: number) => `${Math.round(v).toLocaleString()} mg`

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                历史报告
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                查看所有已结算的日终清算报告
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              ← 返回首页
            </button>
          </div>
        </header>

        {/* ── Loading ──────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-400">加载中…</p>
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-6">
            ❌ {error}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {!loading && !error && reports.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">暂无历史报告</p>
            <p className="text-gray-400 text-sm">
              在首页完成日终结账后，报告会自动保存到云端
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              去结算
            </button>
          </div>
        )}

        {/* ── Report list ──────────────────────────────────────── */}
        {!loading && !error && reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between">
                  {/* Date & summary */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-base">
                      {report.date}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>
                        摄入{' '}
                        <span className="font-medium text-emerald-600">
                          {formatKcal(report.total_cal)}
                        </span>
                      </span>
                      <span>
                        消耗{' '}
                        <span className="font-medium text-rose-600">
                          {formatKcal(report.total_burned_cal)}
                        </span>
                      </span>
                      <span>
                        净热量{' '}
                        <span
                          className={`font-medium ${
                            report.net_cal >= 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {formatKcal(report.net_cal)}
                        </span>
                      </span>
                      <span>蛋白质 {formatG(report.total_protein_g)}</span>
                      <span>钠 {formatMg(report.total_sodium_mg)}</span>
                      <span>钾 {formatMg(report.total_potassium_mg)}</span>
                      <span>
                        钠钾比{' '}
                        <span className="font-medium">
                          {report.na_k_ratio}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {report.entry_count} 条流水记录
                    </p>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(report)
                    }}
                    className="ml-4 shrink-0 text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer border border-blue-200"
                    title="下载 Markdown 文件"
                  >
                    ⬇ 下载
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Report detail modal ───────────────────────────────── */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                日终清算报告 — {selectedReport.date}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedReport)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer border border-blue-200"
                >
                  ⬇ 下载
                </button>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {selectedReport.markdown}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
