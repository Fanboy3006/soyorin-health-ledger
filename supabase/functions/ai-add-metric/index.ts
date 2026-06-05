// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function: ai-add-metric
// Calls DeepSeek API to suggest new tracking metrics based on user's
// description, then helps estimate values for existing presets.
// ═══════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface AddMetricRequest {
  prompt: string
  /** Optional: existing preset data to estimate values for */
  existingPresets?: Array<{
    name: string
    type: string
    calories: number
    protein_g: number
    fat_g: number
    carb_g: number
    notes: string
  }>
}

interface MetricSuggestion {
  /** Field key, e.g. "fructose_g", "fiber_g" */
  key: string
  /** Display label, e.g. "果糖 (g)", "膳食纤维 (g)" */
  label: string
  /** Unit, e.g. "g", "mg" */
  unit: string
}

interface AddMetricResponse {
  metrics: MetricSuggestion[]
  /** If existingPresets was provided, estimated values for each preset */
  presetEstimates?: Array<{
    name: string
    values: Record<string, number>
  }>
}

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? ''
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT = `你是一个健康营养专家助手。你的任务是根据用户的描述，推荐需要追踪的新营养指标。

用户可能说"我想追踪果糖和膳食纤维"或"帮我加上维生素C和铁"等。

你必须严格返回以下 JSON 格式，不要包含 markdown 代码块标记或其他文字。只返回 JSON 对象本身：

{
  "metrics": [
    {
      "key": "字段名（snake_case，如 fructose_g、fiber_g、vitamin_c_mg、iron_mg）",
      "label": "中文显示名称（如 果糖 (g)、膳食纤维 (g)、维生素C (mg)、铁 (mg)）",
      "unit": "单位（如 g、mg、mcg）"
    }
  ]
}

要求：
1. 每个指标必须有合理的单位
2. 不要推荐已有的基础指标（calories, protein_g, fat_g, carb_g, sodium_mg, potassium_mg）
3. 如果用户描述不明确，根据上下文合理推断
4. 如果用户没有明确指定指标，推荐 2-3 个最相关的指标

如果用户同时提供了现有预设数据（existingPresets），你还需要为每个预设估算新指标的值。
此时返回格式为：
{
  "metrics": [指标数组],
  "presetEstimates": [
    {
      "name": "预设名称",
      "values": { "fructose_g": 5, "fiber_g": 3 }
    }
  ]
}

估算时根据预设的名称、类型、热量和备注合理推断。`

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
    const body: AddMetricRequest = await req.json()

    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "prompt" field' }),
        { status: 400, headers },
      )
    }

    // Build user message with optional preset context
    let userMessage = body.prompt
    if (body.existingPresets && body.existingPresets.length > 0) {
      userMessage += `\n\n现有预设数据：\n${JSON.stringify(body.existingPresets, null, 2)}`
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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2048,
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
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '').trim()
    }

    let result: AddMetricResponse
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

    // ── Validate ────────────────────────────────────────────────
    // Handle case where DeepSeek returns a raw array instead of { metrics: [...] }
    if (Array.isArray(result)) {
      const metrics = result as unknown as MetricSuggestion[]
      if (metrics.length === 0) {
        return new Response(
          JSON.stringify({ error: 'DeepSeek returned empty metrics array' }),
          { status: 502, headers },
        )
      }
      return new Response(JSON.stringify({ metrics }), {
        status: 200,
        headers,
      })
    }

    if (!result.metrics || !Array.isArray(result.metrics) || result.metrics.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'DeepSeek returned no metrics',
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
    console.error('[ai-add-metric] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers },
    )
  }
})
