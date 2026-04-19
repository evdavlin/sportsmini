import type { GlossaryEntry, GridType } from '@/lib/crossword'
import { supabaseService } from '@/lib/supabase-service'

export type PuzzleRow = {
  id: string
  title: string | null
  difficulty: number | null
  width: number
  height: number
  grid: unknown
  status: string
}

export type PuzzleClueRow = {
  number: number
  row: number
  col: number
  direction: string
  word: string
  clue_text: string
}

function computeDaysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export async function loadGlossary(): Promise<GlossaryEntry[]> {
  const { data, error } = await supabaseService
    .from('crossword_glossary')
    .select('id, word, clue, sport, type, team, length, last_used_at, last_used_in_puzzle_id')
    .order('word', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const lastUsedAt = (row.last_used_at as string | null) ?? null
    return {
      id: String(row.id),
      word: String(row.word ?? ''),
      clue: String(row.clue ?? ''),
      sport: String(row.sport ?? ''),
      type: String(row.type ?? ''),
      team: row.team != null ? String(row.team) : null,
      length: Number(row.length ?? 0),
      lastUsedAt,
      daysSinceUse: computeDaysSince(lastUsedAt),
    }
  })
}

export async function loadDraftForEditing(
  id: string
): Promise<{ puzzle: PuzzleRow; clues: PuzzleClueRow[] } | null> {
  const { data: puzzle, error } = await supabaseService
    .from('puzzles')
    .select('id, title, difficulty, width, height, grid, status')
    .eq('id', id)
    .maybeSingle()

  if (error || !puzzle) return null
  if ((puzzle as { status: string }).status !== 'draft') return null

  const { data: clues, error: cluesErr } = await supabaseService
    .from('puzzle_clues')
    .select('number, row, col, direction, word, clue_text')
    .eq('puzzle_id', id)
    .order('number', { ascending: true })

  if (cluesErr) throw new Error(cluesErr.message)

  return {
    puzzle: puzzle as PuzzleRow,
    clues: (clues ?? []) as PuzzleClueRow[],
  }
}

/** Reconstruct letter grid from persisted pattern + clue placements. */
export function gridFromDraft(pattern: string[], clues: PuzzleClueRow[]): GridType {
  const h = pattern.length
  const w = pattern[0]?.length ?? 0
  const grid: GridType = Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => {
      const ch = pattern[r]?.[c]
      return ch === '#' ? null : ''
    })
  )

  for (const clue of clues) {
    const letters = clue.word.toUpperCase().split('')
    const dir = clue.direction === 'across' ? 'across' : 'down'
    for (let i = 0; i < letters.length; i++) {
      const r = dir === 'across' ? clue.row : clue.row + i
      const c = dir === 'across' ? clue.col + i : clue.col
      if (grid[r]?.[c] !== undefined && grid[r][c] !== null) {
        grid[r][c] = letters[i]!
      }
    }
  }

  return grid
}

export function cluesToSlotMap(clues: PuzzleClueRow[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of clues) {
    const dir = c.direction === 'across' || c.direction === 'down' ? c.direction : 'across'
    m.set(`${c.number}-${dir}`, c.clue_text)
  }
  return m
}
