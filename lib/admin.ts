import { supabaseService } from '@/lib/supabase-service'
import type { PuzzleClueRowPayload, PuzzlePayload, PuzzleRowPayload } from '@/lib/puzzles'
import { buildPuzzlePayload, getCurrentPuzzleDate } from '@/lib/puzzles'

export type AdminPuzzle = {
  id: string
  title: string | null
  status: string
  difficulty: number | null
  publish_date: string | null
  queue_position: number | null
  width: number
  height: number
  grid: unknown
  created_at: string
  updated_at: string
  clue_count: number
}

export type PipelineSummaryRow = {
  draft_count: number
  queue_count: number
  published_count: number
  archived_count: number
  live_puzzle: Record<string, unknown> | null
}

/** Row from public.shape_templates_view */
export type ShapeTemplateRow = {
  id: string
  title: string | null
  width: number
  height: number
  grid: unknown
  created_at: string
  updated_at: string
  letter_cell_count: number | null
  total_cells: number | null
}

/** Active shape templates for generator dropdown (`puzzles` rows). */
export type ActiveShapeTemplateRow = {
  id: string
  title: string | null
  width: number
  height: number
}

export type AdminCandidate = {
  id: string
  shape_id: string
  /** `puzzles.title` for the shape, when the row still exists */
  shape_title: string | null
  /** Denormalized name from the generator */
  shape_name: string | null
  grid: unknown
  width: number
  height: number
  clues: unknown
  quality_score: number
  sport_breakdown: Record<string, number> | null
  generator_run: string | null
  status: string
  promoted_puzzle_id: string | null
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

function adminSort(a: AdminPuzzle, b: AdminPuzzle): number {
  const rank = (s: string) =>
    ({ published: 0, queued: 1, draft: 2, archived: 3 }[s] ?? 99)
  const ra = rank(a.status)
  const rb = rank(b.status)
  if (ra !== rb) return ra - rb
  if (a.status === 'queued' && b.status === 'queued') {
    return (a.queue_position ?? 999) - (b.queue_position ?? 999)
  }
  if (a.status === 'draft' && b.status === 'draft') {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }
  if (a.status === 'published' && b.status === 'published') {
    return (b.publish_date ?? '').localeCompare(a.publish_date ?? '')
  }
  if (a.status === 'archived' && b.status === 'archived') {
    return (b.publish_date ?? '').localeCompare(a.publish_date ?? '')
  }
  return a.id.localeCompare(b.id)
}

const DEFAULT_ADMIN_PUZZLE_STATUSES = ['draft', 'queued', 'published', 'archived']

export async function getAdminPuzzles(filters?: { status?: string[] }): Promise<AdminPuzzle[]> {
  const statuses = filters?.status?.length ? filters.status : DEFAULT_ADMIN_PUZZLE_STATUSES
  const q = supabaseService.from('puzzles').select('*').in('status', statuses)
  const { data: puzzles, error } = await q
  if (error || !puzzles) return []

  const { data: clueRows } = await supabaseService.from('puzzle_clues').select('puzzle_id')
  const counts = new Map<string, number>()
  for (const r of clueRows ?? []) {
    const id = (r as { puzzle_id: string }).puzzle_id
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const rows: AdminPuzzle[] = puzzles.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    title: (p.title as string | null) ?? null,
    status: p.status as string,
    difficulty: (p.difficulty as number | null) ?? null,
    publish_date: (p.publish_date as string | null) ?? null,
    queue_position: (p.queue_position as number | null) ?? null,
    width: p.width as number,
    height: p.height as number,
    grid: p.grid,
    created_at: p.created_at as string,
    updated_at: p.updated_at as string,
    clue_count: counts.get(p.id as string) ?? 0,
  }))

  rows.sort(adminSort)
  return rows
}

