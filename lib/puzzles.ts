import { supabase } from './supabase'

export type PuzzleClue = {
  num: number
  row: number
  col: number
  answer: string
  clue: string
}

export type PuzzlePayload = {
  puzzle_id: string
  title: string | null
  publish_date: string
  width: number
  height: number
  difficulty: number | null
  grid: string[][]
  across: PuzzleClue[]
  down: PuzzleClue[]
}

/** Row shape from `puzzles` for `buildPuzzlePayload` */
export type PuzzleRowPayload = {
  id: string
  title: string | null
  publish_date: string | null
  width: number
  height: number
  difficulty: number | null
  grid: unknown
}

/** Row shape from `puzzle_clues` for `buildPuzzlePayload` */
export type PuzzleClueRowPayload = {
  number: number
  row: number
  col: number
  direction: string
  word: string
  clue_text: string
}

export function getCurrentPuzzleDate(now: Date = new Date()): string {
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => et.find((p) => p.type === type)!.value
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  const hour = Number(get('hour'))
  const target = new Date(Date.UTC(year, month - 1, day))
  if (hour < 7) target.setUTCDate(target.getUTCDate() - 1)
  return target.toISOString().slice(0, 10)
}

export function buildPuzzlePayload(
  puzzleRow: PuzzleRowPayload,
  clueRows: PuzzleClueRowPayload[]
): PuzzlePayload | null {
  const pattern = (puzzleRow.grid as { pattern: string[] }).pattern
  if (!pattern?.length) return null

  const grid: string[][] = pattern.map((row) =>
    row.split('').map((cell) => (cell === '#' ? '#' : ''))
  )

  for (const clue of clueRows) {
    const letters = clue.word.split('')
    for (let i = 0; i < letters.length; i++) {
      const r = clue.direction === 'across' ? clue.row : clue.row + i
      const c = clue.direction === 'across' ? clue.col + i : clue.col
      if (grid[r]?.[c] !== undefined && grid[r][c] !== '#') grid[r][c] = letters[i]
    }
  }

  const across = clueRows
    .filter((c) => c.direction === 'across')
    .map((c) => ({
      num: c.number,
      row: c.row,
      col: c.col,
      answer: c.word,
      clue: c.clue_text,
    }))

  const down = clueRows
    .filter((c) => c.direction === 'down')
    .map((c) => ({
      num: c.number,
      row: c.row,
      col: c.col,
      answer: c.word,
      clue: c.clue_text,
    }))

  return {
    puzzle_id: puzzleRow.id,
    title: puzzleRow.title,
    publish_date: puzzleRow.publish_date ?? '',
    width: puzzleRow.width,
    height: puzzleRow.height,
    difficulty: puzzleRow.difficulty,
    grid,
    across,
    down,
  }
}

/**
 * Fetch today's published puzzle (by Eastern "puzzle day" + exact publish_date match).
 */
export async function getTodaysPuzzle(): Promise<PuzzlePayload | null> {
  const dateStr = getCurrentPuzzleDate()

  const { data: puzzle, error: puzzleError } = await supabase
    .from('puzzles')
    .select('id, title, publish_date, width, height, difficulty, grid')
    .eq('publish_date', dateStr)
    .eq('status', 'published')
    .maybeSingle()

  if (puzzleError || !puzzle) return null

  const { data: clues, error: cluesError } = await supabase
    .from('puzzle_clues')
    .select('number, row, col, direction, word, clue_text')
    .eq('puzzle_id', puzzle.id)
    .order('number', { ascending: true })

  if (cluesError || !clues) return null

  return buildPuzzlePayload(puzzle as PuzzleRowPayload, clues as PuzzleClueRowPayload[])
}

/**
 * Load any puzzle by id for admin preview (any status).
 */
export async function getPuzzlePayloadById(puzzleId: string): Promise<PuzzlePayload | null> {
  const { data: puzzle, error: puzzleError } = await supabase
    .from('puzzles')
    .select('id, title, publish_date, width, height, difficulty, grid')
    .eq('id', puzzleId)
    .maybeSingle()

  if (puzzleError || !puzzle) return null

  const { data: clues, error: cluesError } = await supabase
    .from('puzzle_clues')
    .select('number, row, col, direction, word, clue_text')
    .eq('puzzle_id', puzzle.id)
    .order('number', { ascending: true })

  if (cluesError || !clues) return null

  return buildPuzzlePayload(puzzle as PuzzleRowPayload, clues as PuzzleClueRowPayload[])
}
