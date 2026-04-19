'use client'

import Link from 'next/link'

export const theme = {
  bg: '#F0EEE9',
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  heroTint: '#DDE5EC',
  heroOnDark: '#FBFAF6',
  accent: '#5E9BBE',
  border: '#2B2B2B',
  borderSoft: '#D6D0C4',
  error: '#A8505A',
  success: '#5E8A6E',
  blackSquare: '#2B2B2B',
  keyBg: '#E9E4DB',
  keyText: '#2B2B2B',
  gold: '#D9C36A',
  /** Admin preview — status badge (puzzle row state) */
  statusDraftBg: '#E5E0D5',
  statusDraft: '#8B8680',
  statusQueuedBg: '#DDE5EC',
  statusQueued: '#3D5F7A',
  statusLiveBg: '#DCE7E0',
  statusLive: '#5E8A6E',
  statusArchivedBg: '#EEEAE0',
  statusArchived: '#A09B91',
} as const

export function MenuIcon({ color = theme.text }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="18" x2="21" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function LightbulbIcon({ color = theme.textMuted }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3v1h6v-1c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronIcon({
  direction,
  color = theme.text,
  onClick,
}: {
  direction: 'left' | 'right'
  color?: string
  onClick?: () => void
}) {
  const svg = (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : 'none', display: 'block' }}
    >
      <polyline points="9 18 15 12 9 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={direction === 'left' ? 'Previous clue' : 'Next clue'}
        style={{
          padding: 0,
          margin: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          lineHeight: 0,
        }}
      >
        {svg}
      </button>
    )
  }

  return svg
}

