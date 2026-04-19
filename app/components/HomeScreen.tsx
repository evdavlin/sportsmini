'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { PuzzlePayload } from '@/lib/puzzles'
import { getTodaySolve } from '@/lib/progress'
import { getMockStats } from '@/lib/mock-stats'
import { formatPuzzleNumber, getPuzzleNumber } from '@/lib/share'
import {
  AppHeader,
  GridDisplay,
  formatMetaDateLine,
  theme,
  type GridData,
} from './theme'

function buildNumberMap(puzzle: PuzzlePayload): Map<string, number> {
  const map = new Map<string, number>()
  for (const clue of [...puzzle.across, ...puzzle.down]) {
    const key = `${clue.row},${clue.col}`
    if (!map.has(key)) map.set(key, clue.num)
  }
  return map
}

function buildHomePreviewGrid(puzzle: PuzzlePayload): GridData {
  const nm = buildNumberMap(puzzle)
  return puzzle.grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell === '#') return null
      const num = nm.get(`${r},${c}`)
      return {
        letter: '',
        ...(num !== undefined ? { number: num } : {}),
      }
    })
  )
}

function displayEditorialTitle(title: string | null): string {
  if (!title || /^Puzzle\s+#\d+$/i.test(title.trim())) return "Today's Puzzle"
  return title
}

export default function HomeScreen({ puzzle }: { puzzle: PuzzlePayload }) {
  const router = useRouter()
  const [streak, setStreak] = useState(0)

  const previewGrid = useMemo(() => buildHomePreviewGrid(puzzle), [puzzle])

  useEffect(() => {
    setStreak(getMockStats(getTodaySolve(puzzle.publish_date), puzzle.publish_date).streak)
  }, [puzzle.publish_date])

  useEffect(() => {
    if (getTodaySolve(puzzle.publish_date)?.completed) {
      router.replace('/waiting')
    }
  }, [puzzle.publish_date, router])

  const dateLine = `${formatMetaDateLine(puzzle.publish_date)} · ${formatPuzzleNumber(getPuzzleNumber(puzzle.publish_date))}`

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <AppHeader streak={streak} />

        <div style={{ padding: '48px 28px 40px', textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 36,
              fontWeight: 900,
              color: theme.text,
              margin: '0 0 16px',
              lineHeight: 1.05,
              letterSpacing: -0.5,
            }}
          >
            {displayEditorialTitle(puzzle.title)}
          </h1>

          <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 32 }}>{dateLine}</div>

          <div style={{ marginBottom: 40 }}>
            <GridDisplay data={previewGrid} size={140} />
          </div>

          <Link
            href="/solve"
            style={{
              display: 'inline-block',
              background: theme.hero,
              color: theme.heroOnDark,
              border: 'none',
              padding: '16px 56px',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 3,
              borderRadius: 4,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            BEGIN
          </Link>

          <button
            type="button"
            onClick={() => router.push('/howto')}
            style={{
              display: 'block',
              margin: '20px auto 0',
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: theme.text,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: 'uppercase',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            How to play
          </button>
        </div>
      </div>
    </div>
  )
}
