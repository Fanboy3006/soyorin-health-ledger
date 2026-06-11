# ═══════════════════════════════════════════════════════════════════
# Deploy health-webhook Edge Function
# ═══════════════════════════════════════════════════════════════════
# 使用方法：
#   1. 确保已安装 supabase CLI
#   2. 确保已登录：supabase login
#   3. 运行此脚本
# ═══════════════════════════════════════════════════════════════════

Write-Output "Deploying health-webhook..."
Write-Output ""

# 部署（不验证 JWT，因为使用自定义 Token）
supabase functions deploy health-webhook --no-verify-jwt

Write-Output ""
Write-Output "Done!"
Write-Output ""
Write-Output "部署后需要在 Supabase Dashboard 设置环境变量："
Write-Output "  - HEALTH_WEBHOOK_TOKEN"
Write-Output "  - SUPABASE_URL"
Write-Output "  - SUPABASE_SERVICE_ROLE_KEY"
Write-Output ""
Write-Output "测试命令："
Write-Output '  curl -X POST https://jddxpgcbhlvayxioneqs.supabase.co/functions/v1/health-webhook \'
Write-Output '    -H "Authorization: Bearer <你的HEALTH_WEBHOOK_TOKEN>" \'
Write-Output '    -H "Content-Type: application/json" \'
Write-Output '    -d "{'
Write-Output '      \"email\": \"zxwu0096@gmail.com\",'
Write-Output '      \"date\": \"2026-06-07\",'
Write-Output '      \"weight_lbs\": 167.5,'
Write-Output '      \"bp_systolic\": 118,'
Write-Output '      \"bp_diastolic\": 78'
Write-Output '    }"'
