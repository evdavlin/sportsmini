import type { SolveState } from '@/lib/progress'

export type MockStats = {
  streak: number
  bestStreak: number
  played: number
  winRate: number
  avgSeconds: number
  distribution: Array<{ label: string; count: number; highlight?: boolean }>
  recentDays: Array<{ date: string; time: string; rank: string; streak: boolean }>
}

const DISTRIBUTION: MockStats['distribution'] = [
  { label: '<1min', count: 4 },
  { label: '1-2min', count: 12 },
  { label: '2-3min', count: 15, highlight: true },
  { label: '3-4min', count: 8 },
  { label: '4-5min', count: 2 },
  { label: '5min+', count: 1 },
]

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function percentileFromTime(seconds: number): number {
  return Math.min(35, Math.max(8, Math.floor(seconds / 10)))
}

export function getMockStats(solve: SolveState | null, publishDate?: string): MockStats {
  if (solve?.completed) {
    const rank = `Top ${percentileFromTime(solve.timeSeconds)}%`
    const dateShort = (() => {
      if (!publishDate) return ''
      const [y, mo, d] = publishDate.split('-').map(Number)
      const dt = new Date(Date.UTC(y, mo - 1, d))
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}`
    })()

    return {
      streak: 1,
      bestStreak: 1,
      played: 1,
      winRate: 100,
      avgSeconds: solve.timeSeconds,
      distribution: DISTRIBUTION,
      recentDays: [
        {
          date: dateShort,
          time: formatTimeShort(solve.timeSeconds),
          rank,
          streak: true,
        },
      ],
    }
  }

  return {
    streak: 0,
    bestStreak: 0,
    played: 0,
    winRate: 0,
    avgSeconds: 0,
    distribution: DISTRIBUTION,
    recentDays: [],
  }
}
