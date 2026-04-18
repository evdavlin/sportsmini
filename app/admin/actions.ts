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

export async function createDraftFromDslAction(dslText: string) {
  const { parsed, errors } = parsePuzzleDsl(dslText)
  if (!parsed || errors.length) {
    throw new Error(errors.map((e) => e.message).join('; ') || 'Parse failed')
  }

  const height = parsed.gridPattern.length
  const width = parsed.gridPattern[0]?.length ?? 0

  const { data: inserted, error: insertErr } = await supabaseService
    .from('puzzles')
    .insert({
      title: parsed.title,
      difficulty: parsed.difficulty,
      status: 'draft',
      width,
      height,
      grid: { pattern: parsed.gridPattern },
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    throw new Error(insertErr?.message ?? 'Insert puzzle failed')
  }

  const puzzleId = inserted.id as string

  const clueRows: Array<{
    puzzle_id: string
    number: number
    row: number
    col: number
    direction: string
    word: string
    clue_text: string
  }> = []

  for (const c of parsed.across) {
    clueRows.push({
      puzzle_id: puzzleId,
      number: c.num,
      row: c.row,
      col: c.col,
      direction: 'across',
      word: c.word,
      clue_text: c.clue,
    })
  }
  for (const c of parsed.down) {
    clueRows.push({
      puzzle_id: puzzleId,
      number: c.num,
      row: c.row,
      col: c.col,
      direction: 'down',
      word: c.word,
      clue_text: c.clue,
    })
  }

  const { error: clueErr } = await supabaseService.from('puzzle_clues').insert(clueRows)

  if (clueErr) {
    await supabaseService.from('puzzles').delete().eq('id', puzzleId)
    throw new Error(clueErr.message)
  }

  revalidatePath('/admin/drafts')
  revalidatePath('/admin')
  redirect(`/admin/puzzles/${puzzleId}`)
}
