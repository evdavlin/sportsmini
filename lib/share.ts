/** Puzzle #1 launches 2026-04-18 (UTC calendar days). */
const LAUNCH_UTC_MS = Date.UTC(2026, 3, 18)

export function getPuzzleNumber(publishDate: string): number {
  const [y, mo, d] = publishDate.split('-').map(Number)
  const dayUtc = Date.UTC(y, mo - 1, d)
  const diffDays = Math.floor((dayUtc - LAUNCH_UTC_MS) / 86400000)
  return diffDays + 1
}

export function formatPuzzleNumber(n: number): string {
  return `#${String(n).padStart(3, '0')}`
}

/** Format as M:SS (e.g. 107 → "1:47"). */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function buildEmojiGrid(pattern: string[], hintedCells: string[]): string {
  const hintSet = new Set(hintedCells)
  return pattern
    .map((row, r) =>
      row
        .split('')
        .map((ch, c) => {
          if (ch === '#') return '⬛'
          const key = `${r}-${c}`
          return hintSet.has(key) ? '🟨' : '🟦'
        })
        .join('')
    )
    .join('\n')
}

/** Black (#) vs letter cell (.) for emoji map — use puzzle grid letters as non-#. */
export function gridToPattern(grid: string[][]): string[] {
  return grid.map((row) =>
    row.map((cell) => (cell === '#' ? '#' : '.')).join('')
  )
}

export function buildShareString(opts: {
  puzzleNumber: number
  timeSeconds: number
  percentile: number
  streak: number
  hintCount: number
  pattern: string[]
  hintedCells: string[]
}): string {
  const title = `Sports Words ${formatPuzzleNumber(opts.puzzleNumber)}`
  const statsParts: string[] = [
    `⏱ ${formatTime(opts.timeSeconds)}`,
    `Top ${opts.percentile}%`,
  ]
  if (opts.streak > 0) statsParts.push(`🔥 Day ${opts.streak}`)
  if (opts.hintCount > 0)
    statsParts.push(`${opts.hintCount} hint${opts.hintCount === 1 ? '' : 's'}`)
  const statsLine = statsParts.join(' · ')
  const gridBlock = buildEmojiGrid(opts.pattern, opts.hintedCells)
  return `${title}\n${statsLine}\n\n${gridBlock}\n\nsportswords.app`
}

/** Next instant when America/New_York clock shows 07:00 (whole minute). */
export function getNext7amEastern(now: Date = new Date()): Date {
  let t = new Date(now.getTime())
  t.setSeconds(0, 0)
  if (t <= now) t = new Date(t.getTime() + 60000)
  for (let i = 0; i < 72 * 60; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(t)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
    if (hour === 7 && minute === 0 && t.getTime() > now.getTime()) return t
    t = new Date(t.getTime() + 60000)
  }
  return new Date(now.getTime() + 24 * 3600 * 1000)
}

export function formatNextPuzzleInEt(now: Date = new Date()): string {
  const next = getNext7amEastern(now)
  const ms = Math.max(0, next.getTime() - now.getTime())
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return `${h}h ${m}m`
}
