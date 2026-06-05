# Project Soyorin — Module Guide

> 基于实际代码生成的模块关系文档 · 2026-05-31

---

## 1. 文件清单与职责

| 文件路径 | 一句话职责 |
|----------|-----------|
| `src/main.tsx` | 应用入口：挂载 React 根节点，配置 BrowserRouter 路由 |
| `src/App.tsx` | 首页组件：快捷录入、热量汇总、流水列表、BMR 设置、离线检测 |
| `src/pages/PresetManager.tsx` | 预设管理页：CRUD、JSON 导入/导出、启用/禁用 |
| `src/lib/db.ts` | 数据层核心：Dexie.js 数据库定义、6 张表类型、BMR 计算、示例数据初始化 |
| `src/lib/supabaseClient.ts` | Supabase 客户端初始化（从 .env 读取 URL 和 Key） |
| `src/lib/sync.ts` | 离线同步引擎：推送本地未同步数据 → 拉取远程更新 |
| `src/index.css` | Tailwind 指令 + 全局样式 |

---

## 2. 每个文件暴露的内容

### `src/main.tsx`

| 暴露内容 | 类型 | 说明 |
|---------|------|------|
| — | 执行脚本 | `createRoot` 渲染 `<App />` 到 `/#root` |
| — | 路由 | `/` → `<App />`，`/presets` → `<PresetManager />` |

### `src/App.tsx`

| 暴露内容 | 类型 | 说明 |
|---------|------|------|
| `App` (default export) | React 组件 | 首页主组件 |
| `BmrModal` (内部) | React 组件 | BMR 设置弹窗（体重/身高/年龄/性别表单） |
| `todayStr()` | 函数 | 返回 `YYYY-MM-DD` 格式的今日日期 |
| `nowISO()` | 函数 | 返回当前 ISO 8601 时间戳 |
| `formatTime(iso)` | 函数 | 将 ISO 时间戳格式化为 `HH:mm:ss` |
| `todayRange()` | 函数 | 返回今日 `[00:00:00, 23:59:59]` 的 ISO 范围 |

### `src/pages/PresetManager.tsx`

| 暴露内容 | 类型 | 说明 |
|---------|------|------|
| `PresetManager` (default export) | React 组件 | 预设管理页主组件 |
| `emptyPreset()` (内部) | 函数 | 返回一个空的 `Omit<PresetAsset, 'id'>` 默认值 |

### `src/lib/db.ts`

| 暴露内容 | 类型 | 说明 |
|---------|------|------|
| `PresetAsset` | TypeScript 接口 | 预设资产表类型（name, type, calories, caloriesBurned, macros...） |
| `LedgerEntry` | TypeScript 接口 | 流水记录表类型（date, presetId, type, quantity, createdAt...） |
| `DailySummary` | TypeScript 接口 | 日终清算表类型（totalCal, totalProtein, naKRatio...） |
| `Biometric` | TypeScript 接口 | 体征数据表类型（weightLbs, bpSystolic, bpDiastolic...） |
| `AiSession` | TypeScript 接口 | AI 对话存档表类型（sessionType, contextWindowJson...） |
| `UserProfile` | TypeScript 接口 | 用户档案表类型（weightLbs, heightCm, age, gender） |
| `SoyorinDB` | Class (extends Dexie) | 数据库类，管理 6 张表的版本和索引 |
| `db` | 实例 | `new SoyorinDB()` 单例 |
| `calcBMR(weightLbs, heightCm, age, gender)` | 函数 | Mifflin-St Jeor 公式计算基础代谢率 |
| `initSampleData()` | 异步函数 | 首次运行时初始化 4 个示例预设 + 默认用户档案 |

### `src/lib/supabaseClient.ts`

| 暴露内容 | 类型 | 说明 |
|---------|------|------|
| `supabase` | 实例 | `createClient(url, key)` 创建的 Supabase 客户端 |

### `src/lib/sync.ts`

