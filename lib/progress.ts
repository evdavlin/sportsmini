export type TodaySolve = {
  puzzle_id: string
  publish_date: string
  time_seconds: number
  hints_used: number
  entered: Record<string, string>
  solved_at: string
}

function storageKey(publishDate: string): string {
  return `sportsmini:solve:${publishDate}`
}

export function getTodaySolve(publishDate: string): TodaySolve | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(publishDate))
    if (!raw) return null
    return JSON.parse(raw) as TodaySolve
  } catch {
    return null
  }
}

export function saveTodaySolve(solve: TodaySolve): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(solve.publish_date), JSON.stringify(solve))
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

export function getPreviewSolve(puzzleId: string): TodaySolve | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(previewKey(puzzleId))
    if (!raw) return null
    return JSON.parse(raw) as TodaySolve
  } catch {
    return null
  }
}

export function savePreviewSolve(puzzleId: string, solve: TodaySolve): void {
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
