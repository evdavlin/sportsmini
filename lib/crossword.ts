export type Cell = string | null

/** null = black, '' = empty letter, 'A'-'Z' = filled */
export type GridType = Cell[][]

export type Direction = 'across' | 'down'

export type Slot = {
  startRow: number
  startCol: number
  length: number
  pattern: string[]
  number: number | null
}

export type PlacedWord = {
  key: string
  number: number
  direction: Direction
  row: number
  col: number
  word: string
  clueText: string
  glossaryId: string | null
  source: 'glossary' | 'variant' | 'new-word'
}

export type GlossaryEntry = {
  id: string
  word: string
  clue: string
  sport: string
  type: string
  team: string | null
  length: number
  lastUsedAt: string | null
  daysSinceUse: number | null
}

export type ValidationIssue = {
  key: string
  type: 'error' | 'warn'
  message: string
}

function isFilledLetter(c: Cell): boolean {
  return typeof c === 'string' && c.length === 1 && /[A-Z]/i.test(c)
}

/** Standard crossword numbering (left→right, top→bottom). */
export function computeNumbering(grid: GridType): (number | null)[][] {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  const num: (number | null)[][] = grid.map((row) => row.map(() => null))
  let counter = 1
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] === null) continue
      const leftBlack = c === 0 || grid[r][c - 1] === null
      const topBlack = r === 0 || grid[r - 1][c] === null
      const startAcross =
        leftBlack && c < w - 1 && grid[r][c + 1] !== null && grid[r][c + 1] !== undefined
      const startDown =
        topBlack &&
        r < h - 1 &&
        grid[r + 1][c] !== null &&
        grid[r + 1][c] !== undefined
      if (startAcross || startDown) {
        num[r][c] = counter
        counter += 1
      }
    }
  }
  return num
}

export function computeSlot(
  grid: GridType,
  cell: [number, number],
  direction: Direction
): Slot | null {
  const [r, c] = cell
  if (!grid[r] || grid[r][c] === null || grid[r][c] === undefined) return null

  let startRow = r
  let startCol = c
  if (direction === 'across') {
    while (startCol > 0 && grid[r][startCol - 1] !== null) startCol--
  } else {
    while (startRow > 0 && grid[startRow - 1][c] !== null) startRow--
  }

  const pattern: string[] = []
  if (direction === 'across') {
    let col = startCol
    while (col < grid[0].length && grid[r][col] !== null) {
      pattern.push(grid[r][col] === '' ? '' : String(grid[r][col]).toUpperCase())
      col++
    }
  } else {
    let row = startRow
    while (row < grid.length && grid[row][c] !== null) {
      pattern.push(grid[row][c] === '' ? '' : String(grid[row][c]).toUpperCase())
      row++
    }
  }

  const numbering = computeNumbering(grid)
  const number = numbering[startRow]?.[startCol] ?? null

  return {
    startRow,
    startCol,
    length: pattern.length,
    pattern,
    number,
  }
}

export function computeActiveWordCells(
  grid: GridType,
  cell: [number, number],
  direction: Direction
): Set<string> {
  const set = new Set<string>()
  const slot = computeSlot(grid, cell, direction)
  if (!slot) return set
  for (let i = 0; i < slot.length; i++) {
    const r = direction === 'across' ? slot.startRow : slot.startRow + i
    const col = direction === 'across' ? slot.startCol + i : slot.startCol
    set.add(`${r},${col}`)
  }
  return set
}

export function matchesPattern(word: string, pattern: string[]): boolean {
  const W = word.toUpperCase()
  if (W.length !== pattern.length) return false
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]
    if (p === '' || p === undefined) continue
    if (W[i] !== p) return false
  }
  return true
}

function slotKey(number: number, direction: Direction): string {
  return `${number}-${direction}`
}

