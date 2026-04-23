'use server'

import { revalidatePath } from 'next/cache'

import type { GlossaryEntry } from '@/lib/crossword'
import { supabaseService } from '@/lib/supabase-service'

function computeDaysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

function mapGlossaryRow(row: Record<string, unknown>): GlossaryEntry {
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
}

export async function addGlossaryEntryAction(payload: {
  word: string
  clue: string
  type: string
  sport: string
  team: string | null
  alternate_name: string | null
}): Promise<{ ok: true; entry: GlossaryEntry } | { ok: false; error: string }> {
  const word = payload.word.toUpperCase()
  const insert: Record<string, unknown> = {
    word,
    clue: payload.clue.trim(),
    type: payload.type.trim(),
    sport: payload.sport.trim(),
    team: payload.team?.trim() || null,
    length: word.length,
  }
  const alt = payload.alternate_name?.trim()
  if (alt) insert.alternate_name = alt

  const { data, error } = await supabaseService
    .from('crossword_glossary')
    .insert(insert)
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  if (!data || typeof data !== 'object') return { ok: false, error: 'No row returned' }
  return { ok: true, entry: mapGlossaryRow(data as Record<string, unknown>) }
}

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
    console.log('[saveDraft] rpc data', JSON.stringify(data))
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

  console.log('[saveDraft] rpc data', JSON.stringify(data))

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
