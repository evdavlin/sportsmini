import { extractSlots } from '@/lib/solver/extract-slots'
import type { GlossaryEntry, Slot } from '@/lib/solver/types'

type CellKey = `${number},${number}`

function cellKey(r: number, c: number): CellKey {
  return `${r},${c}`
}

/**
 * Matches scripts/generate_puzzles.py MultiFillSolver (MRV, backtrack, deepest_slot).
 * Not exported from lib/solver public API.
 */
export class MultiFillSolver {
  readonly slots: Slot[]
  readonly byLength: Map<number, GlossaryEntry[]>
  readonly deadline: number
  readonly maxFills: number
  readonly fills: GlossaryEntry[][] = []

  readonly assignment = new Map<number, GlossaryEntry>()
  readonly gridLetters = new Map<CellKey, string>()

  deepestRemaining: number
  deepestSlot: Slot | null = null

  constructor(
    slots: Slot[],
    byLength: Map<number, GlossaryEntry[]>,
    timeBudgetSec: number,
    maxFills: number,
    wallDeadline?: number,
  ) {
    this.slots = slots
    this.byLength = byLength
    const wall = wallDeadline ?? Number.POSITIVE_INFINITY
    this.deadline = Math.min(Date.now() + timeBudgetSec * 1000, wall)
    this.maxFills = maxFills
    this.deepestRemaining = slots.length
  }

  candidatesFor(slot: Slot): GlossaryEntry[] {
    const pool = this.byLength.get(slot.length) ?? []
    const constraints: [number, string][] = []
    for (let i = 0; i < slot.cells.length; i++) {
      const [r, c] = slot.cells[i]!
      const k = cellKey(r, c)
      const ch = this.gridLetters.get(k)
      if (ch !== undefined) constraints.push([i, ch])
    }
    if (constraints.length === 0) return pool
    return pool.filter((e) => constraints.every(([i, ch]) => e.word[i] === ch))
  }

  pickNextSlot(remaining: Slot[]): Slot {
    let best: Slot | null = null
    let bestCount: number | null = null
    for (const s of remaining) {
      const count = this.candidatesFor(s).length
      if (best === null || count < (bestCount as number)) {
        best = s
        bestCount = count
      }
    }
    return best!
  }

  backtrack(remaining: Slot[]): void {
    if (this.fills.length >= this.maxFills) return
    if (Date.now() > this.deadline) return
    if (remaining.length === 0) {
      this.fills.push(this.slots.map((s) => this.assignment.get(s.slot_id)!))
      return
    }

    if (remaining.length < this.deepestRemaining) {
      this.deepestRemaining = remaining.length
      this.deepestSlot = null
    }

    const slot = this.pickNextSlot(remaining)
    const candidates = this.candidatesFor(slot)

    if (candidates.length === 0 && this.deepestSlot === null) {
      this.deepestSlot = slot
    }

    const usedWords = new Set<string>()
    for (const e of this.assignment.values()) {
      usedWords.add(e.word)
    }

    for (const entry of candidates) {
      if (usedWords.has(entry.word)) continue
      const placedCells: [number, number][] = []
      let conflict = false
      for (let i = 0; i < slot.cells.length; i++) {
        const letter = entry.word[i]!
        const [r, c] = slot.cells[i]!
        const k = cellKey(r, c)
        const existing = this.gridLetters.get(k)
        if (existing !== undefined) {
          if (existing !== letter) {
            conflict = true
            break
          }
        } else {
          this.gridLetters.set(k, letter)
          placedCells.push([r, c])
        }
      }
      if (!conflict) {
        this.assignment.set(slot.slot_id, entry)
        const rest = remaining.filter((s) => s.slot_id !== slot.slot_id)
        this.backtrack(rest)
        this.assignment.delete(slot.slot_id)
        if (this.fills.length >= this.maxFills) {
          for (const rc of placedCells) {
            this.gridLetters.delete(cellKey(rc[0], rc[1]))
          }
          return
        }
      }
      for (const rc of placedCells) {
        this.gridLetters.delete(cellKey(rc[0], rc[1]))
      }
    }
  }
}

export function attemptFillMulti(
  pattern: string[],
  byLength: Map<number, GlossaryEntry[]>,
  timeBudgetSec: number,
  maxFills: number,
  wallDeadline?: number,
): { fills: GlossaryEntry[][]; deepestSlot: Slot | null } {
  const slots = extractSlots(pattern)
  if (slots.length === 0) return { fills: [], deepestSlot: null }
  const solver = new MultiFillSolver(slots, byLength, timeBudgetSec, maxFills, wallDeadline)
  solver.backtrack(slots)
  return { fills: solver.fills, deepestSlot: solver.deepestSlot }
}
