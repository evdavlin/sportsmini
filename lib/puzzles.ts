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
  grid: string[][]          // full 2D grid with letters and '#'
  across: PuzzleClue[]
  down: PuzzleClue[]
}

/**
 * Fetch today's published puzzle in the exact shape the Solve screen expects.
 * Reconstructs the full letter grid from the pattern + clue placements.
 */
export async function getTodaysPuzzle(): Promise<PuzzlePayload | null> {
  // 1. Fetch the puzzle row (most recent published)
  const { data: puzzle, error: puzzleError } = await supabase
    .from('puzzles')
    .select('id, title, publish_date, width, height, difficulty, grid')
    .eq('status', 'published')
    .order('publish_date', { ascending: false })
    .limit(1)
    .single()

  if (puzzleError || !puzzle) return null

  // 2. Fetch all clues for this puzzle
  const { data: clues, error: cluesError } = await supabase
    .from('puzzle_clues')
    .select('number, row, col, direction, word, clue_text')
    .eq('puzzle_id', puzzle.id)
    .order('number', { ascending: true })

  if (cluesError || !clues) return null

  // 3. Reconstruct the full letter grid from pattern + clue placements
  const pattern = (puzzle.grid as { pattern: string[] }).pattern
  const grid: string[][] = pattern.map((row) =>
    row.split('').map((cell) => (cell === '#' ? '#' : ''))
  )

  for (const clue of clues) {
    const letters = clue.word.split('')
    for (let i = 0; i < letters.length; i++) {
      const r = clue.direction === 'across' ? clue.row : clue.row + i
      const c = clue.direction === 'across' ? clue.col + i : clue.col
      grid[r][c] = letters[i]
    }
  }

  // 4. Split clues by direction into the shape the Solve screen wants
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