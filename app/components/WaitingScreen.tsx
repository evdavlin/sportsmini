'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { PuzzlePayload } from '@/lib/puzzles'
import type { TodaySolve } from '@/lib/progress'
import { getTodaySolve } from '@/lib/progress'
import { getMockStats } from '@/lib/mock-stats'
import {
  AppHeader,
  CheckIcon,
  GridDisplay,
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

function formatCountdownClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

function nextPuzzleSubtitle(next: Date): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${months[next.getMonth()]} ${next.getDate()} · 7:00 AM`
}

export default function WaitingScreen({ puzzle }: { puzzle: PuzzlePayload }) {
  const router = useRouter()
  const [solve, setSolve] = useState<TodaySolve | null>(null)
  const [remainMs, setRemainMs] = useState(0)

  useEffect(() => {
    const s = getTodaySolve(puzzle.publish_date)
    if (!s) {
      router.replace('/')
      return
    }
    setSolve(s)
  }, [puzzle.publish_date, router])

  useEffect(() => {
    const tick = () => {
      const target = getNextLocal7am()
      setRemainMs(Math.max(0, target.getTime() - Date.now()))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const stats = useMemo(() => (solve ? getMockStats(solve) : getMockStats(null)), [solve])

  const handleShare = async () => {
    if (!solve) return
    const pct = percentileRank(solve.time_seconds)
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

  if (!solve) {
    return null
  }

  const pct = percentileRank(solve.time_seconds)
  const gridData = buildCompletedGrid(puzzle, solve.entered)
  const puzzleNum = formatPuzzleNumberFromTitle(puzzle.title)
  const timeStr = formatElapsedDisplay(solve.time_seconds)

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <AppHeader streak={stats.streak} />

        <div style={{ padding: '36px 24px 32px', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 24px',
              borderRadius: '50%',
              background: theme.hero,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon color="#FFFFFF" size={26} />
          </div>

          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 26,
              fontWeight: 900,
              color: theme.text,
              margin: '0 0 10px',
              lineHeight: 1.1,
            }}
          >
            Today&apos;s in the books
          </h1>

          <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 32 }}>
            You solved {puzzleNum} in {timeStr} · Top {pct}%
          </div>

          <div style={{ marginBottom: 32 }}>
            <GridDisplay data={gridData} size={200} />
          </div>

          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 6,
              padding: '18px 20px',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                color: theme.textMuted,
                marginBottom: 10,
              }}
            >
              NEXT PUZZLE
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 34,
                fontWeight: 700,
                color: theme.text,
                marginBottom: 4,
                letterSpacing: 0.5,
              }}
            >
              {formatCountdownClock(remainMs)}
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>
              {nextPuzzleSubtitle(getNextLocal7am())}
            </div>
          </div>

          <button
            type="button"
            onClick={handleShare}
            style={{
              width: '100%',
              background: 'transparent',
              color: theme.text,
              border: `1px solid ${theme.text}`,
              padding: '14px',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 4,
              cursor: 'pointer',
              marginBottom: 8,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            SHARE RESULT
          </button>

          <Link
            href="/stats"
            style={{
              display: 'block',
              width: '100%',
              background: 'transparent',
              color: theme.textMuted,
              border: 'none',
              padding: '10px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            View full stats →
          </Link>
        </div>
      </div>
    </div>
  )
}