export async function getShapeTemplates(): Promise<ShapeTemplateRow[]> {
  const { data, error } = await supabaseService
    .from('shape_templates_view')
    .select(
      'id, title, width, height, grid, created_at, updated_at, letter_cell_count, total_cells',
    )
    .order('created_at', { ascending: false })

  if (error || !data?.length) return []

  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    title: (row.title as string | null) ?? null,
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    grid: row.grid,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    letter_cell_count:
      row.letter_cell_count == null ? null : Number(row.letter_cell_count),
    total_cells: row.total_cells == null ? null : Number(row.total_cells),
  }))
}

export async function getActiveShapeTemplates(): Promise<ActiveShapeTemplateRow[]> {
  const { data, error } = await supabaseService
    .from('puzzles')
    .select('id, title, width, height')
    .eq('status', 'shape_template')
    .eq('is_active', true)
    .order('title', { ascending: true, nullsFirst: false })

  if (error || !data?.length) return []

  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    title: (row.title as string | null) ?? null,
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
  }))
}

export async function getPipelineSummary(): Promise<PipelineSummaryRow> {
  const { data, error } = await supabaseService.from('pipeline_summary').select('*').maybeSingle()

  if (error || !data) {
    const { data: counts } = await supabaseService.from('puzzles').select('status')
    const tally = { draft: 0, queued: 0, published: 0, archived: 0 }
    for (const row of counts ?? []) {
      const s = (row as { status: string }).status
      if (s in tally) (tally as Record<string, number>)[s] += 1
    }
    const dateStr = getCurrentPuzzleDate()
    const { data: live } = await supabaseService
      .from('puzzles')
      .select('*')
      .eq('publish_date', dateStr)
      .eq('status', 'published')
      .maybeSingle()
    return {
      draft_count: tally.draft,
      queue_count: tally.queued,
      published_count: tally.published,
      archived_count: tally.archived,
      live_puzzle: live ?? null,
    }
  }

  return data as PipelineSummaryRow
}

