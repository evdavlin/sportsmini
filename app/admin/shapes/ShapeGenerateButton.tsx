'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { AdminBottomMessage } from '@/app/admin/AdminBottomMessage'
import { generateCandidatesAction } from '@/lib/candidate-actions'

const s = {
  hero: '#3D5F7A',
  textMuted: '#7A7A7A',
  border: '#D6D0C4',
}

function formatTopScore(n: number | null): string {
  if (n == null) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function ShapeGenerateButton({ shapeId }: { shapeId: string }) {
  const router = useRouter()
  const [isGenPending, startGenTransition] = useTransition()
  const [flash, setFlash] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const clearFlash = useCallback(() => setFlash(null), [])

  return (
    <>
      <AdminBottomMessage
        text={flash?.text ?? null}
        variant={flash?.kind === 'ok' ? 'success' : 'error'}
        onDone={clearFlash}
      />
      <button
        type="button"
        disabled={isGenPending}
        title="Generate 3 candidates for this shape"
        onClick={() => {
          startGenTransition(async () => {
            const res = await generateCandidatesAction({ shape_id: shapeId, count: 3 })
            if (res.success) {
              setFlash({
                kind: 'ok',
                text: `Generated ${res.candidate_count} candidates (top score ${formatTopScore(res.top_score)})`,
              })
              router.refresh()
            } else {
              setFlash({ kind: 'err', text: res.error ?? 'Generation failed' })
            }
          })
        }}
        style={{
          padding: '8px 14px',
          background: isGenPending ? s.border : s.hero,
          color: isGenPending ? s.textMuted : '#fff',
          border: 'none',
          borderRadius: 4,
          fontWeight: 700,
          fontSize: 13,
          cursor: isGenPending ? 'wait' : 'pointer',
          opacity: isGenPending ? 0.9 : 1,
        }}
      >
        {isGenPending ? 'Generating…' : 'Generate'}
      </button>
    </>
  )
}
