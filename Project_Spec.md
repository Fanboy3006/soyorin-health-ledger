# Project Soyorin — 项目文档 v2.0
> 更新日期：2026-05-30

---

## 一、项目需求说明书（更新版）

### 1.1 核心定位

Project Soyorin 是一套本地优先、多端同步的个人生物学资产账本。以计算器般干练、无延迟的交互完成日常饮食、训练与体征数据扎帐，提供按需调用的硬核 AI 生化顾问服务，最终实现个人健康数据的长期安全托管与法证级趋势复盘。

---

### 1.2 数据模型定义（新增）

以下是需要在 Supabase 中建立的核心数据表字段，开发前须锁定：

#### 表 1：`preset_assets`（模块预设资产）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | 自动生成 |
| name | text | 预设名称，如 "2C1S"、"蹲日训练包" |
| type | text | diet / training |
| calories | integer | 热量 (kcal)，训练类可为 0 |
| protein_g | float | 蛋白质 (g) |
| fat_g | float | 脂肪 (g) |
| carb_g | float | 碳水 (g) |
| sodium_mg | float | 钠 (mg) |
| potassium_mg | float | 钾 (mg) |
| notes | text | 备注，如"含隐性乳脂、0糖代糖" |
| meta_json | jsonb | 训练类存动作列表；饮食类存额外属性 |
| is_active | boolean | 是否显示在主页 |

#### 表 2：`ledger_entries`（流水记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| date | date | 所属日期 |
| preset_id | uuid FK nullable | 关联预设；临时记录为 null |
| type | text | preset / manual |
| quantity | float | 份数，默认 1 |
| manual_desc | text | 非预设突发饮食的原文描述 |
| created_at | timestamptz | 用于冲突解决 |

#### 表 3：`daily_summaries`（日终清算）
| 字段 | 类型 | 说明 |
|------|------|------|
| date | date PK | 每天唯一 |
| total_cal | integer | 总热量 (kcal) |
| total_protein_g | float | 蛋白质总量 (g) |
| total_sodium_mg | float | 钠 (mg) |
| total_potassium_mg | float | 钾 (mg) |
| na_k_ratio | float | 钠钾比（自动计算） |
| notes | text | 手动备注 |
| markdown_path | text | 本地归档文件路径 |

#### 表 4：`biometrics`（体征数据）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| date | date | |
| weight_lbs | float | 体重 |
| bp_systolic | integer | 收缩压（高压） |
| bp_diastolic | integer | 舒张压（低压） |
| resting_hr | integer | 静息心率 |
| source | text | manual / healthkit / webhook |

#### 表 5：`ai_sessions`（AI 对话存档）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| created_at | timestamptz | |
| session_type | text | audit（体征审计）/ parse（流水解析） |
| context_window_json | jsonb | 本次调用注入的账本数据快照 |
| messages_json | jsonb | 完整对话消息数组 |

---

### 1.3 日终 Markdown 归档格式标准（新增）

每日生成 `YYYY-MM-DD_Health_Ledger.md`，包含以下固定字段结构：

```markdown
# 2026-05-29 Health Ledger

## 宏量汇总
| 指标 | 数值 |
|------|------|
| 总热量 | 1480 kcal |
| 蛋白质 | 115 g |
| 脂肪 | 52 g |
| 碳水 | 68 g |
| 钠 | 553 mg |
| 钾 | 2300 mg |
| 钠钾比 | 1 : 4.1 |

## 饮食流水
- 08:30 [2C1S] × 1 — 120 kcal
- 12:00 [Safe Catch 金枪鱼] × 1 — 140 kcal
- 18:00 临时记录：聚餐羊肉约 500g、一碗面 — AI 解析
- 21:00 [草莓 300g] × 1 — 96 kcal

## 训练记录
- 14:00 [蹲日训练包] × 1 — 完成

## 体征
- 体重：167.6 lbs
- 血压：119 / 79
- 静息心率：（未录入）

## AI 审计摘要
（本日 AI 咨询摘要，无则留空）
```

---

### 1.4 核心功能模块

#### 模块 2.1：模块化预设引擎（0 Token 消耗）

- 通过本地 JSON 配置文件或前端 UI 界面注册高频行为为"模块资产"（训练包、饮食预设）。
- 主页采用大方块/复选框组件，点击后本地 IndexedDB 计数器 +1，完全不经过网络，零延迟落库。
- **新增**：主页入账操作保留最近 1 次"撤销"按钮，3 秒内可取消，超时不可逆。

**训练模块示例**：`[蹲日训练包]` 预设包含动作（徒手保加利亚蹲、角度腿举、B-stance RDL）及对应容量目标。

**饮食模块示例**：`[2C1S]` 对应特定宏量组合（固化热量、隐性乳脂、0糖代糖属性）；`[Trio Ratio]` 预设 1 Cup 克数与 32g 蛋白资产。

#### 模块 2.2：日终流式清算与本地归档（0 Token 消耗）

