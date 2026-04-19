'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminPuzzles } from '@/lib/admin'
import { parsePuzzleDsl } from '@/lib/dsl'
import { supabaseService } from '@/lib/supabase-service'

export async function reorderQueueAction(orderedIds: string[]) {
  const { error } = await supabaseService.rpc('queue_reorder', {
    p_ordered_ids: orderedIds,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/queue')
  revalidatePath('/admin')
}

async function moveQueuePuzzle(puzzleId: string, direction: 'up' | 'down') {
  const puzzles = await getAdminPuzzles({ status: ['queued'] })
  const ids = puzzles.map((p) => p.id)
  const idx = ids.indexOf(puzzleId)
  if (idx < 0) return
  const j = direction === 'up' ? idx - 1 : idx + 1
  if (j < 0 || j >= ids.length) return
  const next = [...ids]
  ;[next[idx], next[j]] = [next[j], next[idx]]
  await reorderQueueAction(next)
}

export async function queueMoveUp(puzzleId: string) {
  await moveQueuePuzzle(puzzleId, 'up')
}

export async function queueMoveDown(puzzleId: string) {
  await moveQueuePuzzle(puzzleId, 'down')
}

export async function queueRemoveAction(puzzleId: string) {
  const { error } = await supabaseService.rpc('queue_remove', {
    p_puzzle_id: puzzleId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/queue')
  revalidatePath('/admin')
}

export async function queueAddAction(puzzleId: string) {
  const { error } = await supabaseService.rpc('queue_add', {
    p_puzzle_id: puzzleId,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/drafts')
  revalidatePath('/admin/queue')
  revalidatePath('/admin')
}

export async function deleteDraftAction(puzzleId: string) {
  const { error } = await supabaseService.from('puzzles').delete().eq('id', puzzleId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/drafts')
  revalidatePath('/admin')
}

/**
 * Preview which clues match an existing `crossword_glossary` row (same word + clue text as DSL).
 */
export async function previewGlossaryMatchesForDslAction(dslText: string) {
  const { parsed, errors } = parsePuzzleDsl(dslText)
  if (!parsed || errors.length) {
    return { matches: [] as Array<{ direction: 'across' | 'down'; num: number; matched: boolean }> }
  }

  const matches: Array<{ direction: 'across' | 'down'; num: number; matched: boolean }> = []

  for (const c of parsed.across) {
    const { data } = await supabaseService
      .from('crossword_glossary')
      .select('id')
      .eq('word', c.word)
      .eq('clue', c.clue)
      .maybeSingle()
    matches.push({ direction: 'across', num: c.num, matched: !!data?.id })
  }
  for (const c of parsed.down) {
    const { data } = await supabaseService
      .from('crossword_glossary')
      .select('id')
      .eq('word', c.word)
      .eq('clue', c.clue)
      .maybeSingle()
    matches.push({ direction: 'down', num: c.num, matched: !!data?.id })
  }

  return { matches }
}

export async function createDraftFromDslAction(dslText: string) {
  const { parsed, errors } = parsePuzzleDsl(dslText)
  if (!parsed || errors.length) {
    throw new Error(errors.map((e) => e.message).join('; ') || 'Parse failed')
  }

  const height = parsed.gridPattern.length
  const width = parsed.gridPattern[0]?.length ?? 0

  const clues = [
    ...parsed.across.map((c) => ({
      number: c.num,
      direction: 'across' as const,
      row: c.row,
      col: c.col,
      word: c.word.toUpperCase(),
      clue_text: c.clue,
    })),
    ...parsed.down.map((c) => ({
      number: c.num,
      direction: 'down' as const,
      row: c.row,
      col: c.col,
      word: c.word.toUpperCase(),
      clue_text: c.clue,
    })),
  ]

  const p_payload = {
    title: parsed.title,
    difficulty: parsed.difficulty,
    width,
    height,
    grid: { pattern: parsed.gridPattern },
    clues,
  }

  const { data, error: rpcErr } = await supabaseService.rpc('create_draft_with_glossary', {
    p_payload,
  })

  if (rpcErr) {
    throw new Error(rpcErr.message)
  }

  const result = data as
    | { puzzle_id?: string; clue_count?: number; new_glossary_count?: number; linked_glossary_count?: number }
    | null
    | undefined

  const puzzleId =
    result && typeof result === 'object' && result.puzzle_id != null
      ? String(result.puzzle_id)
      : null

  if (!puzzleId) {
    throw new Error(
      typeof data === 'string'
        ? data
        : 'create_draft_with_glossary returned no puzzle_id — check RPC return type in Supabase',
    )
  }

  revalidatePath('/admin/drafts')
  revalidatePath('/admin')
  redirect(`/admin/puzzles/${puzzleId}`)
}
