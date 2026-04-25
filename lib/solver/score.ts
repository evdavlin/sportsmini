import {
  ANCHOR_TYPES,
  LOW_VALUE_TYPES,
  SCORE_WEIGHTS,
} from '@/lib/solver/constants'
import { shapeDims } from '@/lib/solver/extract-slots'
import type { GlossaryEntry } from '@/lib/solver/types'

export function scoreCandidate(fill: GlossaryEntry[], pattern: string[]): number {
  let total = 0
  const sports = new Map<string, number>()
  for (const e of fill) {
    sports.set(e.sport, (sports.get(e.sport) ?? 0) + 1)
  }
  const n = fill.length

  let lowValueCount = 0
  let hasLongAnchor = false

  for (const e of fill) {
    const L = e.word.length
    if (L === 3) total += SCORE_WEIGHTS.short_word_penalty
    else if (L === 5) total += SCORE_WEIGHTS.five_letter_bonus
    else if (L === 6 || L === 7) {
      total += SCORE_WEIGHTS.six_plus_bonus
      hasLongAnchor = true
    } else if (L >= 8) {
      total += SCORE_WEIGHTS.eight_plus_bonus
      hasLongAnchor = true
    }

    if (LOW_VALUE_TYPES.has(e.entry_type)) {
      total += SCORE_WEIGHTS.low_value_type_penalty
      lowValueCount += 1
    } else if (ANCHOR_TYPES.has(e.entry_type)) {
      total += SCORE_WEIGHTS.anchor_type_bonus
    }

    if (e.sport === 'general') total += SCORE_WEIGHTS.generic_sport_penalty
  }

  if (n > 0 && lowValueCount / n > 0.4) {
    total += SCORE_WEIGHTS.abbreviation_heavy_fill
  }

  if (hasLongAnchor) {
    total += SCORE_WEIGHTS.has_long_anchor_bonus
  }

  total += SCORE_WEIGHTS.sport_variety_bonus * sports.size

  const { h, w } = shapeDims(pattern)
  const totalCells = h * w
  const blackCells = pattern.reduce((acc, row) => acc + (row.match(/#/g)?.length ?? 0), 0)
  const blackPct = totalCells ? (blackCells / totalCells) * 100 : 0
  if (blackPct > 25) {
    total += SCORE_WEIGHTS.black_square_penalty_per_pct_over_25 * (blackPct - 25)
  }

  return Math.round(total * 100) / 100
}