function classifyWord(
  wordUpper: string,
  clueText: string,
  glossary: GlossaryEntry[],
  linkedGlossaryId?: string | null
): Pick<PlacedWord, 'glossaryId' | 'source'> {
  if (linkedGlossaryId) {
    const linked = glossary.find((g) => g.id === linkedGlossaryId)
    if (linked && linked.word.toUpperCase() === wordUpper) {
      return { glossaryId: linked.id, source: 'glossary' }
    }
  }
  const rows = glossary.filter((g) => g.word.toUpperCase() === wordUpper)
  if (rows.length === 0) {
    return { glossaryId: null, source: 'new-word' }
  }
  const trimmed = clueText.trim()
  const resolved = trimmed === '' ? rows[0]!.clue : clueText
  const exact = rows.find((g) => g.clue === resolved)
  if (exact) {
    return { glossaryId: exact.id, source: 'glossary' }
  }
  return { glossaryId: rows[0]!.id, source: 'variant' }
}

function extractAcrossWords(
  grid: GridType,
  numbering: (number | null)[][]
): Array<{ row: number; col: number; word: string; number: number }> {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  const out: Array<{ row: number; col: number; word: string; number: number }> = []
  for (let r = 0; r < h; r++) {
    let c = 0
    while (c < w) {
      if (grid[r][c] === null) {
        c++
        continue
      }
      const leftBlack = c === 0 || grid[r][c - 1] === null
      if (!leftBlack) {
        c++
        continue
      }
      let col = c
      const chars: string[] = []
      while (col < w && grid[r][col] !== null) {
        chars.push(
          isFilledLetter(grid[r][col]) ? String(grid[r][col]).toUpperCase() : ''
        )
        col++
      }
      const len = chars.length
      if (len >= 2) {
        const allFilled = chars.every((ch) => ch.length === 1 && /[A-Z]/.test(ch))
        if (allFilled) {
          const word = chars.join('')
          const num = numbering[r][c]
          if (num != null) {
            out.push({ row: r, col: c, word, number: num })
          }
        }
      }
      c = col
    }
  }
  return out
}

function extractDownWords(
  grid: GridType,
  numbering: (number | null)[][]
): Array<{ row: number; col: number; word: string; number: number }> {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  const out: Array<{ row: number; col: number; word: string; number: number }> = []
  for (let c = 0; c < w; c++) {
    let r = 0
    while (r < h) {
      if (grid[r][c] === null) {
        r++
        continue
      }
      const topBlack = r === 0 || grid[r - 1][c] === null
      if (!topBlack) {
        r++
        continue
      }
      let row = r
      const chars: string[] = []
      while (row < h && grid[row][c] !== null) {
        chars.push(
          isFilledLetter(grid[row][c]) ? String(grid[row][c]).toUpperCase() : ''
        )
        row++
      }
      const len = chars.length
      if (len >= 2) {
        const allFilled = chars.every((ch) => ch.length === 1 && /[A-Z]/.test(ch))
        if (allFilled) {
          const word = chars.join('')
          const num = numbering[r][c]
          if (num != null) {
            out.push({ row: r, col: c, word, number: num })
          }
        }
      }
      r = row
    }
  }
  return out
}