export function projectedPublishDate(queuePosition: number): string {
  const anchor = getCurrentPuzzleDate()
  const d = new Date(anchor + 'T12:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + queuePosition)
  return d.toISOString().slice(0, 10)
}

export async function getHistoryRows(): Promise<
  Array<{
    id: string
    publish_date: string | null
    title: string | null
    difficulty: number | null
    status: string
    solve_count: number
    avg_seconds: number | null
    started_count: number
  }>
> {
  const { data: puzzles, error } = await supabaseService
    .from('puzzles')
    .select('id, publish_date, title, difficulty, status')
    .in('status', ['published', 'archived'])
    .order('publish_date', { ascending: false })

  if (error || !puzzles?.length) return []

  const ids = puzzles.map((p) => (p as { id: string }).id)
  const { data: solves } = await supabaseService
    .from('solves')
    .select('puzzle_id, solved_at, time_seconds')
    .in('puzzle_id', ids)

  const byPuzzle = new Map<
    string,
    { started: number; solved: number; sumSec: number; solvedN: number }
  >()
  for (const p of puzzles) {
    byPuzzle.set((p as { id: string }).id, { started: 0, solved: 0, sumSec: 0, solvedN: 0 })
  }
  for (const s of solves ?? []) {
    const row = s as { puzzle_id: string; solved_at: string | null; time_seconds: number | null }
    const agg = byPuzzle.get(row.puzzle_id)
    if (!agg) continue
    agg.started += 1
    if (row.solved_at) {
      agg.solved += 1
      if (row.time_seconds != null) {
        agg.sumSec += row.time_seconds
        agg.solvedN += 1
      }
    }
  }

  return puzzles.map((p) => {
    const id = (p as { id: string }).id
    const agg = byPuzzle.get(id)!
    const avg =
      agg.solvedN > 0 ? Math.round(agg.sumSec / agg.solvedN) : null
    return {
      id,
      publish_date: (p as { publish_date: string | null }).publish_date,
      title: (p as { title: string | null }).title,
      difficulty: (p as { difficulty: number | null }).difficulty,
      status: (p as { status: string }).status,
      solve_count: agg.solved,
      avg_seconds: avg,
      started_count: agg.started,
    }
  })
}

export async function getPuzzleAdminMeta(
  puzzleId: string
): Promise<{ status: string; title: string | null } | null> {
  const { data, error } = await supabaseService
    .from('puzzles')
    .select('status, title')
    .eq('id', puzzleId)
    .maybeSingle()
  if (error || !data) return null
  return { status: (data as { status: string }).status, title: (data as { title: string | null }).title }
}

export async function getPuzzlePayloadForAdmin(puzzleId: string): Promise<PuzzlePayload | null> {
  const { data: puzzle } = await supabaseService
    .from('puzzles')
    .select('id, title, publish_date, width, height, difficulty, grid')
    .eq('id', puzzleId)
    .maybeSingle()

  if (!puzzle) return null

  const { data: clues } = await supabaseService
    .from('puzzle_clues')
    .select('number, row, col, direction, word, clue_text')
    .eq('puzzle_id', puzzleId)
    .order('number', { ascending: true })

  if (!clues) return null

  return buildPuzzlePayload(puzzle as PuzzleRowPayload, clues as PuzzleClueRowPayload[])
}

export type GetCandidatesFilters = {
  status?: 'pending' | 'promoted' | 'rejected' | 'all'
  shapeName?: string | null
  sort?: 'quality_score' | 'created_at'
}

function mapCandidateRow(row: Record<string, unknown>): Omit<AdminCandidate, 'shape_title'> {
  return {
    id: String(row.id),
    shape_id: String(row.shape_id ?? ''),
    shape_name: (row.shape_name as string | null) ?? null,
    grid: row.grid,
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    clues: row.clues,
    quality_score: Number(row.quality_score ?? 0),
    sport_breakdown:
      row.sport_breakdown && typeof row.sport_breakdown === 'object'
        ? (row.sport_breakdown as Record<string, number>)
        : null,
    generator_run: (row.generator_run as string | null) ?? null,
    status: String(row.status ?? ''),
    promoted_puzzle_id: (row.promoted_puzzle_id as string | null) ?? null,
    review_notes: (row.review_notes as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    reviewed_at: (row.reviewed_at as string | null) ?? null,
  }
}

export async function getPendingCandidateCount(): Promise<number> {
  const { count, error } = await supabaseService
    .from('puzzle_candidates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) return 0
  return count ?? 0
}

export async function getCandidateShapeNames(): Promise<string[]> {
  const { data, error } = await supabaseService.from('puzzle_candidates').select('shape_name')
  if (error || !data?.length) return []

  const set = new Set<string>()
  for (const row of data) {
    const n = (row as { shape_name: string | null }).shape_name
    if (n && n.trim()) set.add(n.trim())
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export async function getCandidates(filters?: GetCandidatesFilters): Promise<AdminCandidate[]> {
  const status = filters?.status ?? 'pending'
  const shapeName = filters?.shapeName?.trim() || null
  const sort = filters?.sort ?? 'quality_score'

  let q = supabaseService.from('puzzle_candidates').select('*')
  if (status !== 'all') {
    q = q.eq('status', status)
  }
  if (shapeName) {
    q = q.eq('shape_name', shapeName)
  }

  if (sort === 'created_at') {
    q = q.order('created_at', { ascending: false }).order('quality_score', { ascending: false })
  } else {
    q = q.order('quality_score', { ascending: false }).order('created_at', { ascending: false })
  }

  const { data: rows, error } = await q
  if (error || !rows?.length) return []

  const mapped = (rows as Record<string, unknown>[]).map(mapCandidateRow)
  const shapeIds = [...new Set(mapped.map((r) => r.shape_id).filter(Boolean))]
  const titleByShapeId = new Map<string, string | null>()

  if (shapeIds.length) {
    const { data: puzzles } = await supabaseService
      .from('puzzles')
      .select('id, title')
      .in('id', shapeIds)

    for (const p of puzzles ?? []) {
      const id = (p as { id: string }).id
      titleByShapeId.set(id, ((p as { title: string | null }).title ?? null) as string | null)
    }
  }

  return mapped.map((r) => ({
    ...r,
    shape_title: titleByShapeId.get(r.shape_id) ?? null,
  }))
}
