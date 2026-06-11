// ═══════════════════════════════════════════════════════════════════
// Supabase Edge Function: health-webhook
// 接收 iPhone 快捷指令发送的 Apple Health 数据，写入 biometrics 表
// 通过邮箱查找 user_id（使用 Supabase Admin API）
// ═══════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[${requestId}] Request received: ${req.method} ${req.url}`)

  try {
    // ── CORS 预检 ──────────────────────────────────────────────
    if (req.method === 'OPTIONS') {
      console.log(`[${requestId}] Handling OPTIONS`)
      return new Response('ok', { headers: CORS_HEADERS })
    }

    // ── 只接受 POST ────────────────────────────────────────────
    if (req.method !== 'POST') {
      console.log(`[${requestId}] Method not allowed: ${req.method}`)
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${requestId}] Handling POST`)

    // ── 验证 Token（临时注释掉，方便测试）───────────────────────
    // const authHeader = req.headers.get('Authorization')
    // const expectedToken = Deno.env.get('HEALTH_WEBHOOK_TOKEN')
    //
    // if (!expectedToken) {
    //   console.error(`[${requestId}] HEALTH_WEBHOOK_TOKEN not set`)
    //   return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
    //     status: 500,
    //     headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    //   })
    // }
    //
    // if (
    //   !authHeader ||
    //   !authHeader.startsWith('Bearer ') ||
    //   authHeader.slice(7) !== expectedToken
    // ) {
    //   console.log(`[${requestId}] Unauthorized: invalid token`)
    //   return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    //     status: 401,
    //     headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    //   })
    // }
    //
    // console.log(`[${requestId}] Token validated`)

    // ── 解析 body ──────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
      console.log(`[${requestId}] Body parsed:`, JSON.stringify(body))
    } catch (e) {
      console.error(`[${requestId}] Invalid JSON:`, e)
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const {
      email,
      date,
      bp_systolic,
      bp_diastolic,
      weight_lbs,
      body_fat_pct,
      steps,
      calories_burned,
    } = body as {
      email?: string
      date?: string
      bp_systolic?: number
      bp_diastolic?: number
      weight_lbs?: number
      body_fat_pct?: number
      steps?: number
      calories_burned?: number
    }

    if (!email) {
      console.log(`[${requestId}] Missing email`)
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (!date) {
      console.log(`[${requestId}] Missing date`)
      return new Response(JSON.stringify({ error: 'Missing date' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── 初始化 Supabase 客户端 ─────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Supabase credentials not set`)
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${requestId}] Creating Supabase client`)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ── 根据邮箱查找 user_id ───────────────────────────────────
    // 使用 service_role key 通过 Admin API 查询 auth.users
    console.log(`[${requestId}] Looking up user by email: ${email}`)

    // 方法1: 尝试用 RPC 查询 auth.users（需要先创建 get_user_id_by_email 函数）
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_user_id_by_email',
      { email_input: email },
    )

    let userId: string | null = null

    if (!rpcError && rpcData) {
      userId = rpcData as string
      console.log(`[${requestId}] Found user via RPC: ${userId}`)
    } else {
      // 方法2: 回退到 user_profile 表查询
      console.log(`[${requestId}] RPC failed (${rpcError?.message}), trying user_profile`)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profile')
        .select('user_id')
        .eq('email', email)
        .maybeSingle()

      if (!profileError && profileData?.user_id) {
        userId = profileData.user_id
        console.log(`[${requestId}] Found user via user_profile: ${userId}`)
      }
    }

    if (!userId) {
      console.error(`[${requestId}] User not found: ${email}`)
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── 写入 biometrics 表 ─────────────────────────────────────
    const record = {
      date,
      user_id: userId,
      bp_systolic: bp_systolic ?? null,
      bp_diastolic: bp_diastolic ?? null,
      weight_lbs: weight_lbs ?? null,
      body_fat_pct: body_fat_pct ?? null,
      steps: steps ?? null,
      calories_burned: calories_burned ?? null,
      source: 'apple_health',
      created_at: new Date().toISOString(),
    }
    console.log(`[${requestId}] Upserting biometrics:`, JSON.stringify(record))

    const { error: insertError } = await supabase
      .from('biometrics')
      .upsert(record, {
        onConflict: 'date,user_id',
        ignoreDuplicates: false,
      })

    if (insertError) {
      console.error(`[${requestId}] Supabase insert error:`, insertError)
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${requestId}] Success`)
    return new Response(
      JSON.stringify({ success: true, message: 'ok' }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    console.error(`[${requestId}] Unhandled error:`, e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    )
  }
})
