// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function: ai-chat
// AI 对话助手 — 流式返回，自动注入最近 7 天健康数据作为上下文
// ═══════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  userId: string
}

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? ''
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const SYSTEM_PROMPT = `你是一个专业的健康顾问助手，名叫 Soyorin。你正在帮助用户管理他们的日常健康数据。

你可以：
1. 分析用户的饮食和训练数据
2. 提供营养建议
3. 回答关于健康指标的问题
4. 帮助用户理解他们的健康趋势

请用友好、专业的中文回答。回答要简洁、有针对性。`

serve(async (req: Request) => {
  // ── CORS headers ──────────────────────────────────────────────
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) } },
    )
  }

  // ── Validate API key ──────────────────────────────────────────
  if (!DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) } },
    )
  }

  try {
    // ── Parse request body ──────────────────────────────────────
    const body: ChatRequest = await req.json()

    if (!body.messages || !body.userId) {
      return new Response(
        JSON.stringify({ error: 'Missing "messages" or "userId" field' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) } },
      )
    }

    // ── Fetch recent 7 days of daily summaries ──────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const startDate = sevenDaysAgo.toISOString().split('T')[0]

    const { data: summaries } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', body.userId)
      .gte('date', startDate)
      .order('date', { ascending: false })

    // ── Build context from summaries ────────────────────────────
    let contextBlock = ''
    if (summaries && summaries.length > 0) {
      contextBlock = `\n\n以下是用户最近 7 天的健康数据摘要，供你参考：\n\`\`\`\n`
      for (const s of summaries) {
        contextBlock += `日期: ${s.date}
  总摄入: ${s.total_cal ?? 0} kcal
  运动消耗: ${s.total_burned_cal ?? 0} kcal
  净热量: ${s.net_cal ?? 0} kcal
  蛋白质: ${s.total_protein_g ?? 0} g
  钠: ${s.total_sodium_mg ?? 0} mg
  钾: ${s.total_potassium_mg ?? 0} mg
  钠钾比: ${s.na_k_ratio ?? 0}
  流水条数: ${s.entry_count ?? 0}
  ---\n`
      }
      contextBlock += '```\n'
    } else {
      contextBlock = '\n\n（用户最近 7 天暂无健康数据）'
    }

    // ── Fetch health profile ────────────────────────────────────
    let healthProfileBlock = ''
    try {
      const { data: hpData } = await supabase
        .from('user_settings')
        .select('value')
        .eq('user_id', body.userId)
        .eq('key', 'health_profile')
        .single()

      if (hpData?.value) {
        healthProfileBlock = `\n\n以下是用户的健康档案信息，请参考这些信息提供个性化建议：\n\`\`\`\n${hpData.value}\n\`\`\`\n`
      }
    } catch {
      // Health profile not available, continue without it
    }

    // ── Build messages with context ─────────────────────────────
    const contextMessage: ChatMessage = {
      role: 'system',
      content: SYSTEM_PROMPT + healthProfileBlock + contextBlock,
    }

    const apiMessages = [contextMessage, ...body.messages.filter((m) => m.role !== 'system')]

    // ── Call DeepSeek API (streaming) ───────────────────────────
    const deepseekResponse = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      }),
    })

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text()
      console.error('[DeepSeek] API error:', deepseekResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `DeepSeek API returned ${deepseekResponse.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) } },
      )
    }

    // ── Stream response back to client ──────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const reader = deepseekResponse.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let fullContent = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

            for (const line of lines) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                if (content) {
                  fullContent += content
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        } catch (e) {
          console.error('[ai-chat] Stream error:', e)
        } finally {
          reader.releaseLock()
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, { status: 200, headers })
  } catch (error) {
    console.error('[ai-chat] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) } },
    )
  }
})
