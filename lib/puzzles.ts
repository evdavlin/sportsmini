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

type DbClue = {
  number: number
  row: number
  col: number
  direction: string
  word: string
  clue_text: string
}

type DbPuzzle = {
  id: string
  title: string | null
  publish_date: string
  width: number
  height: number
  difficulty: number | null
  grid: unknown
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

export function buildPayloadFromDb(puzzle: DbPuzzle, clues: DbClue[]): PuzzlePayload | null {
  const pattern = (puzzle.grid as { pattern: string[] }).pattern
  if (!pattern?.length) return null

  const grid: string[][] = pattern.map((row) =>
    row.split('').map((cell) => (cell === '#' ? '#' : ''))
  )

  for (const clue of clues) {
    const letters = clue.word.split('')
    for (let i = 0; i < letters.length; i++) {
      const r = clue.direction === 'across' ? clue.row : clue.row + i
      const c = clue.direction === 'across' ? clue.col + i : clue.col
      if (grid[r]?.[c] !== undefined && grid[r][c] !== '#') grid[r][c] = letters[i]
    }
  }

  const across = clues
    .filter((c) => c.direction === 'across')
    .map((c) => ({
      num: c.number,
      row: c.row,
      col: c.col,
      answer: c.word,
      clue: c.clue_text,
    }))

  const down = clues
    .filter((c) => c.direction === 'down')
    .map((c) => ({
      num: c.number,
      row: c.row,
      col: c.col,
      answer: c.word,
      clue: c.clue_text,
    }))

  return {
    puzzle_id: puzzle.id,
    title: puzzle.title,
    publish_date: puzzle.publish_date,
    width: puzzle.width,
    height: puzzle.height,
    difficulty: puzzle.difficulty,
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

  return buildPayloadFromDb(puzzle as DbPuzzle, clues as DbClue[])
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

  return buildPayloadFromDb(puzzle as DbPuzzle, clues as DbClue[])
}
