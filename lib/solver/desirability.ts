import { ANCHOR_TYPES, LOW_VALUE_TYPES } from '@/lib/solver/constants'
import type { GlossaryEntry } from '@/lib/solver/types'

export function scoreDesirability(entry: GlossaryEntry): number {
  let score = 0
  const L = entry.word.length
  if (L >= 8) score += 8.0
  else if (L === 7) score += 7.0
  else if (L === 6) score += 6.0
  else if (L === 5) score += 4.0
  else if (L === 4) score += 2.0

  if (ANCHOR_TYPES.has(entry.entry_type)) score += 2.0
  else if (LOW_VALUE_TYPES.has(entry.entry_type)) score -= 3.0

  if (entry.sport === 'general') score -= 0.5

  if (entry.entry_type === 'nickname' && L <= 3) score -= 1.5

  return score
}

export function indexByLength(entries: GlossaryEntry[]): Map<number, GlossaryEntry[]> {
  const out = new Map<number, GlossaryEntry[]>()
  for (const e of entries) {
    const L = e.word.length
    if (!out.has(L)) out.set(L, [])
    out.get(L)!.push(e)
  }
  for (const bucket of out.values()) {
    bucket.sort((a, b) => b.desirability - a.desirability)
  }
  return out
}
