/**
 * Puzzle DSL — supported shape:
 *
 * TITLE: My puzzle
 * DIFFICULTY: 3
 * GRID:
 * .#.
 * ...
 * CLUES:
 * 1A (0,0) CAT "A small pet"
 * 2D (0,2) DOG "Another pet"
 *
 * GRID uses # black, letters A-Z, period (.) for blank white filled by clues.
 * Clues: one line each, format 2A (row,col) WORD "clue" with optional | modifiers
 */

export type ParsedClue = {
  num: number
  row: number
  col: number
  word: string
  clue: string
}

export type ParsedPuzzle = {
  title: string
  difficulty: number
  gridPattern: string[]
  across: ParsedClue[]
  down: ParsedClue[]
}

export type DslError = { line: number; message: string }

const MIN_DIM = 3
const MAX_DIM = 10

/** Clue line: NUM + A|D, coords, answer, quoted clue; optional | modifiers */
const CLUE_LINE_RE =
  /^(\d+)([AD])\s+\((\d+),(\d+)\)\s+([A-Za-z]+)\s+"([^"]*)"(?:\s*\|\s*(.+))?\s*$/

export function parsePuzzleDsl(input: string): {
  parsed: ParsedPuzzle | null
  errors: DslError[]
  warnings: string[]
} {
  const errors: DslError[] = []
  const warnings: string[] = []

  const lines = input.replace(/\r\n/g, '\n').split('\n')

  let current = 'none' as 'none' | 'grid' | 'clues'

  let sectionsTitle: string | undefined
  let sectionsDifficulty: number | undefined
  const gridLines: string[] = []
  const clueLines: Array<{ lineNo: number; text: string }> = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const ln = i + 1
    const trimmed = raw.trim()

    if (trimmed === '') {
      if (current === 'grid' || current === 'clues') current = 'none'
      continue
    }

    // Full-line comments: skip outside GRID (# is valid in grid rows)
    if (current !== 'grid' && trimmed.startsWith('#')) continue

    const titleM = /^\s*TITLE\s*:\s*(.*)$/i.exec(raw)
    if (titleM) {
      sectionsTitle = titleM[1]!.trim()
      current = 'none'
      continue
    }

    const diffM = /^\s*DIFFICULTY\s*:\s*(.*)$/i.exec(raw)
    if (diffM) {
      sectionsDifficulty = Number(diffM[1]!.trim())
      current = 'none'
      continue
    }

    if (/^\s*GRID\s*:?\s*$/i.test(trimmed)) {
      gridLines.length = 0
      current = 'grid'
      continue
    }

    if (/^\s*CLUES\s*:?\s*$/i.test(trimmed)) {
      clueLines.length = 0
      current = 'clues'
      continue
    }

    if (current === 'grid') {
      gridLines.push(trimmed.replace(/\s/g, ''))
      continue
    }

    if (current === 'clues') {
      if (trimmed.startsWith('#')) continue
      clueLines.push({ lineNo: ln, text: trimmed })
      continue
    }

    warnings.push(
      `Line ${ln}: unexpected content (hint: use TITLE:, DIFFICULTY:, GRID:, CLUES:)`,
    )
  }

  if (!sectionsTitle?.trim()) errors.push({ line: 0, message: 'Missing TITLE' })
  if (sectionsDifficulty === undefined || Number.isNaN(sectionsDifficulty)) {
    errors.push({ line: 0, message: 'Missing or invalid DIFFICULTY' })
  }
  if (!gridLines.length) errors.push({ line: 0, message: 'Missing GRID rows' })
  if (!clueLines.length) errors.push({ line: 0, message: 'No clues found' })

  if (errors.length) return { parsed: null, errors, warnings }

  const title = sectionsTitle!.trim()
  const difficulty = sectionsDifficulty!

  const width = gridLines[0].length
  const height = gridLines.length

  if (width < MIN_DIM || height < MIN_DIM || width > MAX_DIM || height > MAX_DIM) {
    errors.push({
      line: 0,
      message: `Grid size out of range (${MIN_DIM}-${MAX_DIM} per dimension), got ${width}×${height}`,
    })
  }

  const grid = gridLines.map((row, ri) => {
    if (row.length !== width) errors.push({ line: 0, message: `Row ${ri + 1}: width ${row.length} ≠ ${width}` })
    return row.split('')
  })

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const ch = grid[r][c]
      if (!/[#.a-zA-Z]/.test(ch)) {
        errors.push({ line: 0, message: `Invalid character "${ch}" at (${r},${c})` })
      }
    }
  }

  const across: ParsedClue[] = []
  const down: ParsedClue[] = []

  for (const { text, lineNo } of clueLines) {
    const m = CLUE_LINE_RE.exec(text.trim())
    if (!m) {
      errors.push({
        line: lineNo,
        message:
          'Invalid clue line (expected e.g. 2A (1,4) WORD "Clue text" with optional | modifiers)',
      })
      continue
    }
    const num = Number(m[1])
    const dirLetter = m[2]!.toUpperCase()
    const row = Number(m[3])
    const col = Number(m[4])
    const word = m[5]!.toUpperCase().replace(/[^A-Z]/g, '')
    const clueText = m[6] ?? ''
    if (!Number.isFinite(num) || !Number.isFinite(row) || !Number.isFinite(col) || !word) {
      errors.push({ line: lineNo, message: 'Invalid clue fields' })
      continue
    }
    const p: ParsedClue = { num, row, col, word, clue: clueText }
    if (dirLetter === 'A') across.push(p)
    else down.push(p)
  }

  if (!across.length) warnings.push('No across clues')
  if (!down.length) warnings.push('No down clues')

  const numDir = new Set<string>()
  for (const c of across) {
    const k = `${c.num}|across`
    if (numDir.has(k)) errors.push({ line: 0, message: `Duplicate clue number ${c.num} ACROSS` })
    numDir.add(k)
  }
  for (const c of down) {
    const k = `${c.num}|down`
    if (numDir.has(k)) errors.push({ line: 0, message: `Duplicate clue number ${c.num} DOWN` })
    numDir.add(k)
  }

  const working = grid.map((row) => [...row])

  const placeAndCheck = (
    c: ParsedClue,
    dir: 'across' | 'down',
    label: string
  ): void => {
    const { row: r0, col: c0, word } = c
    if (r0 < 0 || c0 < 0 || r0 >= height || c0 >= width) {
      errors.push({ line: 0, message: `${label} ${c.num}: clue position out of bounds` })
      return
    }
    if (working[r0][c0] === '#') {
      errors.push({ line: 0, message: `${label} ${c.num}: starts on black` })
      return
    }
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'across' ? r0 : r0 + i
      const col = dir === 'across' ? c0 + i : c0
      if (r >= height || col >= width) {
        errors.push({ line: 0, message: `${label} ${c.num}: doesn't fit board` })
        return
      }
      if (working[r][col] === '#') {
        errors.push({ line: 0, message: `${label} ${c.num}: crosses black square` })
        return
      }
      const cell = working[r][col]
      const letter = word[i]!
      if (cell !== '.' && cell !== letter && cell.toUpperCase() !== letter) {
        errors.push({
          line: 0,
          message: `${label} ${c.num}: answer conflicts with grid at (${r},${col})`,
        })
        return
      }
      if (cell === '.' || cell.toUpperCase() === letter) {
        working[r][col] = letter
      }
    }
  }

  for (const c of across) placeAndCheck(c, 'across', 'ACROSS')
  for (const c of down) placeAndCheck(c, 'down', 'DOWN')

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (working[r][c] === '.') {
        errors.push({ line: 0, message: `Orphan unfilled cell at (${r},${c})` })
      }
    }
  }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (working[r][c] === '#') continue
      let a = ''
      let d = ''
      for (const cl of across) {
        for (let i = 0; i < cl.word.length; i++) {
          if (cl.row === r && cl.col + i === c) a = cl.word[i]!
        }
      }
      for (const cl of down) {
        for (let i = 0; i < cl.word.length; i++) {
          if (cl.row + i === r && cl.col === c) d = cl.word[i]!
        }
      }
      if (a && d && a !== d) {
        errors.push({ line: 0, message: `Crossing mismatch at (${r},${c})` })
      }
    }
  }

  const startMap = new Map<string, Set<string>>()
  const addStart = (r: number, c: number, dir: string, num: number) => {
    const key = `${r},${c}|${dir}`
    let s = startMap.get(key)
    if (!s) {
      s = new Set()
      startMap.set(key, s)
    }
    s.add(String(num))
  }
  for (const c of across) addStart(c.row, c.col, 'across', c.num)
  for (const c of down) addStart(c.row, c.col, 'down', c.num)
  for (const [key, nums] of startMap) {
    if (nums.size > 1) {
      errors.push({
        line: 0,
        message: `Multiple clue numbers same start ${key.replace('|', ' ')}: ${[...nums].join(', ')}`,
      })
    }
  }

  if (difficulty < 1 || difficulty > 5 || !Number.isInteger(difficulty)) {
    errors.push({ line: 0, message: 'DIFFICULTY must be integer 1-5' })
  }

  const expected = computeStandardNumbers(working)
  for (const c of [...across, ...down]) {
    const cell = `${c.row},${c.col}`
    const exp = expected.get(cell)
    if (exp !== undefined && exp !== c.num) {
      warnings.push(
        `Numbering: cell (${c.row},${c.col}) is usually #${exp} in standard crossword order, clue says #${c.num}`,
      )
    }
  }

  if (errors.length) return { parsed: null, errors, warnings }

  const pattern = working.map((row) => row.map((ch) => (ch === '#' ? '#' : ch.toUpperCase())).join(''))

  return {
    parsed: {
      title,
      difficulty,
      gridPattern: pattern,
      across,
      down,
    },
    errors: [],
    warnings,
  }
}

function computeStandardNumbers(cells: string[][]): Map<string, number> {
  const height = cells.length
  const width = cells[0]?.length ?? 0
  let n = 0
  const out = new Map<string, number>()
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (cells[r][c] === '#') continue
      const leftBlack = c === 0 || cells[r][c - 1] === '#'
      const topBlack = r === 0 || cells[r - 1][c] === '#'
      const startAcross = leftBlack && c < width - 1 && cells[r][c + 1] !== '#'
      const startDown = topBlack && r < height - 1 && cells[r + 1][c] !== '#'
      if (startAcross || startDown) {
        n += 1
        out.set(`${r},${c}`, n)
      }
    }
  }
  return out
}