| 暴露内容 | 类型 | 说明 |
|---------|------|------|
| `syncLedgerEntries()` | 异步函数 | 推送本地 `synced=false` 的流水到 Supabase |
| `pullLedgerEntries()` | 异步函数 | 从 Supabase 拉取最新流水，冲突时保留较新版本 |
| `fullSync()` | 异步函数 | 先推后拉，完整同步流程 |

---

## 3. 文件调用关系图

```
src/main.tsx
  ├── import './index.css'              (样式)
  ├── import App from './App.tsx'        (首页组件)
  └── import PresetManager from './pages/PresetManager.tsx'  (预设管理页)

src/App.tsx
  ├── import { db, initSampleData, calcBMR, PresetAsset, LedgerEntry, UserProfile } from './lib/db'
  │     └── db.presetAssets.orderBy().toArray()       ← 读取预设
  │     └── db.ledgerEntries.where().between().toArray()  ← 读取今日流水
  │     └── db.ledgerEntries.add(entry)                ← 写入新流水
  │     └── db.ledgerEntries.delete(id)                ← 撤销删除流水
  │     └── db.userProfile.limit(1).first()            ← 读取用户档案
  │     └── db.userProfile.update() / add()            ← 保存 BMR 设置
  │     └── initSampleData()                           ← 初始化示例数据
  │     └── calcBMR()                                  ← 计算 BMR
  └── import { fullSync } from './lib/sync'
        └── fullSync()                                 ← 后台同步

src/pages/PresetManager.tsx
  └── import { db, PresetAsset } from '../lib/db'
        └── db.presetAssets.orderBy().toArray()        ← 读取全部预设
        └── db.presetAssets.add()                      ← 创建预设
        └── db.presetAssets.update()                   ← 更新预设
        └── db.presetAssets.delete()                   ← 删除预设
        └── db.presetAssets.bulkAdd()                  ← JSON 批量导入

src/lib/sync.ts
  ├── import { db, LedgerEntry } from './db'
  │     └── db.ledgerEntries.where('synced').equals(0) ← 查询未同步数据
  │     └── db.ledgerEntries.update(id, { synced: true })  ← 标记已同步
  │     └── db.ledgerEntries.add()                     ← 插入远程拉取的数据
  └── import { supabase } from './supabaseClient'
        └── supabase.from('ledger_entries').insert()   ← 推送至 Supabase
        └── supabase.from('ledger_entries').select()   ← 从 Supabase 拉取

src/lib/supabaseClient.ts
  └── import.meta.env.VITE_SUPABASE_URL
  └── import.meta.env.VITE_SUPABASE_ANON_KEY
```

### 依赖关系总结

```
main.tsx
  ├── App.tsx ──→ lib/db.ts ──→ dexie (npm)
  │             └── lib/sync.ts ──→ lib/db.ts
  │                               └── lib/supabaseClient.ts ──→ @supabase/supabase-js (npm)
  └── pages/PresetManager.tsx ──→ lib/db.ts
```

---

## 4. 数据流向

### 4.1 用户点击预设按钮 → 入账

```
用户点击 [2C1S] 按钮
  │
  ▼
App.tsx :: handleEntry(preset)
  │ 1. 清除之前的撤销定时器
  │ 2. 构建 LedgerEntry 对象 { presetId, date, type:'preset', quantity:1, createdAt, synced:false }
  │
  ▼
db.ledgerEntries.add(entry)     ← 写入 IndexedDB (ledger_entries 表)
  │
  ▼
setEntries(prev => [entry, ...prev])  ← 更新 React state
  │
  ▼
setUndoTarget(entry)            ← 显示撤销按钮
  │
  ▼
setTimeout(3000ms) → setUndoTarget(null)  ← 3秒后自动隐藏撤销
```

### 4.2 用户点击撤销

```
用户点击 [撤销] 按钮
  │
  ▼
App.tsx :: handleUndo()
  │ 1. 清除撤销定时器
  │
  ▼
db.ledgerEntries.delete(undoTarget.id)  ← 从 IndexedDB 删除
  │
  ▼
setEntries(prev => prev.filter(...))    ← 更新 React state
  │
  ▼
setUndoTarget(null)                     ← 隐藏撤销按钮
```

