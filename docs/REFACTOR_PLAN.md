# REFACTOR PLAN — App.tsx 模块化拆分

> 生成日期：2026-06-01
> 目标文件：`src/App.tsx`（1,946 行 → 拆分后 ~250 行）
> 拆分策略：组件 6 个 + Hook 3 个 + 工具函数 2 个 = 11 个新文件

---

## 一、当前 App.tsx 结构总览

### 1.1 文件分区

| 区域 | 行号 | 行数 | 内容 |
|------|------|------|------|
| Imports | 1-19 | 19 | React、路由、Tesseract.js、db、sync、supabase |
| Helper 函数 | 21-53 | 33 | `todayStr`, `nowISO`, `formatTime`, `r1`, `r0` |
| **ManualEntryModal** | 55-140 | 86 | 手动录入弹窗组件 |
| **BmrModal** | 144-245 | 102 | BMR 设置弹窗组件 |
| **AiAddMetricModal** | 249-375 | 127 | AI 建议指标弹窗组件 |
| **MetricsModal** | 379-475 | 97 | 自定义追踪指标设置弹窗组件 |
| **DailySummaryModal** | 479-637 | 159 | 日终清算报告弹窗组件 |
| **QuantityEditModal** | 641-709 | 69 | 修改数量弹窗组件 |
| **VisionRecognizeModal** | 713-963 | 251 | AI 视觉识别弹窗组件（含 OCR） |
| **DeleteConfirmModal** | 967-1000 | 34 | 删除确认弹窗组件 |
| App 主组件（State） | 1004-1028 | 25 | 状态定义 |
| App 主组件（loadData） | 1030-1065 | 36 | 数据加载 |
| App 主组件（Network） | 1067-1077 | 11 | 网络状态监听 |
| App 主组件（Background sync） | 1079-1100 | 22 | 后台同步 |
| App 主组件（handleEntry） | 1102-1133 | 32 | 一键记录 |
| App 主组件（handleManualEntry） | 1135-1172 | 38 | 手动录入处理 |
| App 主组件（handleUndo） | 1174-1184 | 11 | 撤销 |
| App 主组件（handleQuantityEdit） | 1186-1211 | 26 | 修改数量处理 |
| App 主组件（handleDeleteEntry） | 1213-1237 | 25 | 删除处理 |
| App 主组件（handleBmrSave） | 1239-1252 | 14 | BMR 保存 |
| App 主组件（handleMetricsSave） | 1254-1262 | 9 | 指标设置保存 |
| App 主组件（Vision handlers） | 1264-1327 | 64 | AI 识别结果处理 |
| App 主组件（Totals 计算） | 1329-1396 | 68 | 汇总计算（摄入/消耗/BMR/营养） |
| App 主组件（handleManualSync） | 1398-1417 | 20 | 手动同步 |
| App 主组件（saveDailyLog） | 1419-1432 | 14 | 保存日志 |
| App 主组件（handleSettle） | 1434-1465 | 32 | 日终结账 |
| App 主组件（Render） | 1467-1959 | 493 | JSX 渲染 |

### 1.2 当前 import 依赖

```typescript
// App.tsx 顶部 imports
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createWorker } from 'tesseract.js'
import {
  db,
  initSampleData,
  calcBMR,
  generateDailyReport,
  loadVisibleMetrics,
  saveVisibleMetrics,
  ALL_METRICS,
  type PresetAsset,
  type LedgerEntry,
  type UserProfile,
  type DailySummary,
  type MetricKey,
} from './lib/db'
import { fullSync, deleteRemoteRecord } from './lib/sync'
import { supabase } from './lib/supabaseClient'
```

---

## 二、拆分清单

### 2.1 工具函数（`src/utils/`）

#### 文件 1：`src/utils/formatters.ts`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 21-53 |
| **迁移函数** | `todayStr()`, `nowISO()`, `formatTime(iso: string)`, `r1(n: number)`, `r0(n: number)` |
| **依赖** | 无（纯函数） |
| **导出** | `export function todayStr()` / `export function nowISO()` / 等 |

