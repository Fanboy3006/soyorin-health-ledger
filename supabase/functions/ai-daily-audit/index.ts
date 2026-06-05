// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function: ai-daily-audit
// Calls DeepSeek API to generate daily health evaluation & advice.
// ═══════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface AuditRequest {
  date: string
  intakeCal: number
  burnedCal: number
  netCal: number
  proteinG: number
  sodiumMg: number
  potassiumMg: number
  naKRatio: number
}

interface AuditResponse {
  evaluation: string
}

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? ''
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT = `你是一个专业的健康顾问。根据用户当天的饮食和训练数据，给出简短评价和具体建议。控制在150字以内。语气友好、专业。

重要规则：
1. "总摄入"（total_intake）是用户通过饮食摄入的总热量，用于判断"热量是否达标"。
2. "运动消耗"（total_burned）是用户通过运动消耗的热量。
3. "净热量"（net_calories）= 总摄入 - 运动消耗，不等于总摄入。
4. 只有"总摄入"（total_intake）才能用于判断用户是否吃够了热量。
5. 不要将"净热量"误认为是"总摄入"。
6. 如果总摄入已经达标（如超过1200 kcal），不要建议"增加热量"。`

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
    const body: AuditRequest = await req.json()

    if (!body.date) {
      return new Response(
        JSON.stringify({ error: 'Missing "date" field' }),
        { status: 400, headers },
      )
    }

    // ── Build user prompt with daily data ───────────────────────
    const userPrompt = `日期：${body.date}
总摄入（饮食摄入）：${body.intakeCal} kcal
运动消耗：${body.burnedCal} kcal
净热量（摄入-消耗）：${body.netCal} kcal
蛋白质：${body.proteinG} g
钠：${body.sodiumMg} mg
钾：${body.potassiumMg} mg
钠钾比：${body.naKRatio.toFixed(2)}

请根据以上数据给出简短评价和具体建议。注意：判断"热量是否达标"请使用"总摄入"字段，不要使用"净热量"。`

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 512,
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

    // ── Return evaluation ───────────────────────────────────────
    const result: AuditResponse = { evaluation: content.trim() }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[ai-daily-audit] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers },
    )
  }
})
