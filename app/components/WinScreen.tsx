'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { PuzzlePayload } from '@/lib/puzzles'
import type { TodaySolve } from '@/lib/progress'
import { getTodaySolve } from '@/lib/progress'
import { getMockStats } from '@/lib/mock-stats'
import {
  AppHeader,
  GridDisplay,
  MiniStat,
  formatElapsedDisplay,
  formatPuzzleNumberFromTitle,
  getNextLocal7am,
  theme,
  type GridData,
} from './theme'

const SHARE_URL = 'sportsmini.vercel.app'

function buildNumberMap(puzzle: PuzzlePayload): Map<string, number> {
  const map = new Map<string, number>()
  for (const clue of [...puzzle.across, ...puzzle.down]) {
    const key = `${clue.row},${clue.col}`
    if (!map.has(key)) map.set(key, clue.num)
  }
  return map
}

function buildCompletedGrid(puzzle: PuzzlePayload, entered: Record<string, string>): GridData {
  const nm = buildNumberMap(puzzle)
  return puzzle.grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell === '#') return null
      const k = `${r},${c}`
      const letter = entered[k] ?? cell
      const num = nm.get(k)
      return {
        letter,
        ...(num !== undefined ? { number: num } : {}),
      }
    })
  )
}

function percentileRank(seconds: number): number {
  return Math.min(35, Math.max(8, Math.floor(seconds / 10)))
}

function formatNextPuzzleCountdownMs(): string {
  const next = getNextLocal7am()
  const ms = next.getTime() - Date.now()
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  return `${h}h ${m}m`
}

function solvedLabel(hintsUsed: number): string {
  if (hintsUsed === 0) return 'SOLVED · NO HINTS'
  if (hintsUsed >= 999) return 'SOLVED · REVEAL USED'
  if (hintsUsed === 1) return 'SOLVED · 1 HINT USED'
  return `SOLVED · ${hintsUsed} HINTS USED`
}

export default function WinScreen({ puzzle }: { puzzle: PuzzlePayload }) {
  const router = useRouter()
  const [solve, setSolve] = useState<TodaySolve | null>(null)

  useEffect(() => {
    const s = getTodaySolve(puzzle.publish_date)
    if (!s) {
      router.replace('/')
      return
    }
    setSolve(s)
  }, [puzzle.publish_date, router])

  const stats = useMemo(() => (solve ? getMockStats(solve) : getMockStats(null)), [solve])

  if (!solve) {
    return null
  }

  const pct = percentileRank(solve.time_seconds)
  const gridData = buildCompletedGrid(puzzle, solve.entered)
  const puzzleNum = formatPuzzleNumberFromTitle(puzzle.title)
  const timeStr = formatElapsedDisplay(solve.time_seconds)
  const hintShare =
    solve.hints_used >= 999
      ? 'Reveal'
      : solve.hints_used === 0
        ? 'no hints'
        : `${solve.hints_used} hint${solve.hints_used === 1 ? '' : 's'}`

  const shareBody = [
    `🏆 Sports Words ${puzzleNum}`,
    `⏱ ${timeStr} · Top ${pct}%`,
    `🔥 Day ${stats.streak} · ${hintShare}`,
    SHARE_URL,
  ].join('\n')

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareBody })
        return
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(shareBody)
    } catch {
      /* ignore */
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <AppHeader streak={stats.streak} />

        <div style={{ padding: '28px 24px 32px', textAlign: 'center' }}>
          <div style={{ marginBottom: 28 }}>
            <GridDisplay data={gridData} size={180} />
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 3,
              color: theme.hero,
              marginBottom: 12,
            }}
          >
            {solvedLabel(solve.hints_used)}
          </div>

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
            {timeStr}
          </div>

          <div
            style={{
              display: 'inline-block',
              background: theme.hero,
              color: theme.heroOnDark,
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              marginBottom: 28,
            }}
          >
            TOP {pct}% TODAY
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 0,
              paddingTop: 20,
              paddingBottom: 20,
              borderTop: `1px solid ${theme.borderSoft}`,
              borderBottom: `1px solid ${theme.borderSoft}`,
              marginBottom: 28,
            }}
          >
            <MiniStat label="STREAK" value={`🔥 ${stats.streak}`} />
            <MiniStat label="AVG" value={formatElapsedDisplay(stats.avgSeconds)} />
            <MiniStat label="PLAYED" value={String(stats.played)} />
          </div>

          <button
            type="button"
            onClick={handleShare}
            style={{
              width: '100%',
              background: theme.hero,
              color: theme.heroOnDark,
              border: 'none',
              padding: '16px',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 3,
              borderRadius: 4,
              cursor: 'pointer',
              marginBottom: 20,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            SHARE RESULT
          </button>

          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 6,
              padding: 14,
              textAlign: 'left',
              fontSize: 12,
              color: theme.text,
              lineHeight: 1.6,
              fontFamily: 'ui-monospace, monospace',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                color: theme.textMuted,
                marginBottom: 8,
                fontFamily: 'system-ui',
              }}
            >
              SHARE PREVIEW
            </div>
            🏆 Sports Words {puzzleNum}
            <br />
            ⏱ {timeStr} · Top {pct}%
            <br />
            🔥 Day {stats.streak} · {hintShare}
            <br />
            {SHARE_URL}
          </div>

          <div style={{ color: theme.textMuted, fontSize: 12 }}>Next puzzle in {formatNextPuzzleCountdownMs()}</div>
        </div>
      </div>
    </div>
  )
}
