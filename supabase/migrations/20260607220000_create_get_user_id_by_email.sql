-- ═══════════════════════════════════════════════════════════════════
-- Migration: Create get_user_id_by_email RPC function
-- 用于 health-webhook Edge Function 通过邮箱查找 user_id
-- ═══════════════════════════════════════════════════════════════════

-- 创建函数：通过邮箱从 auth.users 查找用户 ID
-- 使用 SECURITY DEFINER 以绕过 RLS，因为需要访问 auth schema
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = email_input;

  RETURN user_id;
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_user_id_by_email TO service_role;
GRANT EXECUTE ON FUNCTION get_user_id_by_email TO anon;
GRANT EXECUTE ON FUNCTION get_user_id_by_email TO authenticated;
