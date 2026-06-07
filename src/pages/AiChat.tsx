// ═══════════════════════════════════════════════════════════════════
// AiChat — AI 对话助手页面
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/auth'

// ── Types ─────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Component ─────────────────────────────────────────────────────

export default function AiChat() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Auto scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // ── Focus input on mount ───────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Send message ───────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading || !user?.id) return

    setInput('')
    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    setLoading(true)
    setStreamingContent('')

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          userId: user.id,
        },
      })

      if (fnError) throw new Error(fnError.message)

      // Handle streaming response
      if (data?.content !== undefined) {
        // Non-streaming fallback
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.content,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
      console.error('[AiChat] Send failed:', e)
    } finally {
      setLoading(false)
      setStreamingContent('')
    }
  }

  // ── Handle Enter key ───────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── New conversation ───────────────────────────────────────────
  const handleNewChat = () => {
    setMessages([])
    setStreamingContent('')
    setError(null)
    setInput('')
    inputRef.current?.focus()
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">AI 助手</h1>
              <p className="text-xs text-gray-400">Soyorin 健康顾问</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            ✨ 新对话
          </button>
        </div>
      </header>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🤖</div>
              <p className="text-gray-400 text-lg mb-2">你好！我是 Soyorin</p>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                我可以帮你分析健康数据、提供营养建议、回答关于饮食和训练的问题。
              </p>
              <div className="mt-6 space-y-2 max-w-sm mx-auto">
                {[
                  '分析我最近一周的饮食情况',
                  '我的钠钾比正常吗？',
                  '今天的热量摄入达标了吗？',
                  '给我一些减脂建议',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className="block w-full text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 cursor-pointer transition-colors"
                  >
                    💬 {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-700 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div>{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {loading && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-white border border-gray-200 text-gray-700 rounded-bl-md">
                  <div className="whitespace-pre-wrap">{streamingContent}</div>
                  <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {/* Loading indicator (no content yet) */}
            {loading && !streamingContent && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200 rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              ❌ {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <div className="border-t border-gray-200 bg-white shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || !user?.id}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '…' : '发送'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Enter 发送 · Shift+Enter 换行
          </p>
        </div>
      </div>
    </div>
  )
}
