import { MIN_WORD_LEN } from '@/lib/solver/constants'
import type { Slot } from '@/lib/solver/types'

export function shapeDims(pattern: string[]): { h: number; w: number } {
  return { h: pattern.length, w: pattern[0]?.length ?? 0 }
}

export function isLetterCell(pattern: string[], r: number, c: number): boolean {
  const { h, w } = shapeDims(pattern)
  return r >= 0 && r < h && c >= 0 && c < w && pattern[r]![c] === '.'
}

export function extractSlots(pattern: string[]): Slot[] {
  const { h, w } = shapeDims(pattern)
  const slots: Slot[] = []
  let sid = 0
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!isLetterCell(pattern, r, c)) continue
      if (!isLetterCell(pattern, r, c - 1) && isLetterCell(pattern, r, c + 1)) {
        const cells: [number, number][] = []
        let cc = c
        while (isLetterCell(pattern, r, cc)) {
          cells.push([r, cc])
          cc += 1
        }
        if (cells.length >= MIN_WORD_LEN) {
          slots.push({
            slot_id: sid,
            direction: 'A',
            row: r,
            col: c,
            length: cells.length,
            cells,
          })
          sid += 1
        }
      }
      if (!isLetterCell(pattern, r - 1, c) && isLetterCell(pattern, r + 1, c)) {
        const cells: [number, number][] = []
        let rr = r
        while (isLetterCell(pattern, rr, c)) {
          cells.push([rr, c])
          rr += 1
        }
        if (cells.length >= MIN_WORD_LEN) {
          slots.push({
            slot_id: sid,
            direction: 'D',
            row: r,
            col: c,
            length: cells.length,
            cells,
          })
          sid += 1
        }
      }
    }
  }
  return slots
}