- 每日夜间或手动点击"日终扎帐"触发：合并当日点击流水 → 计算宏量汇总（总热量、蛋白质、钠钾比）→ 写入 Supabase `daily_summaries` → 本地生成标准格式 Markdown 归档。
- **同步冲突处理**：本地 IndexedDB 为主，Supabase 后台异步同步。恢复联网后以 `created_at` 时间戳最新者为准，冲突时 UI Toast 提示"发现冲突，已保留最新版本"。
- 离线期间顶部显示"离线模式"提示条，联网后自动后台同步。

#### 模块 2.3：按需触发的 AI 生化审计（DeepSeek API）

仅在以下场景手动显式触发时调用 AI，日常录入不做任何干预：

- **复杂流水解析**：面对临时、非预设的突发饮食，调用大模型进行结构化拆解并提示风险。
- **体检/体征专项审计**：主动上传体检报告、连续异常数据，由 AI 展开长文本逻辑讨论并给出修正建议。

**上下文注入策略（新增）**：每次调用时自动注入最近 7 天的 `daily_summaries` 数据 + 当日实时流水，格式化为系统消息。历史 AI 对话在同一 session 内保持连续性，跨 session 不自动延续，可手动"加载上次会话"。

#### 模块 2.4：未来数据并网能力（后期迭代）

- **HealthKit 吸纳**：预留接收 iOS 原生健康数据接口（步数、睡眠、静息心率、血压），`biometrics` 表的 `source` 字段已预留。
- **外部 Webhook 注入**：提供带鉴权的标准化网络接收端点。鉴权方案：Bearer Token，Key 在 Supabase 环境变量持有，不落前端代码，支持在设置页手动轮换。

---

### 1.5 错误与边缘情况处理（新增）

| 场景 | 处理策略 |
|------|----------|
| 离线录入冲突 | 以 `created_at` 时间戳最新者为准；UI Toast 提示"发现冲突，已保留最新版本" |
| 误点撤销 | 主页入账保留最近 1 次撤销按钮，3 秒内可取消；超时不可逆 |
| DeepSeek 超时 | 流式请求超过 30s 未响应，显示错误提示 + 重试按钮，不丢失当前对话上下文 |
| Supabase 断连 | 本地 IndexedDB 继续工作；顶部显示"离线模式"提示条；恢复后自动后台同步 |

---

## 二、技术路线选型（更新版）

### 2.1 系统架构总览

```
【前端层】
  Vite + React + TypeScript（Web App，运行在浏览器）
       │
       ├─ (本地缓存) ──> IndexedDB via Dexie.js（离线秒开、一键录入 0 延迟）
       │
       ├─ (本地归档) ──> File System Access API → 本地 Markdown 文件
       │
       ▼
【云端层】
  Supabase（Postgres + 自动生成 REST API + Realtime 双向同步）
       │
       ├─ [Edge Function] ──> DeepSeek API 转发（API Key 不落前端）
       │
       └─ [Webhook 端点] ──> 未来外部并网（后期迭代）
       │
       ▼
【AI 算力层】
  DeepSeek API（流式返回，JSON Mode，经 Edge Function 转发）
```

### 2.2 各层技术栈与选型理由

#### 前端：Vite + React + TypeScript
**变更说明：不使用 Tauri 2.0（推迟到后期）**

原方案 Tauri 2.0 需要掌握 Rust 工具链和 Xcode iOS 签名配置，与当前 Python/Gradio 技术背景差异过大，会显著拖慢第一个可用版本的交付速度。第一阶段纯 Web App，功能稳定后，Tauri 打包桌面/移动端只是一层壳，1-2 天内可完成迁移，核心业务代码无需改动。

#### 本地缓存：IndexedDB（通过 Dexie.js）

Dexie.js 是 IndexedDB 的轻量封装，API 接近 SQL，适合健康账本的键值存储场景。一键入账直接写 IndexedDB，零网络延迟，Supabase 后台异步同步，用户无感。

#### 云端后端：Supabase（不变）

免费额度对个人健康账本足够用 10 年。自动生成 REST API，无需写后端服务器代码。Row Level Security 保护数据隔离。Edge Functions 用于 DeepSeek API 安全转发。

#### AI 接口：DeepSeek API，经 Edge Function 转发
**变更说明：不走前端直连**

API Key 必须在服务端（Supabase Edge Function）持有，不能落在前端代码里，否则任何能看到网络请求的人都能获取 Key。前端请求自己的 Supabase Edge Function 端点，由 Edge Function 负责转发和鉴权。流式请求开启 `response_format: { "type": "json_object" }` 确保结构化返回。

#### 本地归档：File System Access API

现代浏览器（Chrome/Edge）原生支持写入本地文件系统。用户授权一次指定目录后，日终清算可直接写入 Markdown 文件，无需 Tauri 即可实现本地冷钱包备份。

> **注意**：Safari 对 File System Access API 的支持截至 2025 年末仍不完整。若主要在 iPhone Safari 上使用，本地归档需改为"触发下载"方案，或推迟到 Tauri 阶段实现。

### 2.3 Tauri 迁移路径（后期）

