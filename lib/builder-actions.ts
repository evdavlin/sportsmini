'use server'

import { revalidatePath } from 'next/cache'

import { supabaseService } from '@/lib/supabase-service'

export type SavePayload = {
  title: string
  difficulty: number
  width: number
  height: number
  grid: { pattern: string[] }
  clues: Array<{
    number: number
    direction: 'across' | 'down'
    row: number
    col: number
    word: string
    clue_text: string
  }>
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

export async function saveDraftAction(opts: {
  puzzleId: string | null
  payload: SavePayload
}): Promise<{ puzzleId: string; isNew: boolean }> {
  const { puzzleId, payload } = opts

  if (puzzleId === null) {
    const { data, error } = await supabaseService.rpc('create_draft_with_glossary', {
      p_payload: payload,
    })
    if (error) throw new Error(error.message)
    const id = extractPuzzleId(data)
    if (!id) {
      throw new Error(
        typeof data === 'string'
          ? data
          : 'create_draft_with_glossary returned no puzzle id — check RPC response shape'
      )
    }
    revalidatePath('/admin/drafts')
    revalidatePath('/admin')
    revalidatePath(`/admin/puzzles/${id}`)
    return { puzzleId: id, isNew: true }
  }

  const { data, error } = await supabaseService.rpc('update_draft_with_glossary', {
    p_id: puzzleId,
    p_payload: payload,
  })

  if (error) throw new Error(error.message)

  const returnedId = extractPuzzleId(data) ?? puzzleId
  revalidatePath('/admin/drafts')
  revalidatePath('/admin')
  revalidatePath(`/admin/puzzles/${returnedId}`)
  revalidatePath(`/admin/builder`)
  return { puzzleId: returnedId, isNew: false }
}

export async function deleteDraftFromBuilderAction(id: string): Promise<void> {
  const { error } = await supabaseService.from('puzzles').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/drafts')
  revalidatePath('/admin')
}
