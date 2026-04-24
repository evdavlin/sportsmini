'use client'

import { useRouter } from 'next/navigation'

import { deleteShapeTemplateAction } from '@/lib/shape-actions'

export function DeleteShapeTemplateButton({ shapeId }: { shapeId: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm('Delete shape template? This cannot be undone.')) return
        await deleteShapeTemplateAction(shapeId)
        router.refresh()
      }}
      style={{ padding: '8px 12px', color: '#A8505A', fontWeight: 600 }}
    >
      Delete
    </button>
  )
}
