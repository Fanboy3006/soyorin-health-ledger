// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function: ai-vision-recognize
// Receives user text description + OCR text from image,
// calls DeepSeek API to parse into structured nutrition data.
// ═══════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface RecognizeRequest {
  /** 用户手动输入的文字描述（可选） */
  text?: string
  /** 前端 OCR 从图片中提取的文字（可选） */
  ocrText?: string
}

interface RecognizeResponse {
  name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  fat_g: number
  carb_g: number
  fructose_g: number
  sodium_mg: number
  potassium_mg: number
  description: string
}

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? ''
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT = `你是一个食物识别与营养估算专家。你的任务是根据用户提供的文字描述和/或从图片中 OCR 提取的文字，识别食物并估算营养成分。

用户可能提供：
1. 文字描述：如"一碗米饭"、"煎牛排 200g"
2. OCR 文字：从营养成分表、食物标签、菜单等图片中提取的文字

请结合所有信息，返回严格的 JSON 格式，包含以下字段：
- name: 食物名称（简短，如"草莓"、"煎牛排"）
- quantity: 数量（根据描述合理估算，如 300）
- unit: 单位（如 g、ml、个、碗、份）
- calories: 总热量 (kcal)
- protein_g: 蛋白质 (g)
- fat_g: 脂肪 (g)
- carb_g: 碳水 (g)
- fructose_g: 果糖 (g) — 如果食物明显含果糖（水果、蜂蜜、含糖饮料），根据常见值估算；否则设为 0
- sodium_mg: 钠 (mg)
- potassium_mg: 钾 (mg)
- description: 简短描述（如"新鲜草莓，约 300g"）

注意：
1. 如果 OCR 文字来自营养成分表，请优先使用营养成分表中的数据（每100g含量 × 实际份量）
2. 如果只有文字描述，根据描述合理估算
3. 营养数据请参考 USDA 或常见食物数据库
4. 请严格返回 JSON 格式，不要包含 markdown 代码块标记或其他文字。只返回 JSON 对象本身。`

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
    const body: RecognizeRequest = await req.json()

    if (!body.text && !body.ocrText) {
      return new Response(
        JSON.stringify({ error: '请提供文字描述或 OCR 文字' }),
        { status: 400, headers },
      )
    }

    // ── Build user message ──────────────────────────────────────
    let userMessage = ''
    if (body.text) {
      userMessage += `用户描述：${body.text}\n`
    }
    if (body.ocrText) {
      userMessage += `\n图片 OCR 提取的文字：\n${body.ocrText}\n`
    }
    userMessage += '\n请根据以上信息识别食物并估算营养成分。'

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
        max_tokens: 1024,
      }),
    })

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text()
      console.error('[DeepSeek Vision] API error:', deepseekResponse.status, errorText)
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

    let result: RecognizeResponse
    try {
      result = JSON.parse(jsonStr)
    } catch {
      console.error('[DeepSeek Vision] Failed to parse JSON from response:', content)
      return new Response(
        JSON.stringify({
          error: 'Failed to parse DeepSeek response as JSON',
          raw: content,
        }),
        { status: 502, headers },
      )
    }

    // ── Validate required fields ─────────────────────────────────
    if (!result.name) {
      return new Response(
        JSON.stringify({
          error: 'DeepSeek response missing required field: name',
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
    console.error('[ai-vision-recognize] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers },
    )
  }
})
