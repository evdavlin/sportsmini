/**
 * Puzzle DSL — supported shape:
 *
 * TITLE: My puzzle
 * DIFFICULTY: 3
 *
 * GRID
 * AB#
 * C.D
 *
 * ACROSS
 * 1 0 0 AB | Horizontal clue
 *
 * DOWN
 * 2 0 0 AC | Vertical clue
 *
 * GRID uses # black, letters A-Z, period (.) for blank white filled by clues.
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

export function parsePuzzleDsl(input: string): {
  parsed: ParsedPuzzle | null
  errors: DslError[]
  warnings: string[]
} {
  const errors: DslError[] = []
  const warnings: string[] = []

  const lines = input.replace(/\r\n/g, '\n').split('\n')

  let current =
    'none' as 'none' | 'title' | 'difficulty' | 'grid' | 'across' | 'down'

  let titleBuf = ''
  let diffBuf = ''
  const gridLines: string[] = []
  const acrossLines: string[] = []
  const downLines: string[] = []

  let sectionsTitle: string | undefined
  let sectionsDifficulty: number | undefined

  const flushTitle = () => {
    if (current === 'title' && titleBuf.trim()) {
      sectionsTitle = titleBuf.trim()
    }
    titleBuf = ''
  }
  const flushDiff = () => {
    if (current === 'difficulty' && diffBuf.trim()) {
      sectionsDifficulty = Number(diffBuf.trim())
    }
    diffBuf = ''
  }

  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1
    let line = lines[i].trim()
    if (!line || line.startsWith('#')) continue

    const hdr = /^([A-Za-z]+)\s*:\s*(.*)$/.exec(line)
    if (hdr) {
      const name = hdr[1].toUpperCase()
      const rest = hdr[2]
      if (name === 'TITLE') {
        flushTitle()
        flushDiff()
        sectionsTitle = rest.trim()
        current = 'none'
        continue
      }
      if (name === 'DIFFICULTY') {
        flushTitle()
        flushDiff()
        sectionsDifficulty = Number(rest.trim())
        current = 'none'
        continue
      }
    }

    const bare = line.toUpperCase().trim()
    if (bare === 'GRID' || bare === 'GRID:') {
      flushTitle()
      flushDiff()
      gridLines.length = 0
      current = 'grid'
      continue
    }
    if (bare === 'ACROSS' || bare === 'ACROSS:') {
      flushTitle()
      flushDiff()
      acrossLines.length = 0
      current = 'across'
      continue
    }
    if (bare === 'DOWN' || bare === 'DOWN:') {
      flushTitle()
      flushDiff()
      downLines.length = 0
      current = 'down'
      continue
    }

    if (current === 'grid') gridLines.push(line.replace(/\s/g, ''))
    else if (current === 'across') acrossLines.push(line)
    else if (current === 'down') downLines.push(line)
    else if (current === 'title') titleBuf += (titleBuf ? ' ' : '') + line
    else if (current === 'difficulty') diffBuf += line
    else if (current === 'none')
      warnings.push(`Line ${ln}: unexpected content (hint: use TITLE:, DIFFICULTY:, GRID, ACROSS, DOWN)`)
  }

  flushTitle()
  flushDiff()

  if (!sectionsTitle?.trim()) errors.push({ line: 0, message: 'Missing TITLE' })
  if (sectionsDifficulty === undefined || Number.isNaN(sectionsDifficulty)) {
    errors.push({ line: 0, message: 'Missing or invalid DIFFICULTY' })
  }
  if (!gridLines.length) errors.push({ line: 0, message: 'Missing GRID rows' })
  if (!acrossLines.length && !downLines.length) {
    errors.push({ line: 0, message: 'Missing ACROSS / DOWN clues' })
  }

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

  const parseClueLine = (text: string, lineHint: number): ParsedClue | null => {
    let sep = text.indexOf('|')
    if (sep < 0) sep = text.indexOf('::')
    if (sep < 0) {
      errors.push({ line: lineHint, message: 'Clue needs "|" or "::" before clue text' })
      return null
    }
    const head = text.slice(0, sep).trim()
    const clueText = text.slice(sep + (text[sep] === '|' ? 1 : 2)).trim()
    const parts = head.split(/\s+/).filter(Boolean)
    if (parts.length < 4) {
      errors.push({ line: lineHint, message: 'Expected: num row col WORD...' })
      return null
    }
    const num = Number(parts[0])
    const row = Number(parts[1])
    const col = Number(parts[2])
    const word = parts
      .slice(3)
      .join('')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
    if (!Number.isFinite(num) || !Number.isFinite(row) || !Number.isFinite(col) || !word) {
      errors.push({ line: lineHint, message: 'Invalid clue header' })
      return null
    }
    return { num, row, col, word, clue: clueText }
  }

  const across: ParsedClue[] = []
  const down: ParsedClue[] = []

  acrossLines.forEach((l, idx) => {
    const p = parseClueLine(l, idx + 1)
    if (p) across.push(p)
  })
  downLines.forEach((l, idx) => {
    const p = parseClueLine(l, idx + 1)
    if (p) down.push(p)
  })

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