### 4.3 页面加载 → 数据初始化

```
App.tsx :: useEffect → loadData()
  │
  ├── initSampleData()
  │     ├── db.presetAssets.count() → 0? → bulkAdd(4个示例预设)
  │     └── db.userProfile.count() → 0? → add(默认档案)
  │
  ├── db.presetAssets.orderBy('sortOrder').toArray()  → setPresets(allPresets)
  │
  ├── db.ledgerEntries.where('createdAt').between(todayStart, todayEnd).reverse().toArray()
  │     → setEntries(todayEntries)
  │
  └── db.userProfile.limit(1).first() → setProfile(userProfile)
```

### 4.4 后台同步（每 15 秒）

```
App.tsx :: useEffect(isOnline)
  │ 仅当 isOnline === true 时执行
  │
  ▼ (每 15 秒)
fullSync()
  │
  ├── syncLedgerEntries()
  │     ├── db.ledgerEntries.where('synced').equals(0).toArray()  ← 查未同步数据
  │     └── for each: supabase.from('ledger_entries').insert(...)
  │           → 成功: db.ledgerEntries.update(id, { synced: true })
  │
  └── pullLedgerEntries()
        ├── supabase.from('ledger_entries').select('*').order('created_at', desc)
        └── for each row:
              ├── 本地不存在 → db.ledgerEntries.add(row)
              └── 远程更新 → db.ledgerEntries.update(id, row)
```

### 4.5 预设管理 CRUD

```
创建: PresetManager :: handleSave()
  → db.presetAssets.add({ ...editing, sortOrder: max+1 })

更新: PresetManager :: handleSave()
  → db.presetAssets.update(editing.id!, editing)

删除: PresetManager :: handleDelete(id)
  → db.presetAssets.delete(id)

启用/禁用: PresetManager :: handleToggleActive(preset)
  → db.presetAssets.update(preset.id!, { isActive: !preset.isActive })

JSON 导入: PresetManager :: handleImport()
  → db.presetAssets.bulkAdd(toAdd)

JSON 导出: PresetManager :: handleExport()
  → JSON.stringify(presets) → Blob → download
```

### 4.6 BMR 设置

```
用户点击 ⚙️ → showBmrModal = true
  │
  ▼
BmrModal 弹窗 (体重/身高/年龄/性别)
  │
  ▼
用户点击 [保存] → handleBmrSave(p)
  ├── db.userProfile.limit(1).first()
  ├── 存在 → db.userProfile.update(existing.id, p)
  └── 不存在 → db.userProfile.add(p)
  │
  ▼
setProfile(p) → 首页 BMR 分析区域更新
```

---

## 5. 数据库表结构速查

| 表名 | 主键 | 关键索引字段 | 用途 |
|------|------|-------------|------|
| `presetAssets` | `++id` | `name, type, isActive, sortOrder` | 预设资产（饮食/训练模板） |
| `ledgerEntries` | `++id` | `date, presetId, type, createdAt, synced` | 每日流水记录 |
| `dailySummaries` | `++id` | `date, synced` | 日终清算（未使用） |
| `biometrics` | `++id` | `date, source, synced` | 体征数据（未使用） |
| `aiSessions` | `++id` | `sessionType, createdAt, synced` | AI 对话存档（未使用） |
| `userProfile` | `++id` | — | 用户档案（BMR 计算用） |

---

## 6. 关键设计决策

| 决策 | 说明 |
|------|------|
| **离线优先** | 所有数据先写 IndexedDB，再后台同步到 Supabase |
| **synced 标记** | 每条流水有 `synced: boolean`，同步后设为 `true` |
| **冲突策略** | 保留 `created_at` 较新的版本（last-write-wins） |
| **版本升级** | Dexie 版本号 v3，新增 `caloriesBurned` 字段 |
| **BMR 公式** | Mifflin-St Jeor：男性 `10w + 6.25h - 5a + 5`，女性 `10w + 6.25h - 5a - 161` |
| **热量计算** | 净热量 = 摄入总和 - 消耗总和；热量差 = 摄入 - BMR |