```typescript
// 迁移后代码
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
```

---

#### 文件 2：`src/utils/calories.ts`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 1330-1396 |
| **迁移函数** | `entryType(e, presets)`, `entryCalories(e, presets)`, 汇总计算逻辑 |
| **依赖** | `type PresetAsset`, `type LedgerEntry`（从 `./lib/db` 导入） |
| **导出** | `entryType()`, `entryCalories()`, `calcTotals()` |

```typescript
// 迁移后代码
import { type PresetAsset, type LedgerEntry } from '../lib/db'
import { r0, r1 } from './formatters'

export function entryType(
  e: LedgerEntry,
  presets: PresetAsset[]
): 'diet' | 'training' | undefined {
  if (e.type === 'manual') return e.manualType
  const preset = presets.find((p) => p.id === e.presetId)
  return preset?.type
}

export function entryCalories(
  e: LedgerEntry,
  presets: PresetAsset[]
): number {
  if (e.type === 'manual') return e.manualCalories ?? 0
  const preset = presets.find((p) => p.id === e.presetId)
  return (preset?.type === 'diet' ? preset.calories : preset?.caloriesBurned ?? 0) * e.quantity
}

export interface NutritionTotals {
  intakeTotal: number
  burnedTotal: number
  totalProteinG: number
  totalFructoseG: number
  totalSodiumMg: number
  totalPotassiumMg: number
}

export function calcTotals(
  entries: LedgerEntry[],
  presets: PresetAsset[]
): NutritionTotals {
  const intakeTotal = r0(entries.reduce((sum, e) => {
    return sum + (entryType(e, presets) === 'diet' ? entryCalories(e, presets) : 0)
  }, 0))

  const burnedTotal = r0(entries.reduce((sum, e) => {
    return sum + (entryType(e, presets) === 'training' ? entryCalories(e, presets) : 0)
  }, 0))

  const totalProteinG = r1(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.proteinG * e.quantity
  }, 0))

  const totalFructoseG = r1(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum + (e.manualFructoseG ?? 0)
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.fructoseG * e.quantity
  }, 0))

  const totalSodiumMg = r0(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.sodiumMg * e.quantity
  }, 0))

  const totalPotassiumMg = r0(entries.reduce((sum, e) => {
    if (e.type === 'manual') return sum
    const preset = presets.find((p) => p.id === e.presetId)
    if (!preset || preset.type !== 'diet') return sum
    return sum + preset.potassiumMg * e.quantity
  }, 0))

  return { intakeTotal, burnedTotal, totalProteinG, totalFructoseG, totalSodiumMg, totalPotassiumMg }
}
```

---

### 2.2 自定义 Hook（`src/hooks/`）

#### 文件 3：`src/hooks/useBMR.ts`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 1239-1252（handleBmrSave）+ 行 1350-1396（BMR 计算） |
| **迁移逻辑** | `bmr`, `baseBurn`, `postExerciseBalance`, `trueDeficit`, `calDiff`, `handleBmrSave` |
| **依赖** | `db`, `type UserProfile`, `calcBMR`（从 `./lib/db` 导入） |
| **导出** | `useBMR(profile, setProfile)` → `{ bmr, baseBurn, postExerciseBalance, trueDeficit, calDiff, handleBmrSave }` |

```typescript
// 迁移后代码
import { useState, useCallback } from 'react'
import { db, calcBMR, type UserProfile } from '../lib/db'
import { r0 } from '../utils/formatters'

export function useBMR(profile: UserProfile | null, setProfile: (p: UserProfile) => void) {
  const bmr = profile
    ? calcBMR(profile.weightLbs, profile.heightCm, profile.age, profile.gender)
    : 0

  const baseBurn = profile
    ? r0(bmr * (profile.activityFactor ?? 1.0))
    : 0

  const handleBmrSave = useCallback(
    async (p: UserProfile) => {
      const existing = await db.userProfile.limit(1).first()
      if (existing?.id) {
        await db.userProfile.update(existing.id, p)
      } else {
        await db.userProfile.add(p)
      }
      setProfile(p)
    },
    [setProfile],
  )

  return { bmr, baseBurn, handleBmrSave }
}
```

