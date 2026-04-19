'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PuzzleClue, PuzzlePayload } from '@/lib/puzzles'
import { formatPuzzleNumber, getPuzzleNumber } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { getDeviceId, touchDevice } from '@/lib/device'
import {
  addHintedCell,
  getTodaySolve,
  savePreviewSolve,
  saveTodaySolve,
  clearPreviewSolve,
} from '@/lib/progress'
import { getMockStats } from '@/lib/mock-stats'
import {
  AppHeader,
  ChevronIcon,
  GridDisplay,
  formatElapsed,
  formatPublishDateCompact,
  theme,
  type GridData,
} from './theme'

function formatPuzzleMeta(puzzle: PuzzlePayload): string {
  return `${formatPuzzleNumber(getPuzzleNumber(puzzle.publish_date))} · ${formatPublishDateCompact(puzzle.publish_date)}`
}

function buildNumberMap(puzzle: PuzzlePayload): Map<string, number> {
  const map = new Map<string, number>()
  for (const clue of [...puzzle.across, ...puzzle.down]) {
    const key = `${clue.row},${clue.col}`
    if (!map.has(key)) map.set(key, clue.num)
  }
  return map
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`
}

function getCellsForClue(clue: PuzzleClue, dir: 'across' | 'down'): string[] {
  const cells: string[] = []
  const len = clue.answer.length
  for (let i = 0; i < len; i++) {
    const r = dir === 'across' ? clue.row : clue.row + i
    const c = dir === 'across' ? clue.col + i : clue.col
    cells.push(cellKey(r, c))
  }
  return cells
}

type SolveScreenProps = {
  puzzle: PuzzlePayload
  /** Admin preview — no redirects, DB writes, or daily localStorage key */
  previewMode?: boolean
  previewTitle?: string | null
  previewStatus?: string | null
  /** Hide built-in preview chrome when the route renders an external sticky banner */
  suppressPreviewBanner?: boolean
  /** Fires once when preview solve completes (previewMode only) */
  onPreviewSolveComplete?: (elapsedSeconds: number) => void
}

export default function SolveScreen({
  puzzle,
  previewMode = false,
  previewTitle,
  previewStatus,
  suppressPreviewBanner = false,
  onPreviewSolveComplete,
}: SolveScreenProps) {
  const router = useRouter()
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [direction, setDirection] = useState<'across' | 'down'>('across')
  const [entered, setEntered] = useState<Record<string, string>>({})
  const [wrongCells, setWrongCells] = useState<Set<string>>(() => new Set())
  const [status, setStatus] = useState<
    null | 'partial-correct' | 'some-wrong' | 'revealed' | 'solved'
  >(null)
  const [partialUnfilled, setPartialUnfilled] = useState<number | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [streak, setStreak] = useState(0)
  const [previewDoneSeconds, setPreviewDoneSeconds] = useState<number | null>(null)

  const sessionStartedRef = useRef(false)
  const sessionStartingRef = useRef(false)
  const deviceIdRef = useRef<string | null>(null)
  const previewModeRef = useRef(previewMode)
  const maybeStartSessionRef = useRef<(() => Promise<void>) | null>(null)
  previewModeRef.current = previewMode

  const puzzleRef = useRef(puzzle)
  puzzleRef.current = puzzle

  const stateRef = useRef({
    selectedCell,
    direction,
    entered,
    wrongCells,
    status,
  })
  stateRef.current = { selectedCell, direction, entered, wrongCells, status }

  const completionRef = useRef(false)
  const hintsUsedRef = useRef(0)
  const hintedCellsRef = useRef<string[]>([])
  const elapsedSecondsRef = useRef(0)

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds
  }, [elapsedSeconds])

  useEffect(() => {
    if (!previewMode) {
      setStreak(getMockStats(getTodaySolve(puzzle.publish_date), puzzle.publish_date).streak)
    }
  }, [puzzle.publish_date, previewMode])

  useEffect(() => {
    if (previewMode) return
    if (getTodaySolve(puzzle.publish_date)?.completed) {
      router.replace('/waiting')
    }
  }, [puzzle.publish_date, router, previewMode])

  const maybeStartSession = useCallback(async () => {
    if (previewMode || sessionStartedRef.current || sessionStartingRef.current) return
    sessionStartingRef.current = true
    try {
      const res = await getDeviceId()
      if (!res.ok) {
        setDeviceError('Could not register this device. Solve tracking may not save.')
        console.error('[solve] device ensure failed', res.error)
        sessionStartedRef.current = true
        return
      }
      deviceIdRef.current = res.deviceId
      await touchDevice(res.deviceId)
      try {
        const { error } = await supabase.from('solves').upsert(
          {
            puzzle_id: puzzle.puzzle_id,
            device_id: res.deviceId,
            started_at: new Date().toISOString(),
          },
          { onConflict: 'puzzle_id,device_id', ignoreDuplicates: true }
        )
        if (error) {
          console.error('[solve] solves upsert on session start', {
            puzzle_id: puzzle.puzzle_id,
            device_id: res.deviceId,
            error,
          })
        }
      } catch (e) {
        console.error('[solve] solves upsert exception on session start', e)
      }
      sessionStartedRef.current = true
    } finally {
      sessionStartingRef.current = false
    }
  }, [previewMode, puzzle.puzzle_id])

  maybeStartSessionRef.current = maybeStartSession

  const finalizeWin = useCallback(async () => {
    if (completionRef.current) return
    completionRef.current = true
    const st = stateRef.current.status
    const secs = elapsedSecondsRef.current

    if (previewModeRef.current) {
      savePreviewSolve(puzzle.puzzle_id, {
        completed: true,
        timeSeconds: secs,
        hintsUsed: hintsUsedRef.current,
        wasRevealed: st === 'revealed',
        hintedCells: [...hintedCellsRef.current],
        solvedAt: new Date().toISOString(),
      })
      setPreviewDoneSeconds(secs)
      onPreviewSolveComplete?.(secs)
      return
    }

    saveTodaySolve(puzzle.publish_date, {
      completed: true,
      timeSeconds: secs,
      hintsUsed: hintsUsedRef.current,
      wasRevealed: st === 'revealed',
      hintedCells: [...hintedCellsRef.current],
      solvedAt: new Date().toISOString(),
    })

    let did = deviceIdRef.current
    if (!did) {
      const res = await getDeviceId()
      if (res.ok) {
        did = res.deviceId
        deviceIdRef.current = did
      }
    }

    if (did) {
      try {
        const up = await supabase
          .from('solves')
          .update({
            solved_at: new Date().toISOString(),
            time_seconds: secs,
            hints_used: hintsUsedRef.current,
            was_revealed: st === 'revealed',
          })
          .eq('puzzle_id', puzzle.puzzle_id)
          .eq('device_id', did)
          .select('puzzle_id')

        if (up.error) throw up.error
        const rows = up.data?.length ?? 0
        if (rows === 0) {
          const ins = await supabase.from('solves').upsert(
            {
              puzzle_id: puzzle.puzzle_id,
              device_id: did,
              started_at: new Date().toISOString(),
              solved_at: new Date().toISOString(),
              time_seconds: secs,
              hints_used: hintsUsedRef.current,
              was_revealed: st === 'revealed',
            },
            { onConflict: 'puzzle_id,device_id' }
          )
          if (ins.error) {
            console.error('[solve] solves completion insert fallback', {
              puzzle_id: puzzle.puzzle_id,
              device_id: did,
              error: ins.error,
            })
          }
        }
      } catch (e) {
        console.error('[solve] solves completion update failed', {
          puzzle_id: puzzle.puzzle_id,
          device_id: did,
          error: e,
        })
      }
    } else {
      console.error('[solve] completion skipped — no device id', { puzzle_id: puzzle.puzzle_id })
    }

    if (!previewModeRef.current) router.push('/win')
  }, [onPreviewSolveComplete, puzzle.publish_date, puzzle.puzzle_id, router])

  const cellToClueMap = useMemo(() => {
    const map = new Map<string, { across?: PuzzleClue; down?: PuzzleClue }>()
    const place = (r: number, c: number, clue: PuzzleClue, dir: 'across' | 'down') => {
      const k = cellKey(r, c)
      const cur = map.get(k) ?? {}
      if (dir === 'across') cur.across = clue
      else cur.down = clue
      map.set(k, cur)
    }
    for (const clue of puzzle.across) {
      for (let i = 0; i < clue.answer.length; i++) {
        place(clue.row, clue.col + i, clue, 'across')
      }
    }
    for (const clue of puzzle.down) {
      for (let i = 0; i < clue.answer.length; i++) {
        place(clue.row + i, clue.col, clue, 'down')
      }
    }
    return map
  }, [puzzle])

  const clueOrder = useMemo(() => {
    const across = [...puzzle.across].sort((a, b) => a.num - b.num)
    const down = [...puzzle.down].sort((a, b) => a.num - b.num)
    return [...across, ...down]
  }, [puzzle])

  const metaCenter = formatPuzzleMeta(puzzle)

  const GRID_SIZE = 304

  const numberMap = useMemo(() => buildNumberMap(puzzle), [puzzle])

  const gridData: GridData = useMemo(() => {
    return puzzle.grid.map((row, r) =>
      row.map((cell, c) => {
        if (cell === '#') return null
        const k = cellKey(r, c)
        const n = numberMap.get(k)
        const letter = entered[k] ?? ''
        const wrong = wrongCells.has(k)
        const base: NonNullable<GridData[number][number]> = {
          letter,
          ...(n !== undefined ? { number: n } : {}),
          ...(wrong ? { wrong: true } : {}),
        }
        return base
      })
    )
  }, [puzzle.grid, entered, wrongCells, numberMap])

  const row1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
  const row2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L']
  const row3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M']

  const isBlackCell = (r: number, c: number) => puzzle.grid[r][c] === '#'
  const solutionLetter = (r: number, c: number) => puzzle.grid[r][c]

  const activeClue = useMemo(() => {
    if (!selectedCell) return null
    const key = cellKey(selectedCell.row, selectedCell.col)
    return cellToClueMap.get(key)?.[direction] ?? null
  }, [selectedCell, direction, cellToClueMap])

  const activeWordCells = useMemo(() => {
    if (!activeClue) return new Set<string>()
    return new Set(getCellsForClue(activeClue, direction))
  }, [activeClue, direction])

  const allFilled = useMemo(() => {
    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        if (isBlackCell(r, c)) continue
        const k = cellKey(r, c)
        if (!entered[k]) return false
      }
    }
    return true
  }, [puzzle, entered])

  const isSolved = useMemo(() => {
    if (!allFilled) return false
    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        if (isBlackCell(r, c)) continue
        const k = cellKey(r, c)
        if ((entered[k] ?? '') !== solutionLetter(r, c)) return false
      }
    }
    return true
  }, [allFilled, entered, puzzle])

  useEffect(() => {
    if (!startTime || status === 'revealed' || isSolved) return
    const tick = () =>
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startTime, status, isSolved])

  useEffect(() => {
    if (status === 'revealed') return
    if (isSolved) {
      setStatus('solved')
      return
    }
    setStatus((s) => (s === 'solved' ? null : s))
  }, [isSolved, status])

  useEffect(() => {
    if (typeof window === 'undefined') return
    console.log('[solve] isSolved / grid', {
      isSolved,
      allFilled,
      enteredKeyCount: Object.keys(entered).length,
      entered,
    })
  }, [isSolved, allFilled, entered])

  useEffect(() => {
    if (!isSolved) return
    void finalizeWin()
  }, [isSolved, finalizeWin])

  const touchStart = () => {
    setStartTime((st) => {
      if (!st && !previewMode) void maybeStartSession()
      return st ?? Date.now()
    })
  }

  const removeWrongKey = (set: Set<string>, key: string) => {
    if (!set.has(key)) return set
    const n = new Set(set)
    n.delete(key)
    return n
  }

  const handleCellClick = (r: number, c: number) => {
    if (isBlackCell(r, c)) return
    const clues = cellToClueMap.get(cellKey(r, c))
    touchStart()

    if (
      selectedCell?.row === r &&
      selectedCell?.col === c &&
      clues?.across &&
      clues?.down
    ) {
      setDirection((d) => (d === 'across' ? 'down' : 'across'))
      return
    }

    let nextDir = direction
    if (clues) {
      if (nextDir === 'across' && !clues.across && clues.down) nextDir = 'down'
      else if (nextDir === 'down' && !clues.down && clues.across) nextDir = 'across'
    }
    setDirection(nextDir)
    setSelectedCell({ row: r, col: c })
  }

  const findClueDirection = (clue: PuzzleClue): 'across' | 'down' =>
    puzzle.across.some((a) => a.num === clue.num && a.row === clue.row && a.col === clue.col)
      ? 'across'
      : 'down'

  const fallbackBarClue = puzzle.across[0] ?? puzzle.down[0]
  const displayClue = activeClue ?? fallbackBarClue
  const displayDirection: 'across' | 'down' = activeClue
    ? direction
    : fallbackBarClue
      ? findClueDirection(fallbackBarClue)
      : 'across'

  const goToClueIndex = (index: number) => {
    if (clueOrder.length === 0) return
    const i = ((index % clueOrder.length) + clueOrder.length) % clueOrder.length
    const clue = clueOrder[i]
    const dir = findClueDirection(clue)
    setDirection(dir)
    setSelectedCell({ row: clue.row, col: clue.col })
    touchStart()
  }

  const handlePrevClue = () => {
    if (!clueOrder.length) return
    const bar = displayClue
    if (!bar) return
    const idx = clueOrder.findIndex(
      (c) => c.num === bar.num && c.row === bar.row && c.col === bar.col
    )
    if (idx === -1) goToClueIndex(0)
    else goToClueIndex(idx - 1)
  }

  const handleNextClue = () => {
    if (!clueOrder.length) return
    const bar = displayClue
    if (!bar) return
    const idx = clueOrder.findIndex(
      (c) => c.num === bar.num && c.row === bar.row && c.col === bar.col
    )
    if (idx === -1) goToClueIndex(0)
    else goToClueIndex(idx + 1)
  }

  const moveHorizontal = useCallback((r: number, c: number, delta: -1 | 1) => {
    let nc = c + delta
    const p = puzzleRef.current
    while (nc >= 0 && nc < p.width) {
      if (p.grid[r][nc] !== '#') return { row: r, col: nc }
      nc += delta
    }
    return null
  }, [])

  const moveVertical = useCallback((r: number, c: number, delta: -1 | 1) => {
    let nr = r + delta
    const p = puzzleRef.current
    while (nr >= 0 && nr < p.height) {
      if (p.grid[nr][c] !== '#') return { row: nr, col: c }
      nr += delta
    }
    return null
  }, [])

  useEffect(() => {
    const bumpStart = () =>
      setStartTime((t) => {
        const next = t ?? Date.now()
        if (!t && !previewModeRef.current) void maybeStartSessionRef.current?.()
        return next
      })

    const onKey = (e: KeyboardEvent) => {
      const { selectedCell: sel, direction: dir, entered: ent, status: st } = stateRef.current

      const tryLetter = (ch: string) => {
        if (!sel) return false
        if (st === 'revealed') return false
        const clues = cellToClueMap.get(cellKey(sel.row, sel.col))
        const clue = clues?.[dir]
        if (!clue) return false
        const cells = getCellsForClue(clue, dir)
        const k = cellKey(sel.row, sel.col)
        const idx = cells.indexOf(k)
        if (idx === -1) return false

        bumpStart()
        e.preventDefault()
        const upper = ch.toUpperCase()
        setEntered((prev) => ({ ...prev, [k]: upper }))
        setWrongCells((w) => removeWrongKey(w, k))
        if (idx < cells.length - 1) {
          const [nr, nc] = cells[idx + 1].split(',').map(Number)
          setSelectedCell({ row: nr, col: nc })
        }
        return true
      }

      const tryBackspace = () => {
        if (!sel) return false
        if (st === 'revealed') return false
        const clues = cellToClueMap.get(cellKey(sel.row, sel.col))
        const clue = clues?.[dir]
        if (!clue) return false
        const cells = getCellsForClue(clue, dir)
        const k = cellKey(sel.row, sel.col)
        const idx = cells.indexOf(k)
        if (idx === -1) return false

        bumpStart()
        e.preventDefault()
        if (ent[k]) {
          setEntered((prev) => {
            const next = { ...prev }
            delete next[k]
            return next
          })
          setWrongCells((w) => removeWrongKey(w, k))
          return true
        }
        if (idx > 0) {
          const pk = cells[idx - 1]
          setEntered((prev) => {
            const next = { ...prev }
            delete next[pk]
            return next
          })
          setWrongCells((w) => removeWrongKey(w, pk))
          const [pr, pc] = pk.split(',').map(Number)
          setSelectedCell({ row: pr, col: pc })
        }
        return true
      }

      if (!sel) return

      if (e.key === 'Tab' || e.key === ' ') {
        const clues = cellToClueMap.get(cellKey(sel.row, sel.col))
        if (clues?.across && clues?.down) {
          e.preventDefault()
          bumpStart()
          setDirection((d) => (d === 'across' ? 'down' : 'across'))
        }
        return
      }

      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        tryLetter(e.key)
        return
      }

      if (e.key === 'Backspace') {
        tryBackspace()
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        bumpStart()
        setDirection('across')
        const next = moveHorizontal(sel.row, sel.col, -1)
        if (next) setSelectedCell(next)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        bumpStart()
        setDirection('across')
        const next = moveHorizontal(sel.row, sel.col, 1)
        if (next) setSelectedCell(next)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        bumpStart()
        setDirection('down')
        const next = moveVertical(sel.row, sel.col, -1)
        if (next) setSelectedCell(next)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        bumpStart()
        setDirection('down')
        const next = moveVertical(sel.row, sel.col, 1)
        if (next) setSelectedCell(next)
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cellToClueMap, moveHorizontal, moveVertical])

  function resetPreviewProgress() {
    clearPreviewSolve(puzzle.puzzle_id)
    setEntered({})
    setWrongCells(new Set())
    setStatus(null)
    setPreviewDoneSeconds(null)
    completionRef.current = false
    sessionStartedRef.current = false
    sessionStartingRef.current = false
    deviceIdRef.current = null
    setDeviceError(null)
    setPartialUnfilled(null)
    hintsUsedRef.current = 0
    hintedCellsRef.current = []
    setStartTime(null)
    setElapsedSeconds(0)
  }

  const runCheck = () => {
    touchStart()
    const nextWrong = new Set<string>()
    for (const [key, letter] of Object.entries(entered)) {
      const [r, c] = key.split(',').map(Number)
      if (r >= puzzle.height || c >= puzzle.width) continue
      if (puzzle.grid[r][c] === '#') continue
      if (letter !== solutionLetter(r, c)) nextWrong.add(key)
    }
    setWrongCells(nextWrong)

    let unfilled = 0
    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        if (puzzle.grid[r][c] === '#') continue
        const k = cellKey(r, c)
        if (!(entered[k] ?? '')) unfilled += 1
      }
    }

    const wrongCount = nextWrong.size
    const gridCompleteAndCorrect = unfilled === 0 && wrongCount === 0
    setPartialUnfilled(null)

    if (gridCompleteAndCorrect) {
      setStatus('solved')
      void finalizeWin()
      return
    }
    if (wrongCount > 0) {
      setPartialUnfilled(null)
      setStatus('some-wrong')
      return
    }
    setPartialUnfilled(unfilled)
    setStatus('partial-correct')
  }

  const runHintCell = () => {
    if (previewMode) return
    const sel = selectedCell
    if (!sel) return
    const { row: r, col: c } = sel
    if (isBlackCell(r, c)) return
    const k = cellKey(r, c)
    const hyphenKey = `${r}-${c}`
    if ((entered[k] ?? '') === solutionLetter(r, c)) return
    touchStart()
    hintsUsedRef.current += 1
    if (!hintedCellsRef.current.includes(hyphenKey)) hintedCellsRef.current.push(hyphenKey)
    addHintedCell(puzzle.publish_date, hyphenKey)
    setEntered((prev) => ({ ...prev, [k]: solutionLetter(r, c) }))
    setWrongCells((w) => removeWrongKey(w, k))
  }

  const runReveal = () => {
    touchStart()
    const next: Record<string, string> = {}
    const keys: string[] = []
    for (let r = 0; r < puzzle.height; r++) {
      for (let c = 0; c < puzzle.width; c++) {
        if (puzzle.grid[r][c] === '#') continue
        const k = cellKey(r, c)
        next[k] = solutionLetter(r, c)
        keys.push(`${r}-${c}`)
      }
    }
    hintsUsedRef.current = keys.length
    hintedCellsRef.current = keys
    for (const hk of keys) addHintedCell(puzzle.publish_date, hk)
    setEntered(next)
    setWrongCells(new Set())
    setStatus('revealed')
  }

  const runClear = () => {
    setEntered({})
    setWrongCells(new Set())
    setStatus(null)
    setPartialUnfilled(null)
  }

  const handleKeyboardLetter = (ch: string) => {
    const sel = stateRef.current.selectedCell
    const dir = stateRef.current.direction
    const st = stateRef.current.status
    if (!sel || st === 'revealed') return
    const clues = cellToClueMap.get(cellKey(sel.row, sel.col))
    const clue = clues?.[dir]
    if (!clue) return
    const cells = getCellsForClue(clue, dir)
    const k = cellKey(sel.row, sel.col)
    const idx = cells.indexOf(k)
    if (idx === -1) return
    touchStart()
    const upper = ch.toUpperCase()
    setEntered((prev) => ({ ...prev, [k]: upper }))
    setWrongCells((w) => removeWrongKey(w, k))
    if (idx < cells.length - 1) {
      const [nr, nc] = cells[idx + 1].split(',').map(Number)
      setSelectedCell({ row: nr, col: nc })
    }
  }

  const handleKeyboardBackspace = () => {
    const sel = stateRef.current.selectedCell
    const dir = stateRef.current.direction
    const ent = stateRef.current.entered
    const st = stateRef.current.status
    if (!sel || st === 'revealed') return
    const clues = cellToClueMap.get(cellKey(sel.row, sel.col))
    const clue = clues?.[dir]
    if (!clue) return
    const cells = getCellsForClue(clue, dir)
    const k = cellKey(sel.row, sel.col)
    const idx = cells.indexOf(k)
    if (idx === -1) return
    touchStart()
    if (ent[k]) {
      setEntered((prev) => {
        const next = { ...prev }
        delete next[k]
        return next
      })
      setWrongCells((w) => removeWrongKey(w, k))
      return
    }
    if (idx > 0) {
      const pk = cells[idx - 1]
      setEntered((prev) => {
        const next = { ...prev }
        delete next[pk]
        return next
      })
      setWrongCells((w) => removeWrongKey(w, pk))
      const [pr, pc] = pk.split(',').map(Number)
      setSelectedCell({ row: pr, col: pc })
    }
  }

  const statusLine = (() => {
    if (
      status === 'partial-correct' &&
      partialUnfilled != null &&
      partialUnfilled > 0
    ) {
      return {
        text: `Correct so far — ${partialUnfilled} ${partialUnfilled === 1 ? 'cell' : 'cells'} to go`,
        color: theme.success,
      }
    }
    if (status === 'some-wrong')
      return { text: `${wrongCells.size} WRONG`, color: theme.error }
    if (status === 'revealed') return { text: 'REVEALED', color: theme.textMuted }
    if (status === 'solved') return { text: 'SOLVED', color: theme.success }
    return { text: '', color: theme.text }
  })()

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: 'system-ui, sans-serif',
        paddingBottom: 12,
      }}
    >
      {previewMode && !suppressPreviewBanner ? (
        <div
          style={{
            padding: '12px 16px',
            background: theme.heroTint,
            borderBottom: `1px solid ${theme.borderSoft}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            maxWidth: 420,
            margin: '0 auto',
          }}
        >
          <span>
            <strong>PREVIEW MODE</strong>
            {' · '}
            {previewTitle ?? puzzle.title ?? 'Untitled'}
            {previewStatus ? (
              <span
                style={{
                  marginLeft: 8,
                  padding: '2px 8px',
                  background: theme.surface,
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {previewStatus}
              </span>
            ) : null}
          </span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={resetPreviewProgress}
              style={{
                padding: '6px 12px',
                border: `1px solid ${theme.text}`,
                background: 'transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Reset
            </button>
            <Link href="/admin" style={{ color: theme.hero, fontWeight: 600 }}>
              Back to admin
            </Link>
          </span>
          {previewDoneSeconds != null ? (
            <span style={{ width: '100%', fontWeight: 700, color: theme.hero }}>
              Completed in {formatElapsed(previewDoneSeconds)}
            </span>
          ) : null}
        </div>
      ) : null}
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <AppHeader
          streak={streak}
          showTimer
          timer={formatElapsed(elapsedSeconds)}
          puzzleMeta={metaCenter}
        />

        {deviceError && !previewMode ? (
          <div
            style={{
              margin: '0 12px 8px',
              padding: '10px 12px',
              backgroundColor: theme.heroTint,
              color: theme.text,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            {deviceError}
          </div>
        ) : null}

        <div style={{ padding: '6px 8px 6px' }}>
          <GridDisplay
            data={gridData}
            size={GRID_SIZE}
            selectedCell={selectedCell}
            activeWordSet={activeWordCells}
            wrongSet={wrongCells}
            onCellClick={handleCellClick}
          />
        </div>

        <div
          style={{
            minHeight: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            color: statusLine.color,
            marginTop: 6,
          }}
        >
          {statusLine.text}
        </div>

        {displayClue ? (
          <div
            style={{
              marginTop: 4,
              backgroundColor: theme.heroTint,
              borderTop: `1px solid ${theme.borderSoft}`,
              borderBottom: `1px solid ${theme.borderSoft}`,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxSizing: 'border-box',
            }}
          >
            <ChevronIcon direction="left" color={theme.text} onClick={handlePrevClue} />
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: theme.textMuted,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {displayClue.num} {displayDirection.toUpperCase()}
              </div>
              <div style={{ fontSize: 15, color: theme.text, lineHeight: 1.35, fontWeight: 500 }}>
                {displayClue.clue}
              </div>
            </div>
            <ChevronIcon direction="right" color={theme.text} onClick={handleNextClue} />
          </div>
        ) : null}

        <div style={{ padding: '6px 10px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {row1.map((k) => (
              <div
                key={k}
                role="button"
                tabIndex={0}
                onClick={() => handleKeyboardLetter(k)}
                style={{
                  flex: 1,
                  maxWidth: 40,
                  height: 38,
                  borderRadius: 6,
                  backgroundColor: theme.keyBg,
                  border: `1px solid ${theme.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: theme.text,
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
              >
                {k}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              justifyContent: 'center',
              paddingLeft: 16,
              paddingRight: 16,
              boxSizing: 'border-box',
            }}
          >
            {row2.map((k) => (
              <div
                key={k}
                role="button"
                tabIndex={0}
                onClick={() => handleKeyboardLetter(k)}
                style={{
                  flex: 1,
                  maxWidth: 40,
                  height: 38,
                  borderRadius: 6,
                  backgroundColor: theme.keyBg,
                  border: `1px solid ${theme.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: theme.text,
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
              >
                {k}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'stretch' }}>
            {row3.map((k) => (
              <div
                key={k}
                role="button"
                tabIndex={0}
                onClick={() => handleKeyboardLetter(k)}
                style={{
                  flex: 1,
                  maxWidth: 40,
                  height: 38,
                  borderRadius: 6,
                  backgroundColor: theme.keyBg,
                  border: `1px solid ${theme.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: theme.text,
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
              >
                {k}
              </div>
            ))}
            <div
              role="button"
              tabIndex={0}
              onClick={handleKeyboardBackspace}
              style={{
                flex: 1.5,
                maxWidth: 50,
                minWidth: 0,
                height: 38,
                borderRadius: 6,
                backgroundColor: theme.keyBg,
                border: `1px solid ${theme.borderSoft}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 600,
                color: theme.text,
                userSelect: 'none',
                cursor: 'pointer',
              }}
            >
              ⌫
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '4px 10px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={runCheck}
            style={{
              flex: 1,
              minWidth: 72,
              maxWidth: 100,
              minHeight: 38,
              background: 'transparent',
              border: `1px solid ${theme.text}`,
              color: theme.text,
              padding: '0 4px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              boxSizing: 'border-box',
            }}
          >
            CHECK
          </button>
          <button
            type="button"
            onClick={runHintCell}
            disabled={previewMode}
            style={{
              flex: 1,
              minWidth: 72,
              maxWidth: 100,
              minHeight: 38,
              background: 'transparent',
              border: `1px solid ${theme.text}`,
              color: theme.text,
              padding: '0 4px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 4,
              cursor: previewMode ? 'not-allowed' : 'pointer',
              opacity: previewMode ? 0.4 : 1,
              fontFamily: 'system-ui, sans-serif',
              boxSizing: 'border-box',
            }}
          >
            HINT
          </button>
          <button
            type="button"
            onClick={runReveal}
            style={{
              flex: 1,
              minWidth: 72,
              maxWidth: 100,
              minHeight: 38,
              background: 'transparent',
              border: `1px solid ${theme.text}`,
              color: theme.text,
              padding: '0 4px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              boxSizing: 'border-box',
            }}
          >
            REVEAL
          </button>
          <button
            type="button"
            onClick={runClear}
            style={{
              flex: 1,
              minWidth: 72,
              maxWidth: 100,
              minHeight: 38,
              background: 'transparent',
              border: `1px solid ${theme.text}`,
              color: theme.text,
              padding: '0 4px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              boxSizing: 'border-box',
            }}
          >
            CLEAR
          </button>
        </div>
      </div>
    </div>
  )
}
