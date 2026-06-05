// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function: ai-generate-preset
// Calls DeepSeek API to generate a structured preset from user prompt.
// ═══════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface GenerateRequest {
  prompt: string
  /** 用户当前启用的追踪指标 key 列表，如 ["calories", "protein", "fructose", "sodium", "potassium"] */
  trackedMetrics?: string[]
}

interface GenerateResponse {
  name: string
  type: 'diet' | 'training'
  calories: number
  caloriesBurned: number
  protein_g: number
  fat_g: number
  carb_g: number
  fructose_g: number
  sodium_mg: number
  potassium_mg: number
  unit: string
  notes: string
}

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? ''
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

function buildSystemPrompt(trackedMetrics?: string[]): string {
  // Base prompt
  let prompt = `你是一个健康营养专家助手。你的任务是根据用户的描述，生成一个结构化的预设资产（preset asset）。

预设资产可以是"饮食"（diet）或"训练"（training）类型。

对于饮食类型，你需要提供：
- name: 预设名称（简短，如"增肌早餐"）
- type: "diet"
- calories: 总热量 (kcal)
- caloriesBurned: 0
- protein_g: 蛋白质 (g)
- fat_g: 脂肪 (g)
- carb_g: 碳水 (g)`

  // Dynamically add tracked metric fields
  if (trackedMetrics && trackedMetrics.length > 0) {
    const metricFields: Record<string, string> = {
      fructose: '- fructose_g: 果糖 (g) — 如果用户明确提到含果糖的食物（如水果、蜂蜜、含糖饮料），根据常见值估算；否则设为 0',
      sodium: '- sodium_mg: 钠 (mg)',
      potassium: '- potassium_mg: 钾 (mg)',
    }
    for (const metric of trackedMetrics) {
      if (metricFields[metric]) {
        prompt += `\n${metricFields[metric]}`
      }
    }
  } else {
    // Default: include all standard fields
    prompt += `
- fructose_g: 果糖 (g) — 如果用户明确提到含果糖的食物（如水果、蜂蜜、含糖饮料），根据常见值估算；否则设为 0
- sodium_mg: 钠 (mg)
- potassium_mg: 钾 (mg)`
  }

  prompt += `
- unit: 计量单位，如"份"、"克"、"杯"、"个"等（根据食物类型合理推断）
- notes: 备注说明

对于训练类型，你需要提供：
- name: 训练名称（如"晨间有氧"）
- type: "training"
- calories: 0
- caloriesBurned: 消耗热量 (kcal)
- protein_g: 0
- fat_g: 0
- carb_g: 0
- fructose_g: 0
- sodium_mg: 0
- potassium_mg: 0
- unit: "次"
- notes: 训练说明

请严格返回 JSON 格式，不要包含 markdown 代码块标记或其他文字。只返回 JSON 对象本身。`

  return prompt
}

serve(async (req: Request) => {
  // ── CORS headers ──────────────────────────────────────────────
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  })

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers },
    )
  }

  // ── Validate API key ──────────────────────────────────────────
  if (!DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }),
      { status: 500, headers },
    )
  }

  try {
    // ── Parse request body ──────────────────────────────────────
    const body: GenerateRequest = await req.json()

    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "prompt" field' }),
        { status: 400, headers },
      )
    }

    // ── Call DeepSeek API ───────────────────────────────────────
    const deepseekResponse = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: buildSystemPrompt(body.trackedMetrics) },
          { role: 'user', content: body.prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text()
      console.error('[DeepSeek] API error:', deepseekResponse.status, errorText)
      return new Response(
        JSON.stringify({
          error: `DeepSeek API returned ${deepseekResponse.status}`,
          detail: errorText,
        }),
        { status: 502, headers },
      )
    }

    const deepseekData = await deepseekResponse.json()
    const content = deepseekData.choices?.[0]?.message?.content

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'DeepSeek returned empty response' }),
        { status: 502, headers },
      )
    }

    // ── Parse JSON from DeepSeek response ───────────────────────
    // DeepSeek might wrap JSON in markdown code blocks
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      // Remove markdown code block markers
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '').trim()
    }

    let result: GenerateResponse
    try {
      result = JSON.parse(jsonStr)
    } catch {
      console.error('[DeepSeek] Failed to parse JSON from response:', content)
      return new Response(
        JSON.stringify({
          error: 'Failed to parse DeepSeek response as JSON',
          raw: content,
        }),
        { status: 502, headers },
      )
    }

    // ── Validate required fields ─────────────────────────────────
    if (!result.name || !result.type) {
      return new Response(
        JSON.stringify({
          error: 'DeepSeek response missing required fields (name, type)',
          raw: result,
        }),
        { status: 502, headers },
      )
    }

    // ── Return result ───────────────────────────────────────────
    return new Response(JSON.stringify(result), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[ai-generate-preset] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers },
    )
  }
})
