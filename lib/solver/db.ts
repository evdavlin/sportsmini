import type { SupabaseClient } from '@supabase/supabase-js'

import type { GlossaryEntry } from '@/lib/solver/types'

const GLOSSARY_WORD_RE = /^[A-Z0-9]+$/

export async function loadGlossaryPaginated(supabase: SupabaseClient): Promise<GlossaryEntry[]> {
  const all: GlossaryEntry[] = []
  const pageSize = 1000
  let offset = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from('crossword_glossary')
      .select('id,word,clue,sport,type')
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = rows ?? []
    for (const row of batch) {
      const word = String(row.word ?? '')
        .trim()
        .toUpperCase()
      if (!word || !GLOSSARY_WORD_RE.test(word)) continue
      all.push({
        id: String(row.id),
        word,
        clue: String(row.clue ?? ''),
        sport: String(row.sport ?? 'general'),
        entry_type: String(row.type ?? 'other'),
        desirability: 0,
      })
    }
    if (batch.length < pageSize) break
    offset += pageSize
  }
  return all
}

export type LoadedShape = {
  id: string
  title: string
  pattern: string[]
}

function parseShapeRow(row: Record<string, unknown>): LoadedShape {
  const title = String(row.title ?? '').trim() || 'Untitled shape'
  const grid = row.grid
  if (!grid || typeof grid !== 'object') {
    throw new Error(`Puzzle ${row.id}: grid is missing or not an object`)
  }
  const pat = (grid as { pattern?: unknown }).pattern
  if (!Array.isArray(pat) || pat.length === 0) {
    throw new Error(`Puzzle ${row.id}: grid.pattern missing or empty`)
  }
  if (!pat.every((line) => typeof line === 'string')) {
    throw new Error(`Puzzle ${row.id}: grid.pattern must be a list of strings`)
  }
  return { id: String(row.id), title, pattern: pat as string[] }
}

export async function loadShapeTemplate(
  supabase: SupabaseClient,
  shapeId: string | undefined,
  wallDeadline: number,
): Promise<LoadedShape> {
  if (Date.now() > wallDeadline) {
    throw new Error('Wall deadline exceeded before shape load')
  }

  if (shapeId) {
    const { data: row, error } = await supabase
      .from('puzzles')
      .select('id, title, grid, width, height')
      .eq('id', shapeId)
      .eq('status', 'shape_template')
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) {
      throw new Error(`No active shape_template puzzle found for id=${shapeId}`)
    }
    return parseShapeRow(row as Record<string, unknown>)
  }

  const { data, error } = await supabase.rpc('pick_random_shape_template')
  if (error) throw new Error(error.message)

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    throw new Error("No rows returned from pick_random_shape_template (empty pool?)")
  }
  return parseShapeRow(row as Record<string, unknown>)
}
