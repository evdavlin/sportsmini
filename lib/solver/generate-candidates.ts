import type { SupabaseClient } from '@supabase/supabase-js'

import { buildCandidatePayload } from '@/lib/solver/candidates'
import { FILLS_PER_SHAPE } from '@/lib/solver/constants'
import { indexByLength, scoreDesirability } from '@/lib/solver/desirability'
import { loadGlossaryPaginated, loadShapeTemplate } from '@/lib/solver/db'
import { scoreCandidate } from '@/lib/solver/score'
import { attemptFillMulti } from '@/lib/solver/solver'
import type { GenerateCandidatesInput, GenerateResult } from '@/lib/solver/types'

export async function generateCandidates(
  supabase: SupabaseClient,
  input: GenerateCandidatesInput,
): Promise<GenerateResult> {
  const wallDeadline = Date.now() + input.wallDeadlineMs
  const generatorRun = new Date().toISOString()

  try {
    const glossary = await loadGlossaryPaginated(supabase)
    for (const e of glossary) {
      e.desirability = scoreDesirability(e)
      if (input.preferSport && e.sport === input.preferSport) {
        e.desirability += 2.0
      }
    }
    const byLength = indexByLength(glossary)

    const shape = await loadShapeTemplate(supabase, input.shapeId, wallDeadline)
    const pattern = shape.pattern

    const targetFills = input.count * 3
    const { fills } = attemptFillMulti(
      pattern,
      byLength,
      input.solverTimeBudgetSec,
      FILLS_PER_SHAPE,
      wallDeadline,
    )

    const scored = fills.map((f) => ({ score: scoreCandidate(f, pattern), fill: f }))
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, input.count)

    const payloads = top.map(({ fill }) =>
      buildCandidatePayload(pattern, fill, shape.id, shape.title, generatorRun),
    )

    let written = 0
    if (payloads.length > 0) {
      const { data, error } = await supabase.from('puzzle_candidates').insert(payloads).select()
      if (error) throw new Error(error.message)
      written = data?.length ?? 0
    }

    const best = top[0]
    return {
      success: true,
      generator_run: generatorRun,
      candidate_count: written,
      top_score: best ? best.score : null,
      top_words: best ? best.fill.map((e) => e.word) : null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return {
      success: false,
      generator_run: generatorRun,
      candidate_count: 0,
      top_score: null,
      top_words: null,
      error: message,
    }
  }
}
