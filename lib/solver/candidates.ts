import { extractSlots, shapeDims } from '@/lib/solver/extract-slots'
import { scoreCandidate } from '@/lib/solver/score'
import type { GlossaryEntry, Slot } from '@/lib/solver/types'

function directionDb(d: Slot['direction']): 'across' | 'down' {
  return d === 'A' ? 'across' : 'down'
}

export function buildCandidatePayload(
  pattern: string[],
  fill: GlossaryEntry[],
  shapeId: string,
  shapeName: string,
  generatorRun: string,
): Record<string, unknown> {
  const slots = extractSlots(pattern)
  const cellNumber = new Map<string, number>()
  let nextNum = 1
  for (const s of slots) {
    const key = `${s.row},${s.col}`
    if (!cellNumber.has(key)) {
      cellNumber.set(key, nextNum)
      nextNum += 1
    }
  }

  const clues = slots.map((s, idx) => {
    const entry = fill[idx]!
    return {
      word: entry.word,
      clue_text: entry.clue,
      row: s.row,
      col: s.col,
      direction: directionDb(s.direction),
      number: cellNumber.get(`${s.row},${s.col}`)!,
      glossary_id: entry.id,
    }
  })

  const sportBreakdown: Record<string, number> = {}
  for (const e of fill) {
    sportBreakdown[e.sport] = (sportBreakdown[e.sport] ?? 0) + 1
  }

  const { h, w } = shapeDims(pattern)
  return {
    shape_id: shapeId,
    grid: { pattern },
    width: w,
    height: h,
    clues,
    quality_score: scoreCandidate(fill, pattern),
    sport_breakdown: sportBreakdown,
    generator_run: generatorRun,
    shape_name: shapeName,
    status: 'pending',
  }
}