> **注意**：`postExerciseBalance` 和 `trueDeficit` 需要 `intakeTotal` 和 `burnedTotal`，这些由 `useLedgerData` 提供。建议在 App.tsx 中计算，或由 `useLedgerData` 返回。

---

#### 文件 4：`src/hooks/useSync.ts`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 1067-1100（网络监听 + 后台同步）+ 行 1398-1417（手动同步） |
| **迁移逻辑** | `isOnline` 状态、网络事件监听、后台 15s 同步、`handleManualSync`、`syncMessage` |
| **依赖** | `fullSync`（从 `./lib/sync` 导入）、`db`（从 `./lib/db` 导入） |
| **导出** | `useSync(selectedDate, onSyncComplete?)` → `{ isOnline, syncMessage, handleManualSync }` |

```typescript
// 迁移后代码
import { useState, useEffect, useCallback, useRef } from 'react'
import { fullSync } from '../lib/sync'
import { db } from '../lib/db'

export function useSync(selectedDate: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const syncMsgRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Network status
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Background sync
  useEffect(() => {
    if (!isOnline) return

    const sync = async () => {
      try {
        await fullSync(selectedDate)
      } catch (e) {
        console.error('[Sync] Error during background sync:', e)
      }
    }

    sync()
    const interval = setInterval(sync, 15_000)
    return () => clearInterval(interval)
  }, [isOnline, selectedDate])

  // Manual sync
  const handleManualSync = useCallback(async () => {
    if (!isOnline) return
    setSyncMessage('同步中…')
    try {
      await fullSync(selectedDate)
      setSyncMessage('✅ 同步完成')
    } catch (e) {
      console.error('[Sync] Manual sync error:', e)
      setSyncMessage('❌ 同步失败')
    }
    if (syncMsgRef.current) clearTimeout(syncMsgRef.current)
    syncMsgRef.current = setTimeout(() => setSyncMessage(null), 3000)
  }, [isOnline, selectedDate])

  return { isOnline, syncMessage, handleManualSync }
}
```

---

#### 文件 5：`src/hooks/useLedgerData.ts`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 1007-1028（State）+ 行 1030-1065（loadData）+ 行 1102-1237（CRUD）+ 行 1264-1327（Vision handlers）+ 行 1419-1465（settle） |
| **迁移逻辑** | 所有状态定义、`loadData`、`handleEntry`、`handleManualEntry`、`handleUndo`、`handleQuantityEdit`、`handleDeleteEntry`、`handleVisionSavePreset`、`handleVisionSaveEntry`、`handleSettle`、`saveDailyLog` |
| **依赖** | `db`, `initSampleData`, `loadVisibleMetrics`, `generateDailyReport`, `type PresetAsset`, `type LedgerEntry`, `type UserProfile`, `type DailySummary`, `type MetricKey`（从 `./lib/db` 导入）、`deleteRemoteRecord`（从 `./lib/sync` 导入）、`todayStr`, `nowISO`（从 `../utils/formatters` 导入） |
| **导出** | `useLedgerData(selectedDate, isOnline)` → `{ presets, entries, ... }` |