export function ShareIcon({ color = '#FFFFFF', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CheckIcon({ color = '#FFFFFF', size = 26 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export type GridCell = null | { letter: string; number?: number; wrong?: boolean }
export type GridData = GridCell[][]

function cellKey(r: number, c: number) {
  return `${r},${c}`
}

export type GridDisplayProps = {
  data: GridData
  size?: number
  selectedCell?: { row: number; col: number } | null
  activeWordSet?: Set<string>
  wrongSet?: Set<string>
  onCellClick?: (row: number, col: number) => void
}

export function GridDisplay({
  data,
  size = 364,
  selectedCell,
  activeWordSet,
  wrongSet,
  onCellClick,
}: GridDisplayProps) {
  const rows = data.length
  const cols = data[0]?.length ?? 0
  const letterSize = Math.round((size / Math.max(cols, rows)) * 0.55)
  const numberSize = Math.max(10, Math.round((size / Math.max(cols, rows)) * 0.18))

  return (
    <div
      style={{
        width: size,
        height: size,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 0,
        border: `2px solid ${theme.border}`,
        boxSizing: 'border-box',
      }}
    >
      {data.flat().map((cell, i) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        const isBlack = cell === null
        const key = cellKey(r, c)
        const selected = selectedCell?.row === r && selectedCell?.col === c
        const inActiveWord = activeWordSet?.has(key) ?? false
        const wrongFromSet = wrongSet?.has(key) ?? false

        if (isBlack) {
          return (
            <div
              key={key}
              style={{
                background: theme.blackSquare,
                borderRight: c < cols - 1 ? `1px solid ${theme.border}` : 'none',
                borderBottom: r < rows - 1 ? `1px solid ${theme.border}` : 'none',
                boxSizing: 'border-box',
              }}
            />
          )
        }

        const wrong = Boolean(cell?.wrong || wrongFromSet)
        const isActiveWord = inActiveWord && !selected

        let bg: string = theme.surface
        if (selected) bg = theme.hero
        else if (isActiveWord) bg = theme.heroTint

        const letterColor: string = wrong
          ? theme.error
          : selected
            ? theme.heroOnDark
            : theme.text
        const numColor: string = selected ? theme.heroOnDark : theme.textMuted
        const letter = cell?.letter ?? ''
        const showNum = cell?.number !== undefined && cell?.number !== null

        const interactive = Boolean(onCellClick)

        return (
          <div
            key={key}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onCellClick?.(r, c) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onCellClick?.(r, c)
                    }
                  }
                : undefined
            }
            style={{
              background: bg,
              borderRight: c < cols - 1 ? `1px solid ${theme.border}` : 'none',
              borderBottom: r < rows - 1 ? `1px solid ${theme.border}` : 'none',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              cursor: interactive ? 'pointer' : 'default',
            }}
          >
            {showNum ? (
              <span
                style={{
                  position: 'absolute',
                  top: Math.max(2, size / cols * 0.07),
                  left: Math.max(3, size / cols * 0.09),
                  fontSize: numberSize,
                  fontWeight: 500,
                  color: numColor,
                  pointerEvents: 'none',
                }}
              >
                {cell!.number}
              </span>
            ) : null}
            <span
              style={{
                fontSize: letterSize,
                fontWeight: 700,
                color: letterColor,
                textDecoration: wrong ? 'line-through' : 'none',
                textDecorationColor: theme.error,
                textDecorationThickness: '2px',
                userSelect: 'none',
              }}
            >
              {letter || '\u00a0'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export type AppHeaderProps = {
  streak?: number
  showTimer?: boolean
  timer?: string
  puzzleMeta?: string
}

export function AppHeader({
  streak = 0,
  showTimer = false,
  timer = '00:00',
  puzzleMeta = '',
}: AppHeaderProps) {
  return (
    <>
      <div
        style={{
          padding: '14px 20px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          href="/"
          aria-label="Home"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
        >
          <MenuIcon color={theme.text} />
        </Link>
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: 2,
            color: theme.text,
          }}
        >
          SPORTS WORDS
        </div>
        <Link
          href="/stats"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: theme.text,
            textDecoration: 'none',
            minWidth: 44,
            justifyContent: 'flex-end',
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>
            🔥
          </span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{streak}</span>
        </Link>
      </div>
      <div style={{ height: 1, background: theme.borderSoft, margin: '0 20px' }} />
      {showTimer ? (
        <div
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 18,
              fontWeight: 600,
              color: theme.text,
              letterSpacing: 1,
            }}
          >
            {timer}
          </div>
          <div style={{ color: theme.textMuted, fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>
            {puzzleMeta}
          </div>
          <LightbulbIcon color={theme.text} />
        </div>
      ) : null}
    </>
  )
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: theme.textMuted,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{value}</div>
    </div>
  )
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.borderSoft}`,
        borderRadius: 6,
        padding: '18px 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 28,
          fontWeight: 900,
          color: theme.text,
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1,
          color: theme.textMuted,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  )
}

export function DistBar({
  label,
  count,
  max,
  highlight,
}: {
  label: string
  count: number
  max: number
  highlight?: boolean
}) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: 'ui-monospace, monospace',
          color: theme.textMuted,
          width: 48,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, height: 20, background: 'transparent' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: highlight ? theme.hero : theme.borderSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 6,
            color: highlight ? theme.heroOnDark : theme.text,
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {count}
        </div>
      </div>
    </div>
  )
}

export function formatPuzzleNumberFromTitle(title: string | null): string {
  if (!title) return '#001'
  const m = title.match(/^Puzzle\s+#(\d+)$/i)
  if (m) return `#${m[1].padStart(3, '0')}`
  return '#001'
}

export function formatMetaDateLine(publishDate: string): string {
  const [y, mo, day] = publishDate.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 1, day))
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function formatShortMonthDay(publishDate: string): string {
  const [y, mo, day] = publishDate.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 1, day))
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function formatPublishDateCompact(publishDate: string): string {
  const [y, mo, day] = publishDate.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 1, day))
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatElapsedDisplay(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Next local calendar day at 07:00 (user's local timezone). */
export function getNextLocal7am(from: Date = new Date()): Date {
  const next = new Date(from)
  next.setHours(7, 0, 0, 0)
  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

export function formatCountdownParts(ms: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { h, m, s }
}

export function formatNextPuzzleLine(next: Date): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${months[next.getMonth()]} ${next.getDate()} · 7:00 AM`
}
