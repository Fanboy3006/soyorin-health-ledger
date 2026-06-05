import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────

type TrendMetric = 'netCal' | 'intake' | 'burned' | 'weight'
type RangeDays = 7 | 14 | 30

interface DayData {
  date: string // "MM-DD"
  fullDate: string // "YYYY-MM-DD"
  intake: number
  burned: number
  netCal: number
  weight: number
}

// ── Helpers ───────────────────────────────────────────────────────

function generateDateRange(days: number): string[] {
  const dates: string[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${day}`)
  }
  return dates
}

// ── Component ─────────────────────────────────────────────────────

export default function Trends() {
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────
  const [rangeDays, setRangeDays] = useState<RangeDays>(7)
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('netCal')
  const [dayData, setDayData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  // ── Load data ──────────────────────────────────────────────────
  const loadData = useCallback(async (days: number) => {
    setLoading(true)
    const dates = generateDateRange(days)

    const [allEntries, allPresets, allBiometrics] = await Promise.all([
      db.ledgerEntries.where('date').anyOf(dates).toArray(),
      db.presetAssets.toArray(),
      db.biometrics.where('date').anyOf(dates).toArray(),
    ])

    const weightMap = new Map<string, number>()
    for (const b of allBiometrics) {
      weightMap.set(b.date, b.weightLbs)
    }

    const data: DayData[] = dates.map((fullDate) => {
      const dayEntries = allEntries.filter((e) => e.date === fullDate)

      let intake = 0
      let burned = 0

      for (const e of dayEntries) {
        if (e.type === 'manual') {
          if (e.manualType === 'diet') intake += e.manualCalories ?? 0
          else if (e.manualType === 'training') burned += e.manualCalories ?? 0
        } else {
          const preset = allPresets.find((p) => p.id === e.presetId)
          if (!preset) continue
          if (preset.type === 'diet') {
            intake += preset.calories * e.quantity
          } else {
            burned += preset.caloriesBurned * e.quantity
          }
        }
      }

      return {
        date: fullDate.slice(5), // "MM-DD"
        fullDate,
        intake,
        burned,
        netCal: intake - burned,
        weight: weightMap.get(fullDate) ?? 0,
      }
    })

    setDayData(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData(rangeDays)
  }, [loadData, rangeDays])

  // ── Chart data ─────────────────────────────────────────────────
  const chartData = dayData.map((d) => {
    let value = 0
    if (trendMetric === 'netCal') value = d.netCal
    else if (trendMetric === 'intake') value = d.intake
    else if (trendMetric === 'burned') value = d.burned
    else if (trendMetric === 'weight') value = d.weight
    return { date: d.date, value }
  })

  // ── Metric config ──────────────────────────────────────────────
  const metricConfig: { key: TrendMetric; label: string; color: string; unit: string }[] = [
    { key: 'netCal', label: '净热量', color: '#6366f1', unit: 'kcal' },
    { key: 'intake', label: '摄入', color: '#10b981', unit: 'kcal' },
    { key: 'burned', label: '消耗', color: '#f43f5e', unit: 'kcal' },
    { key: 'weight', label: '体重', color: '#8b5cf6', unit: 'lbs' },
  ]

  const currentMetric = metricConfig.find((m) => m.key === trendMetric)!

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 cursor-pointer"
          >
            ← 返回首页
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            趋势分析
          </h1>
        </header>

        {/* Date range selector */}
        <section className="mb-4">
          <div className="flex gap-2">
            {([7, 14, 30] as RangeDays[]).map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`flex-1 text-sm py-2 rounded-xl transition-colors cursor-pointer ${
                  rangeDays === days
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                最近 {days} 天
              </button>
            ))}
          </div>
        </section>

        {/* Metric selector */}
        <section className="mb-4">
          <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
            {metricConfig.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTrendMetric(key)}
                className={`flex-1 text-xs py-2 rounded-lg transition-colors cursor-pointer ${
                  trendMetric === key
                    ? 'bg-gray-800 text-white font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Chart */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              {currentMetric.label}趋势
            </h2>
            <span className="text-xs text-gray-400">
              {currentMetric.unit === 'kcal' ? '千卡 (kcal)' : '磅 (lbs)'}
            </span>
          </div>
          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-300 text-sm">
                加载中…
              </div>
            ) : chartData.length > 0 && chartData.some((d) => d.value !== 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                    interval={rangeDays > 14 ? 2 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => {
                      const num = Number(value)
                      return [
                        `${num > 0 ? '+' : ''}${num} ${currentMetric.unit}`,
                        currentMetric.label,
                      ]
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={currentMetric.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-300 text-sm">
                暂无数据，开始记账后趋势图将自动生成
              </div>
            )}
          </div>
        </section>

        {/* Data table */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              每日明细
            </h2>
          </div>
          {dayData.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-300 text-sm">
              暂无数据
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="text-left px-4 py-2 font-medium">日期</th>
                    <th className="text-right px-2 py-2 font-medium">摄入</th>
                    <th className="text-right px-2 py-2 font-medium">消耗</th>
                    <th className="text-right px-2 py-2 font-medium">净热量</th>
                    <th className="text-right px-4 py-2 font-medium">体重</th>
                  </tr>
                </thead>
                <tbody>
                  {dayData.map((d) => (
                    <tr
                      key={d.fullDate}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-gray-600 font-medium">
                        {d.date}
                      </td>
                      <td className="px-2 py-2.5 text-right text-emerald-600 font-medium">
                        {d.intake > 0 ? `+${d.intake}` : '-'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-rose-500 font-medium">
                        {d.burned > 0 ? `-${d.burned}` : '-'}
                      </td>
                      <td
                        className={`px-2 py-2.5 text-right font-medium ${
                          d.netCal > 0
                            ? 'text-emerald-600'
                            : d.netCal < 0
                              ? 'text-rose-500'
                              : 'text-gray-400'
                        }`}
                      >
                        {d.netCal !== 0
                          ? `${d.netCal > 0 ? '+' : ''}${d.netCal}`
                          : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-purple-600 font-medium">
                        {d.weight > 0 ? `${d.weight} lbs` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
