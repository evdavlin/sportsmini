/** Glossary row used by the fill solver (matches Python GlossaryEntry). */
export type GlossaryEntry = {
  id: string
  word: string
  clue: string
  sport: string
  entry_type: string
  desirability: number
}

/** Internal slot direction matches Python: 'A' | 'D' */
export type Slot = {
  slot_id: number
  direction: 'A' | 'D'
  row: number
  col: number
  length: number
  cells: ReadonlyArray<readonly [number, number]>
}

export type GenerateCandidatesInput = {
  shapeId?: string
  count: number
  preferSport?: string
  wallDeadlineMs: number
  solverTimeBudgetSec: number
}

/** Public return type for POST /api/generate-candidates */
export type GenerateResult = {
  success: boolean
  generator_run: string
  candidate_count: number
  top_score: number | null
  top_words: string[] | null
  error?: string
}