```typescript
// 迁移后代码（核心接口）
export function useLedgerData(
  selectedDate: string,
  isOnline: boolean,
  navigate: (path: string) => void,
) {
  // State
  const [presets, setPresets] = useState<PresetAsset[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [undoTarget, setUndoTarget] = useState<LedgerEntry | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>([])
  const [reportData, setReportData] = useState<{...} | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LedgerEntry | null>(null)
  const [editTarget, setEditTarget] = useState<LedgerEntry | null>(null)
  const undoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // loadData
  const loadData = useCallback(async (date: string) => { ... }, [])

  useEffect(() => { loadData(selectedDate) }, [loadData, selectedDate])

  // CRUD handlers
  const handleEntry = useCallback(async (preset: PresetAsset) => { ... }, [])
  const handleManualEntry = useCallback(async (data: {...}) => { ... }, [])
  const handleUndo = useCallback(async () => { ... }, [undoTarget])
  const handleQuantityEdit = useCallback(async (entryId, newQuantity) => { ... }, [selectedDate])
  const handleDeleteEntry = useCallback(async () => { ... }, [deleteTarget, isOnline, selectedDate])
  const handleVisionSavePreset = useCallback(async (result: VisionResult) => { ... }, [presets, navigate])
  const handleVisionSaveEntry = useCallback(async (result: VisionResult) => { ... }, [selectedDate])
  const handleSettle = useCallback(async () => { ... }, [selectedDate, entries, presets, profile])

  return {
    presets, entries, profile, visibleMetrics,
    undoTarget, deleteTarget, editTarget,
    reportData, showReportModal,
    setProfile, setVisibleMetrics,
    setShowReportModal, setDeleteTarget, setEditTarget,
    handleEntry, handleManualEntry, handleUndo,
    handleQuantityEdit, handleDeleteEntry,
    handleVisionSavePreset, handleVisionSaveEntry,
    handleSettle,
  }
}
```

---

### 2.3 组件（`src/components/`）

#### 文件 6：`src/components/ManualEntryModal.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 55-140 |
| **组件名** | `ManualEntryModal` |
| **Props** | `{ onSave: (data: { name, type, calories, notes }) => void, onClose: () => void }` |
| **依赖** | `useState` from `react` |
| **行数预估** | ~85 行 |

---

#### 文件 7：`src/components/BmrSettings.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 144-245 |
| **组件名** | `BmrSettings`（原 `BmrModal`） |
| **Props** | `{ profile: UserProfile, onSave: (p: UserProfile) => void, onClose: () => void }` |
| **依赖** | `useState` from `react`, `type UserProfile` from `../lib/db` |
| **行数预估** | ~100 行 |

---

#### 文件 8：`src/components/MetricsSettings.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 379-475 |
| **组件名** | `MetricsSettings`（原 `MetricsModal`） |
| **Props** | `{ visibleMetrics: MetricKey[], onSave: (keys: MetricKey[]) => void, onClose: () => void }` |
| **依赖** | `useState` from `react`, `ALL_METRICS`, `type MetricKey` from `../lib/db` |
| **子组件** | 内部使用 `AiAddMetricModal`（行 249-375） |
| **行数预估** | ~100 行 |

> **注意**：`AiAddMetricModal`（行 249-375）当前被 `MetricsSettings` 内部引用。建议有两种方案：
> - **方案 A**：将 `AiAddMetricModal` 也拆分为独立组件 `src/components/AiAddMetricModal.tsx`
> - **方案 B**：将 `AiAddMetricModal` 保留在 `MetricsSettings.tsx` 内部
>
> 推荐 **方案 A**，因为 `AiAddMetricModal` 本身有 127 行，逻辑独立（调用 `ai-add-metric` Edge Function）。

---

#### 文件 9：`src/components/VisionRecognizeModal.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 713-963 |
| **组件名** | `VisionRecognizeModal` |
| **Props** | `{ onSavePreset: (result: VisionResult) => void, onSaveEntry: (result: VisionResult) => void, onClose: () => void }` |
| **依赖** | `useState`, `useCallback`, `useRef` from `react`, `createWorker` from `tesseract.js`, `supabase` from `../lib/supabaseClient` |
| **内部类型** | `VisionResult` 接口（行 713-725） |
| **行数预估** | ~250 行 |

---