当 Web 版本功能稳定后（预计 Sprint 4 之后），可按以下步骤迁移：
1. 安装 Tauri CLI，初始化项目壳（约 1 天）
2. 将 File System Access API 调用替换为 Tauri 的 `fs` 插件（约半天）
3. 配置 iOS 证书与 Xcode 环境（约 1-2 天）
4. 其他所有 React 业务代码无需改动

---

## 三、项目进度表

### 总体说明

- 开发模式：Vibe Coding（AI 辅助），每天投入约 1-2 小时
- 总周期：约 14 周达到历史范例效果的 80%
- **关键里程碑**：Sprint 2 末（约第 8 周）系统即可每日真实使用

---

### Sprint 0：基础设施搭建（第 1-2 周）

**目标**：所有依赖跑通，可以读写数据

| 任务 | 说明 |
|------|------|
| Supabase 建表 | 按本文档数据模型建立 5 张表，配置 Row Level Security |
| Vite + React + TS 脚手架 | 初始化项目，配置 ESLint、Prettier |
| Supabase SDK 接入 | 跑通基础读写，验证连接 |
| Dexie.js 初始化 | 定义本地 IndexedDB 结构，与 Supabase 表结构对齐 |
| DeepSeek Edge Function 原型 | 验证 API Key 在服务端持有、前端可调用的完整链路 |

---

### Sprint 1：录入核心（第 3-5 周）

**目标**：主页可以一键入账，零延迟落库

| 任务 | 说明 |
|------|------|
| 预设资产管理页 | 支持 JSON 导入和前端 UI 注册，CRUD 完整 |
| 主页一键入账大方块 | 大方块组件，点击 IndexedDB +1，视觉反馈 |
| 撤销功能 | 3 秒内可撤销最近一次入账 |
| 基础流水列表视图 | 当日流水展示，支持手动补充非预设记录 |

---

### Sprint 2：同步与归档（第 6-8 周）

**目标**：数据安全、跨设备可用——此后可每日真实使用 ✅

| 任务 | 说明 |
|------|------|
| Supabase Realtime 双向同步 | IndexedDB ↔ Postgres 实时同步 |
| 离线模式 + 冲突解决 | 断网提示、恢复后自动同步、冲突 Toast 提示 |
| 日终清算逻辑 | 合并流水，计算宏量汇总（热量、蛋白、钠钾比等） |
| 本地 Markdown 归档 | File System Access API 写入标准格式文档 |

---

### Sprint 3：AI 审计界面（第 9-11 周）

**目标**：实现历史范例中的 AI 生化顾问对话效果

| 任务 | 说明 |
|------|------|
| AI 对话界面 | 流式输出，长对话展示，支持 Markdown 渲染 |
| 上下文注入 | 自动注入 7 天 daily_summaries + 当日实时流水 |
| 会话存档 | 对话历史存入 ai_sessions 表，支持"加载上次会话" |
| 突发饮食解析入口 | 自由文本输入触发 AI 结构化解析，结果可确认入账 |

---

### Sprint 4：收尾与打磨（第 12-14 周）

**目标**：系统完整可用，移动端体验流畅

| 任务 | 说明 |
|------|------|
| 体征录入页 | 体重、血压（双轨读数）、静息心率录入 |
| 趋势图 | 钠钾比、蛋白质、热量近 14 天折线图 |
| 边缘情况修复 | 真实使用中发现的 Bug 修复 |
| PWA 配置 | 移动端浏览器"添加到主屏幕"，离线可用 |

---

### 后期迭代（Sprint 5+，时间不限）

- Tauri 桌面端打包（Mac / Windows）
- Tauri iOS / Android 原生 App
- HealthKit 接入（步数、睡眠、静息心率、血压）
- Webhook 鉴权端点（外部 App / 快捷指令并网）
- 体检报告 PDF 上传与 AI 解析
- 血压异常波动长线趋势审计

---

## 四、主要风险与应对

| 风险级别 | 风险描述 | 应对策略 |
|----------|----------|----------|
| 高 | IndexedDB ↔ Supabase 双写同步，尤其是离线恢复后的冲突合并，是技术复杂度最高的部分 | Sprint 2 之前先把 Supabase Realtime 订阅原型跑通；冲突策略以时间戳最新者为准，不做复杂合并 |
| 高 | File System Access API 在 Safari / iOS 不支持 | 若主要在 iPhone 上使用，Markdown 归档改为"触发文件下载"方案，推迟到 Tauri 阶段实现真正的本地写入 |
| 中 | AI 对话上下文成本：注入 7 天 daily_summaries 约 2000-3000 tokens | Edge Function 中做 token 计数，超限时截断最旧的天数；每次调用前展示预估 token 用量 |
| 中 | React 学习曲线：从 Python/Gradio 切换到 React 组件模型有一定上手成本 | Sprint 0 第一周先跑一遍 React 官方教程（约 4-6 小时），之后用 AI 辅助写组件会顺畅很多 |

---

*文档版本：v2.0 | 生成日期：2026-05-30*