export function derivePlacedWords(
  grid: GridType,
  numbering: (number | null)[][],
  glossary: GlossaryEntry[],
  existingClues: Map<string, string>,
  existingGlossaryIds?: Map<string, string | null>
): PlacedWord[] {
  const across = extractAcrossWords(grid, numbering)
  const down = extractDownWords(grid, numbering)
  const placed: PlacedWord[] = []

  for (const a of across) {
    const key = `${a.number}-across-${a.row}-${a.col}`
    const slot = slotKey(a.number, 'across')
    let clueText: string
    if (existingClues.has(slot)) {
      clueText = existingClues.get(slot) ?? ''
    } else {
      clueText = glossary.find((g) => g.word.toUpperCase() === a.word)?.clue ?? ''
    }
    const rowsW = glossary.filter((g) => g.word.toUpperCase() === a.word)
    const displayClue =
      clueText.trim() === '' && rowsW.length ? rowsW[0]!.clue : clueText
    const linkedId = existingGlossaryIds?.get(slot) ?? null
    const { glossaryId, source } = classifyWord(a.word, clueText, glossary, linkedId)
    placed.push({
      key,
      number: a.number,
      direction: 'across',
      row: a.row,
      col: a.col,
      word: a.word,
      clueText: displayClue,
      glossaryId,
      source,
    })
  }

  for (const d of down) {
    const key = `${d.number}-down-${d.row}-${d.col}`
    const slot = slotKey(d.number, 'down')
    let clueText: string
    if (existingClues.has(slot)) {
      clueText = existingClues.get(slot) ?? ''
    } else {
      clueText = glossary.find((g) => g.word.toUpperCase() === d.word)?.clue ?? ''
    }
    const rowsW = glossary.filter((g) => g.word.toUpperCase() === d.word)
    const displayClue =
      clueText.trim() === '' && rowsW.length ? rowsW[0]!.clue : clueText
    const linkedIdDown = existingGlossaryIds?.get(slot) ?? null
    const { glossaryId, source } = classifyWord(d.word, clueText, glossary, linkedIdDown)
    placed.push({
      key,
      number: d.number,
      direction: 'down',
      row: d.row,
      col: d.col,
      word: d.word,
      clueText: displayClue,
      glossaryId,
      source,
    })
  }

  return placed
}

/** Length of the horizontal word slot containing (r,c); 0 if black. */
function acrossSlotLengthAt(grid: GridType, r: number, c: number): number {
  if (!grid[r] || grid[r][c] === null) return 0
  let start = c
  while (start > 0 && grid[r][start - 1] !== null) start--
  let len = 0
  let col = start
  const w = grid[0].length
  while (col < w && grid[r][col] !== null) {
    len++
    col++
  }
  return len
}

/** Length of the vertical word slot containing (r,c); 0 if black. */
function downSlotLengthAt(grid: GridType, r: number, c: number): number {
  if (!grid[r] || grid[r][c] === null) return 0
  let start = r
  while (start > 0 && grid[start - 1][c] !== null) start--
  let len = 0
  let row = start
  const h = grid.length
  while (row < h && grid[row][c] !== null) {
    len++
    row++
  }
  return len
}

export function detectValidationIssues(
  grid: GridType,
  placed: PlacedWord[]
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const h = grid.length
  const w = grid[0]?.length ?? 0

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] === null) continue
      const acrossLen = acrossSlotLengthAt(grid, r, c)
      const downLen = downSlotLengthAt(grid, r, c)
      if (acrossLen === 1 && downLen === 1) {
        errors.push({
          key: `orphan-${r}-${c}`,
          type: 'error',
          message: `Isolated letter cell at row ${r + 1}, col ${c + 1} (across and down slots are both length 1)`,
        })
      }
    }
  }

  const letterByCell = new Map<string, string>()
  const seenConflict = new Set<string>()
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const rr = p.direction === 'across' ? p.row : p.row + i
      const cc = p.direction === 'across' ? p.col + i : p.col
      const key = `${rr},${cc}`
      const ch = p.word[i]!
      const prev = letterByCell.get(key)
      if (prev !== undefined && prev !== ch && !seenConflict.has(key)) {
        seenConflict.add(key)
        errors.push({
          key: `conflict-${key}`,
          type: 'error',
          message: `Letter conflict at row ${rr + 1}, col ${cc + 1}: "${prev}" vs "${ch}"`,
        })
      } else if (prev === undefined) {
        letterByCell.set(key, ch)
      }
    }
  }

  let unfilled = 0
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] === '') unfilled++
    }
  }
  if (unfilled > 0) {
    warnings.push({
      key: 'unfilled',
      type: 'warn',
      message: `${unfilled} letter cell${unfilled !== 1 ? 's' : ''} still empty`,
    })
  }

  for (const p of placed) {
    if (p.source === 'variant') {
      warnings.push({
        key: `variant-${p.key}`,
        type: 'warn',
        message: `${p.number}${p.direction === 'across' ? 'A' : 'D'} ${p.word} uses a clue variant (differs from glossary default)`,
      })
    }
  }

  return { errors, warnings }
}