#### 文件 10：`src/components/SummaryCard.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 1549-1697 |
| **组件名** | `SummaryCard` |
| **Props** | `{ intakeTotal, burnedTotal, postExerciseBalance, totalProteinG, totalFructoseG, totalSodiumMg, totalPotassiumMg, baseBurn, calDiff, trueDeficit, profile, visibleMetrics }` |
| **依赖** | `type UserProfile`, `type MetricKey` from `../lib/db` |
| **行数预估** | ~150 行 |

---

#### 文件 11：`src/components/LedgerList.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 1699-1889 |
| **组件名** | `LedgerList` |
| **Props** | `{ entries, presets, undoTarget, onEntry, onUndo, onManualEntry, onVision, onSettle, onEdit, onDelete, selectedDate }` |
| **依赖** | `type PresetAsset`, `type LedgerEntry` from `../lib/db`, `formatTime`, `r0` from `../utils/formatters` |
| **行数预估** | ~200 行 |

---

### 2.4 额外建议拆分的组件

以下组件当前也内嵌在 App.tsx 中，建议一并拆分：

#### 文件 12（可选）：`src/components/AiAddMetricModal.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 249-375 |
| **组件名** | `AiAddMetricModal` |
| **Props** | `{ onSave: (keys: MetricKey[]) => void, onClose: () => void }` |
| **依赖** | `useState` from `react`, `supabase` from `../lib/supabaseClient`, `type MetricKey` from `../lib/db` |
| **行数预估** | ~127 行 |

#### 文件 13（可选）：`src/components/DailySummaryModal.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 479-637 |
| **组件名** | `DailySummaryModal` |
| **Props** | `{ report: { markdown, summary }, onClose: () => void }` |
| **依赖** | `useState` from `react`, `supabase` from `../lib/supabaseClient`, `type DailySummary` from `../lib/db` |
| **行数预估** | ~159 行 |

#### 文件 14（可选）：`src/components/QuantityEditModal.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 641-709 |
| **组件名** | `QuantityEditModal` |
| **Props** | `{ entry: LedgerEntry, presets: PresetAsset[], onSave: (entryId, newQuantity) => void, onClose: () => void }` |
| **行数预估** | ~69 行 |

#### 文件 15（可选）：`src/components/DeleteConfirmModal.tsx`

| 项目 | 内容 |
|------|------|
| **来源行** | App.tsx 行 967-1000 |
| **组件名** | `DeleteConfirmModal` |
| **Props** | `{ entryName: string, onConfirm: () => void, onCancel: () => void }` |
| **行数预估** | ~34 行 |

---

## 三、拆分后 import 依赖图

### 3.1 依赖关系总图

```
src/main.tsx
  └── src/App.tsx
        ├── src/utils/formatters.ts          (纯函数，零依赖)
        ├── src/utils/calories.ts            → formatters, db (types)
        ├── src/hooks/useBMR.ts              → db (calcBMR, UserProfile), formatters
        ├── src/hooks/useSync.ts             → sync (fullSync), db
        ├── src/hooks/useLedgerData.ts       → db (all), sync (deleteRemoteRecord), formatters
        ├── src/components/SummaryCard.tsx    → db (types)
        ├── src/components/LedgerList.tsx     → db (types), formatters
        ├── src/components/ManualEntryModal.tsx  (仅 react)
        ├── src/components/BmrSettings.tsx    → db (UserProfile)
        ├── src/components/MetricsSettings.tsx → db (ALL_METRICS, MetricKey)
        │     └── src/components/AiAddMetricModal.tsx → supabaseClient, db (MetricKey)
        ├── src/components/VisionRecognizeModal.tsx → supabaseClient, tesseract.js
        ├── src/components/DailySummaryModal.tsx → supabaseClient, db (DailySummary)
        ├── src/components/QuantityEditModal.tsx → db (types)
        └── src/components/DeleteConfirmModal.tsx  (仅 react)
```

### 3.2 各文件详细依赖

