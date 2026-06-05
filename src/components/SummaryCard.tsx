// ═══════════════════════════════════════════════════════════════════
// 今日汇总卡片组件（摄入/总消耗/净热量/BMR）
// 总消耗 = BMR × 活动系数 + 训练消耗
// 净热量 = 摄入 - 总消耗
// ═══════════════════════════════════════════════════════════════════

import { type MetricKey } from '../lib/db'
import { type NutritionTotals } from '../utils/calories'
import { r0 } from '../utils/formatters'

interface SummaryCardProps {
  totals: NutritionTotals
  bmr: number
  baseBurn: number
  netIntake: number
  calSurplus: number
  visibleMetrics: MetricKey[]
  onOpenBmr: () => void
  onOpenMetrics: () => void
}

const METRIC_LABELS: Record<MetricKey, string> = {
  calories: '热量',
  protein: '蛋白质',
  fructose: '果糖',
  sodium: '钠',
  potassium: '钾',
}

const METRIC_UNITS: Record<MetricKey, string> = {
  calories: 'kcal',
  protein: 'g',
  fructose: 'g',
  sodium: 'mg',
  potassium: 'mg',
}

function metricValue(totals: NutritionTotals, key: MetricKey): number {
  switch (key) {
    case 'calories':
      return totals.intakeTotal
    case 'protein':
      return totals.totalProteinG
    case 'fructose':
      return totals.totalFructoseG
    case 'sodium':
      return totals.totalSodiumMg
    case 'potassium':
      return totals.totalPotassiumMg
  }
}

export default function SummaryCard({
  totals,
  bmr,
  baseBurn,
  netIntake,
  calSurplus,
  visibleMetrics,
  onOpenBmr,
  onOpenMetrics,
}: SummaryCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">今日汇总</h2>
        <div className="flex gap-1">
          <button
            onClick={onOpenBmr}
            className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
          >
            BMR
          </button>
          <button
            onClick={onOpenMetrics}
            className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
          >
            指标
          </button>
        </div>
      </div>

      {/* Calories row: 摄入 | 消耗 | 净摄入 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-gray-400">摄入</div>
          <div className="text-lg font-bold text-gray-800">
            {totals.intakeTotal}
          </div>
          <div className="text-[10px] text-gray-400">kcal</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">消耗（运动）</div>
          <div className="text-lg font-bold text-rose-500">
            {totals.burnedTotal}
          </div>
          <div className="text-[10px] text-gray-400">kcal</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">净摄入</div>
          <div className="text-lg font-bold text-gray-800">
            {netIntake}
          </div>
          <div className="text-[10px] text-gray-400">kcal</div>
        </div>
      </div>

      {/* BMR info row */}
      <div className="flex justify-between text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <span>
          BMR: <strong>{bmr}</strong> kcal/d
        </span>
        <span>
          基础消耗: <strong>{baseBurn}</strong> kcal/d
        </span>
        <span>
          训练消耗: <strong>{totals.burnedTotal}</strong> kcal
        </span>
      </div>

      {/* 热量盈亏 = 净摄入 - 基础消耗 */}
      <div className="text-center">
        <span className="text-[11px] text-gray-500 mr-2">热量盈亏</span>
        <span
          className={`text-lg font-bold ${
            calSurplus < 0
              ? 'text-rose-500'
              : calSurplus > 0
                ? 'text-emerald-600'
                : 'text-gray-800'
          }`}
        >
          {calSurplus > 0 ? '+' : ''}
          {r0(calSurplus)}
        </span>
        <span className="text-[11px] text-gray-400 ml-1">kcal</span>
        <span className="text-[10px] text-gray-400 ml-2">
          {calSurplus < 0 ? '赤字' : calSurplus > 0 ? '盈余' : '平衡'}
        </span>
      </div>

      {/* Visible metrics */}
      <div className="grid grid-cols-2 gap-2">
        {visibleMetrics
          .filter((k) => k !== 'calories')
          .map((key) => (
            <div
              key={key}
              className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5"
            >
              <span className="text-gray-500">{METRIC_LABELS[key]}</span>
              <span className="font-medium text-gray-800">
                {metricValue(totals, key)} {METRIC_UNITS[key]}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
