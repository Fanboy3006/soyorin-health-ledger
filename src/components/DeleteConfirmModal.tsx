// ═══════════════════════════════════════════════════════════════════
// 删除确认弹窗组件
// ═══════════════════════════════════════════════════════════════════

interface DeleteConfirmModalProps {
  entryName: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({
  entryName,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">确认删除</h2>
        <p className="text-sm text-gray-600 mb-6">
          确定要删除「{entryName}」这条记录吗？
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 text-sm py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
          >
            删除
          </button>
          <button
            onClick={onCancel}
            className="flex-1 text-sm py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
