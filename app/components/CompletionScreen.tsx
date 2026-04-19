'use client'

import { useMemo, useState } from 'react'
import type { PuzzlePayload } from '@/lib/puzzles'
import type { SolveState } from '@/lib/progress'
import {
  formatNextPuzzleInEt,
  formatPuzzleNumber,
  formatTime,
  getPuzzleNumber,
} from '@/lib/share'
import ShareSheet from '@/app/components/ShareSheet'
import {
  AppHeader,
  DistBar,
  MiniStat,
  ShareIcon,
  theme,
} from '@/app/components/theme'

const MOCK_STREAK_HEADER = 13 // TODO: Replace with real streak when Sprint 5 stats lands
const MOCK_PERCENTILE = 12 // TODO: real percentile from backend

/** TODO Sprint 5: replace with real aggregated stats from solves table */
const MOCK_LIFETIME = {
  streak: '🔥 13',
  played: '42',
  winPct: '96',
  avg: '2:15',
}

const SOLVE_TIME_DIST = [
  { label: '<1min', count: 4 },
  { label: '1-2min', count: 12 },
  { label: '2-3min', count: 15 },
  { label: '3-4min', count: 8 },
  { label: '4min+', count: 3 },
]

function distBucketIndex(seconds: number): number {
  if (seconds < 60) return 0
  if (seconds < 120) return 1
  if (seconds < 180) return 2
  if (seconds < 240) return 3
  return 4
}

function solvedEyebrow(solve: SolveState): string {
  if (solve.wasRevealed) return 'SOLVED · FULL REVEAL'
  if (solve.hintsUsed === 0) return 'SOLVED'
  if (solve.hintsUsed === 1) return 'SOLVED · 1 HINT USED'
  return `SOLVED · ${solve.hintsUsed} HINTS USED`
}

function formatPublishLong(publishDate: string): string {
  const [y, mo, d] = publishDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt)
}

export default function CompletionScreen({
  puzzle,
  solveState,
}: {
  puzzle: PuzzlePayload
  solveState: SolveState
}) {
  const [shareOpen, setShareOpen] = useState(false)

  const puzzleNumLabel = useMemo(
    () => formatPuzzleNumber(getPuzzleNumber(puzzle.publish_date)),
    [puzzle.publish_date]
  )

  const metaLine = useMemo(
    () => `${puzzleNumLabel} · ${formatPublishLong(puzzle.publish_date)}`,
    [puzzleNumLabel, puzzle.publish_date]
  )

  const bucketIdx = distBucketIndex(solveState.timeSeconds)
  const maxCount = Math.max(...SOLVE_TIME_DIST.map((b) => b.count), 1)

  const nextIn = useMemo(() => formatNextPuzzleInEt(), [])

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <AppHeader streak={MOCK_STREAK_HEADER} />

        <div style={{ padding: '24px 24px 32px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 3,
              color: theme.hero,
              marginBottom: 16,
            }}
          >
            {solvedEyebrow(solveState)}
          </div>

          <h1
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 900,
              fontSize: 24,
              color: theme.text,
              margin: '0 0 8px',
              lineHeight: 1.15,
            }}
          >
            {puzzle.title ?? "Today's Puzzle"}
          </h1>
          <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 28 }}>{metaLine}</div>

          <div
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 64,
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            {formatTime(solveState.timeSeconds)}
          </div>

          <div
            style={{
              display: 'inline-block',
              background: theme.hero,
              color: theme.heroOnDark,
              padding: '8px 18px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              marginBottom: 24,
            }}
          >
            TOP {MOCK_PERCENTILE}% TODAY
          </div>

          {/* TODO Sprint 5: replace with real aggregated stats from solves table */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              paddingTop: 20,
              paddingBottom: 20,
              borderTop: `1px solid ${theme.borderSoft}`,
              borderBottom: `1px solid ${theme.borderSoft}`,
              marginBottom: 28,
            }}
          >
            <MiniStat label="STREAK" value={MOCK_LIFETIME.streak} />
            <MiniStat label="PLAYED" value={MOCK_LIFETIME.played} />
            <MiniStat label="WIN %" value={MOCK_LIFETIME.winPct} />
            <MiniStat label="AVG" value={MOCK_LIFETIME.avg} />
          </div>

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              color: theme.textMuted,
              marginBottom: 12,
              textAlign: 'left',
            }}
          >
            YOUR SOLVE TIMES
          </div>
          {SOLVE_TIME_DIST.map((b, i) => (
            <DistBar
              key={b.label}
              label={b.label}
              count={b.count}
              max={maxCount}
              highlight={i === bucketIdx}
            />
          ))}

          <button
            type="button"
            onClick={() => setShareOpen(true)}
            style={{
              width: '100%',
              marginTop: 28,
              background: theme.hero,
              color: theme.heroOnDark,
              border: 'none',
              padding: 16,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 3,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <ShareIcon color={theme.heroOnDark} size={20} />
            SHARE MY SCORE
          </button>

          <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 24 }}>
            Next puzzle in {nextIn}
          </div>
        </div>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        puzzle={puzzle}
        solveState={solveState}
      />
    </div>
  )
}
