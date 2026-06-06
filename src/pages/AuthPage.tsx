// ═══════════════════════════════════════════════════════════════════
// AuthPage — 登录/注册页面
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { createSamplePresets } from '../lib/samplePresets'

export default function AuthPage() {
  const navigate = useNavigate()
  const { user, signIn, signUp } = useAuth()
  const createdRef = useRef(false)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ── Auto-navigate to home when user becomes logged in ──────────
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  // ── Create sample presets on first login ───────────────────────
  useEffect(() => {
    if (user && !createdRef.current) {
      createdRef.current = true
      createSamplePresets(user.id)
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      const errMsg =
        mode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password)

      if (errMsg) {
        setError(errMsg)
      } else if (mode === 'register') {
        setSuccessMsg('注册成功！请查看邮箱确认链接，然后登录。')
      }
      // login success → user state changes → useEffect navigates to /
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            健康账本
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login' ? '登录以同步数据' : '注册新账号'}
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              邮箱
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              密码
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
              {successMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading
              ? '处理中…'
              : mode === 'login'
                ? '登录'
                : '注册'}
          </button>

          {/* Toggle mode */}
          <div className="text-center text-xs text-gray-400">
            {mode === 'login' ? (
              <span>
                没有账号？{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                    setSuccessMsg(null)
                  }}
                  className="text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  注册
                </button>
              </span>
            ) : (
              <span>
                已有账号？{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                    setSuccessMsg(null)
                  }}
                  className="text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  登录
                </button>
              </span>
            )}
          </div>
        </form>

        {/* Skip link */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            跳过，先试用
          </button>
        </div>
      </div>
    </div>
  )
}
