// ═══════════════════════════════════════════════════════════════════
// AI 识别弹窗组件（OCR + 图片识别）
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react'
import { type VisionResult } from '../hooks/useLedgerData'

interface VisionRecognizeModalProps {
  onSavePreset: (result: VisionResult) => void
  onSaveEntry: (result: VisionResult) => void
  onClose: () => void
}

type Mode = 'ocr' | 'image'

export default function VisionRecognizeModal({
  onSavePreset,
  onSaveEntry,
  onClose,
}: VisionRecognizeModalProps) {
  const [mode, setMode] = useState<Mode>('ocr')
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VisionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleRecognize = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const body: Record<string, unknown> = {}
      if (mode === 'ocr') {
        body.text = text
      } else if (imageFile) {
        body.imageBase64 = imagePreview
      }

      const res = await fetch(
        `${supabaseUrl}/functions/v1/ai-vision-recognize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify(body),
        },
      )

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`识别失败 (${res.status}): ${errText}`)
      }

      const data = (await res.json()) as VisionResult
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-4">AI 识别</h2>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('ocr')}
            className={`flex-1 text-sm py-2 rounded-lg cursor-pointer ${
              mode === 'ocr'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            文字识别
          </button>
          <button
            onClick={() => setMode('image')}
            className={`flex-1 text-sm py-2 rounded-lg cursor-pointer ${
              mode === 'image'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            图片识别
          </button>
        </div>

        {/* OCR input */}
        {mode === 'ocr' && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            rows={4}
            placeholder="粘贴食物描述文字…"
          />
        )}

        {/* Image input */}
        {mode === 'image' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 cursor-pointer"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-40 mx-auto rounded"
                />
              ) : (
                '点击选择图片'
              )}
            </button>
          </div>
        )}

        {/* Recognize button */}
        <button
          onClick={handleRecognize}
          disabled={
            loading ||
            (mode === 'ocr' && !text.trim()) ||
            (mode === 'image' && !imageFile)
          }
          className="w-full mt-3 text-sm py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
        >
          {loading ? '识别中…' : '开始识别'}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg p-2">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-4 space-y-2 bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">识别结果：</div>
            <div className="text-sm font-medium text-gray-800">
              {result.name}
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
              <span>热量：{result.calories} kcal</span>
              <span>蛋白质：{result.protein_g}g</span>
              <span>脂肪：{result.fat_g}g</span>
              <span>碳水：{result.carb_g}g</span>
              <span>果糖：{result.fructose_g}g</span>
              <span>钠：{result.sodium_mg}mg</span>
              <span>钾：{result.potassium_mg}mg</span>
            </div>
            {result.description && (
              <div className="text-xs text-gray-500 mt-1">
                {result.description}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onSavePreset(result)}
                className="flex-1 text-xs py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              >
                保存为预设
              </button>
              <button
                onClick={() => onSaveEntry(result)}
                className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                直接记入流水
              </button>
            </div>
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full mt-3 text-sm py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
        >
          关闭
        </button>
      </div>
    </div>
  )
}
