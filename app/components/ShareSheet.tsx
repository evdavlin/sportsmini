'use client'

import { useCallback, useMemo, useState } from 'react'
import type { PuzzlePayload } from '@/lib/puzzles'
import type { SolveState } from '@/lib/progress'
import {
  buildEmojiGrid,
  buildShareString,
  formatPuzzleNumber,
  formatTime,
  getPuzzleNumber,
  gridToPattern,
} from '@/lib/share'
import { CheckIcon, ShareIcon, theme } from './theme'

const MOCK_PERCENTILE = 12
const MOCK_STREAK_SHARE = 13

type ShareSheetProps = {
  open: boolean
  onClose: () => void
  puzzle: PuzzlePayload
  solveState: SolveState
}

export default function ShareSheet({ open, onClose, puzzle, solveState }: ShareSheetProps) {
  const [copied, setCopied] = useState(false)
  const [copyErr, setCopyErr] = useState<string | null>(null)

  const pattern = useMemo(() => gridToPattern(puzzle.grid), [puzzle.grid])
  const puzzleNumber = useMemo(() => getPuzzleNumber(puzzle.publish_date), [puzzle.publish_date])

  const shareString = useMemo(
    () =>
      buildShareString({
        puzzleNumber,
        timeSeconds: solveState.timeSeconds,
        percentile: MOCK_PERCENTILE,
        streak: MOCK_STREAK_SHARE,
        hintCount: solveState.wasRevealed ? 0 : solveState.hintsUsed,
        pattern,
        hintedCells: solveState.hintedCells,
      }),
    [puzzleNumber, solveState, pattern]
  )

  const statsPreviewLine = useMemo(() => {
    const parts = [`⏱ ${formatTime(solveState.timeSeconds)}`, `Top ${MOCK_PERCENTILE}%`]
    if (MOCK_STREAK_SHARE > 0) parts.push(`🔥 Day ${MOCK_STREAK_SHARE}`)
    const hc = solveState.wasRevealed ? 0 : solveState.hintsUsed
    if (hc > 0) parts.push(`${hc} hint${hc === 1 ? '' : 's'}`)
    return parts.join(' · ')
  }, [solveState])

  const emojiBlock = useMemo(
    () => buildEmojiGrid(pattern, solveState.hintedCells),
    [pattern, solveState.hintedCells]
  )

  const handleCopy = useCallback(async () => {
    setCopyErr(null)
    try {
      await navigator.clipboard.writeText(shareString)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyErr('Could not copy — try another browser')
      window.setTimeout(() => setCopyErr(null), 3000)
    }
  }, [shareString])

  const handleMoreOptions = useCallback(async () => {
    const url = 'https://sportsmini.vercel.app'
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Sports Words',
          text: shareString,
          url,
        })
        return
      }
    } catch {
      /* User cancelled or error — fall through */
    }
    await handleCopy()
  }, [shareString, handleCopy])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(20,20,20,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: 420,
          background: theme.bg,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: '20px 24px 28px',
          borderTop: `1px solid ${theme.borderSoft}`,
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, background: theme.borderSoft, borderRadius: 2, margin: '0 auto 16px' }} />

        <h2
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 900,
            fontSize: 22,
            textAlign: 'center',
            margin: '0 0 8px',
            color: theme.text,
          }}
        >
          Share your score
        </h2>
        <p style={{ textAlign: 'center', color: theme.textMuted, fontSize: 13, margin: '0 0 18px' }}>
          Preview of what will be copied
        </p>

        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.borderSoft}`,
            padding: '18px 16px',
            marginBottom: 14,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            lineHeight: 1.45,
            color: theme.text,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Sports Words {formatPuzzleNumber(puzzleNumber)}
          </div>
          <div style={{ color: theme.textMuted, marginBottom: 10 }}>{statsPreviewLine}</div>
          <div style={{ whiteSpace: 'pre', marginBottom: 10 }}>{emojiBlock}</div>
          <div style={{ color: theme.textMuted }}>sportswords.app</div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginBottom: 14 }}>
          🟦 Clean &nbsp; 🟨 Hint used &nbsp; ⬛ Black square
        </div>

        {copyErr ? (
          <div style={{ color: theme.error, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{copyErr}</div>
        ) : null}

        <button
          type="button"
          onClick={handleCopy}
          style={{
            width: '100%',
            background: copied ? theme.success : theme.hero,
            color: theme.heroOnDark,
            border: 'none',
            padding: 14,
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          {copied ? (
            <>
              <CheckIcon color={theme.heroOnDark} size={18} />
              COPIED TO CLIPBOARD
            </>
          ) : (
            <>
              <ShareIcon color={theme.heroOnDark} size={18} />
              COPY RESULT
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleMoreOptions}
          style={{
            width: '100%',
            background: 'transparent',
            color: theme.text,
            border: `1px solid ${theme.borderSoft}`,
            padding: 14,
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          MORE OPTIONS
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: theme.textMuted,
            fontSize: 14,
            cursor: 'pointer',
            padding: 8,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