| 文件 | 外部依赖 | 内部依赖 |
|------|---------|---------|
| `formatters.ts` | 无 | 无 |
| `calories.ts` | `./lib/db` (types) | `./formatters` |
| `useBMR.ts` | `./lib/db` (calcBMR, UserProfile) | `./formatters` |
| `useSync.ts` | `./lib/sync` (fullSync), `./lib/db` | 无 |
| `useLedgerData.ts` | `./lib/db` (all), `./lib/sync` (deleteRemoteRecord) | `./formatters` |
| `SummaryCard.tsx` | `./lib/db` (types) | 无 |
| `LedgerList.tsx` | `./lib/db` (types) | `./formatters` |
| `ManualEntryModal.tsx` | react | 无 |
| `BmrSettings.tsx` | `./lib/db` (UserProfile) | 无 |
| `MetricsSettings.tsx` | `./lib/db` (ALL_METRICS, MetricKey) | `./AiAddMetricModal` |
| `AiAddMetricModal.tsx` | `./lib/supabaseClient`, `./lib/db` (MetricKey) | 无 |
| `VisionRecognizeModal.tsx` | `./lib/supabaseClient`, `tesseract.js` | 无 |
| `DailySummaryModal.tsx` | `./lib/supabaseClient`, `./lib/db` (DailySummary) | 无 |
| `QuantityEditModal.tsx` | `./lib/db` (types) | 无 |
| `DeleteConfirmModal.tsx` | react | 无 |

### 3.3 重构后 App.tsx 的 imports

```typescript
// 重构后 App.tsx 的 imports（预估 ~15 行）
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, type PresetAsset, type LedgerEntry, type UserProfile, type MetricKey } from './lib/db'
import { todayStr, nowISO, r0, r1 } from './utils/formatters'
import { calcTotals, type NutritionTotals } from './utils/calories'
import { useBMR } from './hooks/useBMR'
import { useSync } from './hooks/useSync'
import { useLedgerData } from './hooks/useLedgerData'
import { SummaryCard } from './components/SummaryCard'
import { LedgerList } from './components/LedgerList'
import { ManualEntryModal } from './components/ManualEntryModal'
import { BmrSettings } from './components/BmrSettings'
import { MetricsSettings } from './components/MetricsSettings'
import { VisionRecognizeModal } from './components/VisionRecognizeModal'
import { DailySummaryModal } from './components/DailySummaryModal'
import { QuantityEditModal } from './components/QuantityEditModal'
import { DeleteConfirmModal } from './components/DeleteConfirmModal'
```

---

## 四、重构后 App.tsx 骨架

```typescript
export default function App() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // ── Hooks ──────────────────────────────────────────────────────
  const { isOnline, syncMessage, handleManualSync } = useSync(selectedDate)
  const {
    presets, entries, profile, visibleMetrics,
    undoTarget, deleteTarget, editTarget,
    reportData, showReportModal,
    setProfile, setVisibleMetrics,
    setShowReportModal, setDeleteTarget, setEditTarget,
    handleEntry, handleManualEntry, handleUndo,
    handleQuantityEdit, handleDeleteEntry,
    handleVisionSavePreset, handleVisionSaveEntry,
    handleSettle,
  } = useLedgerData(selectedDate, isOnline, navigate)
  const { bmr, baseBurn, handleBmrSave } = useBMR(profile, setProfile)

  // ── Derived state ──────────────────────────────────────────────
  const totals = calcTotals(entries, presets)
  const { intakeTotal, burnedTotal, totalProteinG, totalFructoseG, totalSodiumMg, totalPotassiumMg } = totals
  const postExerciseBalance = intakeTotal - burnedTotal
  const trueDeficit = intakeTotal - baseBurn - burnedTotal
  const calDiff = intakeTotal - bmr

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline banner */}
      {!isOnline && (...)}
      {/* Sync toast */}
      {syncMessage && (...)}
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <header>...</header>
        {/* Summary Card */}
        <SummaryCard {...} />
        {/* Preset Buttons + Ledger List */}
        <LedgerList {...} />
      </div>
      {/* Modals */}
      {showBmrModal && profile && <BmrSettings ... />}
      {showManualModal && <ManualEntryModal ... />}
      {showReportModal && reportData && <DailySummaryModal ... />}
      {showMetricsModal && <MetricsSettings ... />}
      {deleteTarget && <DeleteConfirmModal ... />}
      {editTarget && <QuantityEditModal ... />}
      {showVisionModal && <VisionRecognizeModal ... />}
    </div>
  )
}
```

