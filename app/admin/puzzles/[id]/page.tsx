import { notFound } from 'next/navigation'
import { buildPuzzlePayload } from '@/lib/puzzles'
import type { PuzzleClueRowPayload, PuzzleRowPayload } from '@/lib/puzzles'
import { supabaseService } from '@/lib/supabase-service'
import { PuzzlePreviewPageClient } from './PuzzlePreviewPageClient'

export const dynamic = 'force-dynamic'

export default async function AdminPuzzlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: puzzle, error: puzzleError } = await supabaseService
    .from('puzzles')
    .select('id, title, status, publish_date, width, height, difficulty, grid')
    .eq('id', id)
    .maybeSingle()

  if (puzzleError || !puzzle) notFound()

  const { data: clues, error: cluesError } = await supabaseService
    .from('puzzle_clues')
    .select('number, row, col, direction, word, clue_text')
    .eq('puzzle_id', id)
    .order('number', { ascending: true })

  if (cluesError || !clues) notFound()

  const payload = buildPuzzlePayload(puzzle as PuzzleRowPayload, clues as PuzzleClueRowPayload[])
  if (!payload) notFound()

  const status = (puzzle as { status: string }).status
  const displayTitle = (puzzle as { title: string | null }).title

  return (
    <PuzzlePreviewPageClient puzzle={payload} status={status} displayTitle={displayTitle} />
  )
}
