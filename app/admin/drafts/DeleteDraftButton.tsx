'use client'

import { useRouter } from 'next/navigation'
import { deleteDraftAction } from '@/app/admin/actions'

export function DeleteDraftButton({ puzzleId }: { puzzleId: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm('Delete this draft permanently?')) return
        await deleteDraftAction(puzzleId)
        router.refresh()
      }}
      style={{ padding: '8px 12px', color: '#A8505A', fontWeight: 600 }}
    >
      Delete
    </button>
  )
}