---

## 五、执行顺序（建议）

| 步骤 | 内容 | 预估时间 | 风险 |
|------|------|---------|------|
| 1 | 创建 `src/utils/formatters.ts` | 5min | 低 — 纯函数迁移 |
| 2 | 创建 `src/utils/calories.ts` | 10min | 低 — 纯函数迁移 |
| 3 | 创建 `src/hooks/useBMR.ts` | 10min | 低 — 逻辑独立 |
| 4 | 创建 `src/hooks/useSync.ts` | 10min | 低 — 逻辑独立 |
| 5 | 创建 `src/hooks/useLedgerData.ts` | 30min | **高** — 涉及最多状态和回调 |
| 6 | 创建 `src/components/ManualEntryModal.tsx` | 5min | 低 — 纯 UI 迁移 |
| 7 | 创建 `src/components/BmrSettings.tsx` | 5min | 低 — 纯 UI 迁移 |
| 8 | 创建 `src/components/AiAddMetricModal.tsx` | 10min | 低 — 逻辑独立 |
| 9 | 创建 `src/components/MetricsSettings.tsx` | 10min | 低 — 引用 AiAddMetricModal |
| 10 | 创建 `src/components/VisionRecognizeModal.tsx` | 15min | 中 — 含 OCR 逻辑 |
| 11 | 创建 `src/components/DailySummaryModal.tsx` | 10min | 低 — 纯 UI 迁移 |
| 12 | 创建 `src/components/QuantityEditModal.tsx` | 5min | 低 — 纯 UI 迁移 |
| 13 | 创建 `src/components/DeleteConfirmModal.tsx` | 5min | 低 — 纯 UI 迁移 |
| 14 | 创建 `src/components/SummaryCard.tsx` | 15min | 中 — 涉及条件渲染逻辑 |
| 15 | 创建 `src/components/LedgerList.tsx` | 15min | 中 — 涉及多个回调传递 |
| 16 | 重构 `App.tsx` | 30min | **高** — 删除所有迁移代码 |
| 17 | 编译测试 + 修复 | 30min | **高** — 类型错误、import 路径 |

**总预估时间：约 3.5 小时**

### 安全策略

1. **每步编译测试**：每创建 2-3 个文件后运行 `npm run build` 或 `tsc --noEmit`
2. **先创建后删除**：所有新文件创建完成后再修改 App.tsx，避免中间状态不可用
3. **git 分支**：建议在 `refactor/app-split` 分支上操作
4. **保留原文件**：拆分期间保留 App.tsx 原始内容，最后一步再删除迁移代码

---

## 六、拆分前后对比

| 指标 | 拆分前 | 拆分后 |
|------|--------|--------|
| App.tsx 行数 | 1,946 行 | ~250 行 |
| src 下源文件数 | 7 个 | 18 个 |
| 组件目录 | 无 | `src/components/`（9 个文件） |
| Hook 目录 | 无 | `src/hooks/`（3 个文件） |
| Utils 目录 | 无 | `src/utils/`（2 个文件） |
| 最大文件 | App.tsx（1,946 行） | PresetManager.tsx（~1,100 行） |
| 单一职责 | ❌ 严重违反 | ✅ 每个文件职责清晰 |
| 可测试性 | ❌ 无法单独测试组件 | ✅ 每个组件可独立测试 |
| 可维护性 | ❌ 修改需全局搜索 | ✅ 修改只需定位到对应文件 |


