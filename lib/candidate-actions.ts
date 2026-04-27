'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { supabaseService } from '@/lib/supabase-service'

type CandidateClue = {
  word: string
  clue_text: string
  row: number
  col: number
  direction: 'across' | 'down'
  number: number
}

function extractPuzzleId(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string') return data
  if (typeof data === 'object' && data !== null && 'puzzle_id' in data) {
    const id = (data as { puzzle_id?: unknown }).puzzle_id
    if (id != null) return String(id)
  }
  return null
}

function parseClues(raw: unknown): CandidateClue[] | null {
  if (!Array.isArray(raw)) return null
  const out: CandidateClue[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') return null
    const o = c as Record<string, unknown>
    if (
      typeof o.word !== 'string' ||
      typeof o.clue_text !== 'string' ||
      typeof o.row !== 'number' ||
      typeof o.col !== 'number' ||
      (o.direction !== 'across' && o.direction !== 'down') ||
      typeof o.number !== 'number'
    ) {
      return null
    }
    out.push({
      word: o.word,
      clue_text: o.clue_text,
      row: o.row,
      col: o.col,
      direction: o.direction,
      number: o.number,
    })
  }
  return out
}

function firstLongWord(clues: CandidateClue[]): string {
  if (!clues.length) return 'PUZZLE'
  let best = clues[0]!.word
  for (const c of clues) {
    if (c.word.length > best.length) best = c.word
  }
  return best || 'PUZZLE'
}

function formatScore(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

export async function promoteCandidateAction(
  candidateId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: loadErr } = await supabaseService
    .from('puzzle_candidates')
    .select(
      'id, status, shape_id, shape_name, width, height, grid, clues, quality_score, generator_run',
    )
    .eq('id', candidateId)
    .maybeSingle()

  if (loadErr) return { ok: false, error: loadErr.message }
  if (!row) return { ok: false, error: 'Candidate not found' }
  if ((row as { status: string }).status !== 'pending') {
    return { ok: false, error: 'Only pending candidates can be promoted' }
  }

  const clues = parseClues((row as { clues: unknown }).clues)
  if (!clues?.length) return { ok: false, error: 'Candidate has no valid clues' }

  const grid = (row as { grid: unknown }).grid
  if (!grid || typeof grid !== 'object' || !('pattern' in (grid as object))) {
    return { ok: false, error: 'Invalid grid on candidate' }
  }

  const width = Number((row as { width: number }).width)
  const height = Number((row as { height: number }).height)
  if (!width || !height) return { ok: false, error: 'Invalid dimensions' }

  const shapeId = String((row as { shape_id: string }).shape_id)
  const { count: promotedN, error: countErr } = await supabaseService
    .from('puzzle_candidates')
    .select('*', { count: 'exact', head: true })
    .eq('shape_id', shapeId)
    .eq('status', 'promoted')

  if (countErr) return { ok: false, error: countErr.message }
  const n = (promotedN ?? 0) + 1

  const { data: shapeRow } = await supabaseService
    .from('puzzles')
    .select('title')
    .eq('id', shapeId)
    .maybeSingle()
  const shapeNameFromPuzzle = (shapeRow as { title: string | null } | null)?.title
  const baseName =
    (shapeNameFromPuzzle && shapeNameFromPuzzle.trim()) ||
    String((row as { shape_name: string | null }).shape_name || 'Shape').trim() ||
    'Shape'

  const longWord = firstLongWord(clues)
  const scoreN = Number((row as { quality_score: number }).quality_score)
  const title = `${baseName} #${n}: ${longWord} (${formatScore(scoreN)})`

  const p_payload = {
    title,
    difficulty: 1,
    width,
    height,
    grid,
    clues: clues.map((c) => ({
      number: c.number,
      direction: c.direction,
      row: c.row,
      col: c.col,
      word: c.word,
      clue_text: c.clue_text,
    })),
  }

  const { data, error: rpcErr } = await supabaseService.rpc('create_draft_with_glossary', {
    p_payload,
  })

  if (rpcErr) return { ok: false, error: rpcErr.message }

  const newPuzzleId = extractPuzzleId(data)
  if (!newPuzzleId) {
    return { ok: false, error: 'Draft was not created — check create_draft_with_glossary response' }
  }

  const { error: upErr } = await supabaseService
    .from('puzzle_candidates')
    .update({
      status: 'promoted',
      promoted_puzzle_id: newPuzzleId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', candidateId)

  if (upErr) {
    return { ok: false, error: `Draft created but failed to mark candidate: ${upErr.message}` }
  }

  revalidatePath('/admin/candidates')
  revalidatePath('/admin/drafts')
  revalidatePath('/admin')
  revalidatePath('/admin/builder')
  redirect(`/admin/builder?id=${newPuzzleId}`)
}

export async function rejectCandidateAction(
  candidateId: string,
  notes?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseService
    .from('puzzle_candidates')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      review_notes: notes?.trim() || null,
    })
    .eq('id', candidateId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/candidates')
  return { ok: true }
}

export async function purgeRunAction(
  generatorRun: string
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  if (!generatorRun.trim()) return { ok: false, error: 'Missing run id' }

  const { data, error } = await supabaseService
    .from('puzzle_candidates')
    .delete()
    .eq('generator_run', generatorRun)
    .eq('status', 'pending')
    .select('id')

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/candidates')
  return { ok: true, deleted: (data as { id: string }[] | null)?.length ?? 0 }
}
