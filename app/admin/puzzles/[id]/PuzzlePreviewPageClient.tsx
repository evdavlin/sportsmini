'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import SolveScreen from '@/app/components/SolveScreen'
import { formatElapsed, theme } from '@/app/components/theme'
import type { PuzzlePayload } from '@/lib/puzzles'
import { clearPreviewSolve, getPreviewSolve } from '@/lib/progress'

function statusBadgeColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'draft':
      return { bg: theme.statusDraftBg, fg: theme.statusDraft }
    case 'queued':
      return { bg: theme.statusQueuedBg, fg: theme.statusQueued }
    case 'published':
      return { bg: theme.statusLiveBg, fg: theme.statusLive }
    case 'archived':
      return { bg: theme.statusArchivedBg, fg: theme.statusArchived }
    default:
      return { bg: theme.surface, fg: theme.textMuted }
  }
}

export function PuzzlePreviewPageClient({
  puzzle,
  status,
  displayTitle,
}: {
  puzzle: PuzzlePayload
  status: string
  displayTitle: string | null
}) {
  const [completedSec, setCompletedSec] = useState<number | null>(null)
  const badge = useMemo(() => statusBadgeColors(status), [status])

  useEffect(() => {
    const s = getPreviewSolve(puzzle.puzzle_id)
    if (s?.solvedAt && typeof s.timeSeconds === 'number') setCompletedSec(s.timeSeconds)
  }, [puzzle.puzzle_id])

  const onPreviewSolveComplete = useCallback((sec: number) => {
    setCompletedSec(sec)
  }, [])

  function resetPreview() {
    clearPreviewSolve(puzzle.puzzle_id)
    window.location.reload()
  }

  const titleText = displayTitle ?? puzzle.title ?? 'Untitled'

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          background: theme.surface,
          borderBottom: `1px solid ${theme.borderSoft}`,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            rowGap: 10,
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: theme.textMuted,
                marginBottom: 4,
              }}
            >
              Preview mode
            </div>
            <div
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontWeight: 900,
                fontSize: 18,
                lineHeight: 1.25,
                color: theme.text,
              }}
            >
              {titleText}
            </div>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                background: badge.bg,
                color: badge.fg,
              }}
            >
              {status}
            </span>
          </div>

          <div
            style={{
              flex: '1 1 160px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={resetPreview}
              style={{
                padding: '8px 14px',
                border: `1px solid ${theme.text}`,
                background: 'transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Reset
            </button>
            <Link href="/admin" style={{ color: theme.hero, fontWeight: 600, fontSize: 14 }}>
              ← Back to admin
            </Link>
          </div>
        </div>

        {completedSec != null ? (
          <div
            style={{
              maxWidth: 420,
              margin: '0 auto',
              padding: '0 16px 10px',
              fontSize: 14,
              fontWeight: 700,
              color: theme.hero,
            }}
          >
            Completed in {formatElapsed(completedSec)}
          </div>
        ) : null}
      </div>

      <SolveScreen
        puzzle={puzzle}
        previewMode
        suppressPreviewBanner
        onPreviewSolveComplete={onPreviewSolveComplete}
      />
    </>
  )
}
