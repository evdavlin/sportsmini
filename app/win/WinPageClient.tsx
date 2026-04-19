'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CompletionScreen from '@/app/components/CompletionScreen'
import type { PuzzlePayload } from '@/lib/puzzles'
import type { SolveState } from '@/lib/progress'
import { getTodaySolve } from '@/lib/progress'

export default function WinPageClient({ puzzle }: { puzzle: PuzzlePayload }) {
  const router = useRouter()
  const [solveState, setSolveState] = useState<SolveState | null>(null)

  useEffect(() => {
    const s = getTodaySolve(puzzle.publish_date)
    if (!s?.completed) {
      router.replace('/')
      return
    }
    setSolveState(s)
  }, [puzzle.publish_date, router])

  if (!solveState) return null

  return <CompletionScreen puzzle={puzzle} solveState={solveState} />
}
