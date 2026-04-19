export type SolveState = {
  completed: boolean
  timeSeconds: number
  hintsUsed: number
  wasRevealed: boolean
  hintedCells: string[]
  solvedAt: string
}

/** @deprecated Use SolveState — alias for legacy imports */
export type TodaySolve = SolveState & { publish_date?: string }

function storageKey(publishDate: string): string {
  return `sportsmini:solve:${publishDate}`
}

function migrateLegacyJson(raw: Record<string, unknown>): SolveState {
  const timeSeconds = Number(
    raw.timeSeconds ?? raw.time_seconds ?? 0
  )
  const hintsLegacy = Number(raw.hintsUsed ?? raw.hints_used ?? 0)
  const wasRevealed = Boolean(
    raw.wasRevealed ?? raw.was_revealed ?? hintsLegacy >= 999
  )
  const hintedCells = Array.isArray(raw.hintedCells)
    ? (raw.hintedCells as unknown[]).map(String)
    : []
  const solvedAt =
    typeof raw.solvedAt === 'string'
      ? raw.solvedAt
      : typeof raw.solved_at === 'string'
        ? raw.solved_at
        : ''
  const completed =
    typeof raw.completed === 'boolean'
      ? raw.completed
      : Boolean(solvedAt || raw.solved_at)

  return {
    completed,
    timeSeconds,
    hintsUsed: hintsLegacy,
    wasRevealed,
    hintedCells,
    solvedAt,
  }
}

export function getTodaySolve(publishDate: string): SolveState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(publishDate))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return migrateLegacyJson(parsed)
  } catch {
    return null
  }
}

export function saveTodaySolve(publishDate: string, state: SolveState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(publishDate), JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function addHintedCell(publishDate: string, key: string): void {
  if (typeof window === 'undefined') return
  try {
    const cur = getTodaySolve(publishDate)
    const hintedCells = cur?.hintedCells ? [...cur.hintedCells] : []
    if (!hintedCells.includes(key)) hintedCells.push(key)
    const next: SolveState = cur
      ? { ...cur, hintedCells }
      : {
          completed: false,
          timeSeconds: 0,
          hintsUsed: 0,
          wasRevealed: false,
          hintedCells,
          solvedAt: '',
        }
    saveTodaySolve(publishDate, next)
  } catch {
    /* ignore */
  }
}

/** Dev helper — clears today's solve key only. */
export function clearTodaySolve(publishDate?: string): void {
  if (typeof window === 'undefined') return
  try {
    if (publishDate) window.localStorage.removeItem(storageKey(publishDate))
  } catch {
    /* ignore */
  }
}

function previewKey(puzzleId: string): string {
  return `sportsmini:preview:${puzzleId}`
}

export function getPreviewSolve(puzzleId: string): SolveState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(previewKey(puzzleId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return migrateLegacyJson(parsed)
  } catch {
    return null
  }
}

export function savePreviewSolve(puzzleId: string, solve: SolveState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(previewKey(puzzleId), JSON.stringify(solve))
  } catch {
    /* ignore */
  }
}

export function clearPreviewSolve(puzzleId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(previewKey(puzzleId))
  } catch {
    /* ignore */
  }
}
