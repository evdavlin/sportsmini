import type { PuzzlePayload } from '@/lib/puzzles'

const TOKENS = {
  bg: '#F0EEE9',
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  heroTint: '#DDE5EC',
  border: '#2B2B2B',
  borderSoft: '#D6D0C4',
  blackSquare: '#2B2B2B',
  keyBg: '#E9E4DB',
} as const

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M4 6h14M4 11h14M4 16h14"
        stroke={TOKENS.text}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LightbulbIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 18a6 6 0 1 0-4-10.5A4 4 0 1 0 12 18Z"
        stroke={TOKENS.textMuted}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 21h6M10 18h4"
        stroke={TOKENS.textMuted}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        transform: direction === 'left' ? 'rotate(180deg)' : undefined,
        display: 'block',
      }}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke={TOKENS.textMuted}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatPuzzleNumber(title: string | null): string {
  if (!title) return '#001'
  const m = title.match(/^Puzzle\s+#(\d+)$/i)
  if (m) return `#${m[1].padStart(3, '0')}`
  return '#001'
}

function formatPublishDate(publishDate: string): string {
  const [y, mo, day] = publishDate.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 1, day))
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
}

function buildNumberMap(puzzle: PuzzlePayload): Map<string, number> {
  const map = new Map<string, number>()
  for (const clue of [...puzzle.across, ...puzzle.down]) {
    const key = `${clue.row},${clue.col}`
    if (!map.has(key)) map.set(key, clue.num)
  }
  return map
}

type SolveScreenProps = {
  puzzle: PuzzlePayload
}

export default function SolveScreen({ puzzle }: SolveScreenProps) {
  const numberMap = buildNumberMap(puzzle)
  const metaCenter = `${formatPuzzleNumber(puzzle.title)} · ${formatPublishDate(puzzle.publish_date)}`
  const firstAcross = puzzle.across[0]

  const innerSize = 360 - 4
  const cellW = innerSize / puzzle.width
  const cellH = innerSize / puzzle.height
  const cellMin = Math.min(cellW, cellH)
  const letterFontSize = cellMin * 0.55
  const numberFontSize = Math.max(9, cellMin * 0.18)

  const row1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
  const row2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L']
  const row3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M']

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: TOKENS.bg,
        color: TOKENS.text,
        fontFamily: 'system-ui, sans-serif',
        paddingBottom: 24,
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <MenuIcon />
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 900,
              letterSpacing: '2px',
              fontSize: 20,
              textTransform: 'uppercase',
              color: TOKENS.text,
            }}
          >
            SPORTS WORDS
          </div>
          <div
            style={{
              width: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            <span aria-hidden>🔥</span>
            <span>0</span>
          </div>
        </div>

        <div
          style={{
            height: 1,
            backgroundColor: TOKENS.borderSoft,
            marginLeft: 20,
            marginRight: 20,
          }}
        />

        {/* Timer row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px 16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
              fontSize: 18,
              fontWeight: 600,
              color: TOKENS.text,
            }}
          >
            0:00
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 13,
              color: TOKENS.textMuted,
              fontWeight: 500,
            }}
          >
            {metaCenter}
          </div>
          <div style={{ width: 44, display: 'flex', justifyContent: 'flex-end' }}>
            <LightbulbIcon />
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
          <div
            style={{
              width: 360,
              height: 360,
              boxSizing: 'border-box',
              border: `2px solid ${TOKENS.border}`,
              display: 'grid',
              gridTemplateColumns: `repeat(${puzzle.width}, 1fr)`,
              gridTemplateRows: `repeat(${puzzle.height}, 1fr)`,
            }}
          >
            {puzzle.grid.map((row, r) =>
              row.map((cell, c) => {
                const isBlack = cell === '#'
                const key = `${r},${c}`
                const clueNum = !isBlack ? numberMap.get(key) : undefined
                return (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      position: 'relative',
                      boxSizing: 'border-box',
                      backgroundColor: isBlack ? TOKENS.blackSquare : TOKENS.surface,
                      borderTop: r > 0 ? `1px solid ${TOKENS.border}` : undefined,
                      borderLeft: c > 0 ? `1px solid ${TOKENS.border}` : undefined,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!isBlack && clueNum !== undefined ? (
                      <span
                        style={{
                          position: 'absolute',
                          left: 2,
                          top: 1,
                          fontSize: numberFontSize,
                          lineHeight: 1,
                          fontWeight: 600,
                          color: TOKENS.textMuted,
                          pointerEvents: 'none',
                        }}
                      >
                        {clueNum}
                      </span>
                    ) : null}
                    {!isBlack ? (
                      <span
                        style={{
                          fontSize: letterFontSize,
                          fontWeight: 700,
                          color: TOKENS.text,
                          lineHeight: 1,
                          userSelect: 'none',
                        }}
                      >
                        {'\u00a0'}
                      </span>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Active clue bar */}
        {firstAcross ? (
          <div
            style={{
              marginTop: 20,
              backgroundColor: TOKENS.heroTint,
              borderTop: `1px solid ${TOKENS.borderSoft}`,
              borderBottom: `1px solid ${TOKENS.borderSoft}`,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxSizing: 'border-box',
            }}
          >
            <ChevronIcon direction="left" />
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: TOKENS.textMuted,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {firstAcross.num} ACROSS
              </div>
              <div style={{ fontSize: 15, color: TOKENS.text, lineHeight: 1.35, fontWeight: 500 }}>
                {firstAcross.clue}
              </div>
            </div>
            <ChevronIcon direction="right" />
          </div>
        ) : null}

        {/* Keyboard */}
        <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {row1.map((k) => (
              <div
                key={k}
                style={{
                  flex: 1,
                  maxWidth: 40,
                  height: 42,
                  borderRadius: 6,
                  backgroundColor: TOKENS.keyBg,
                  border: `1px solid ${TOKENS.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: TOKENS.text,
                  userSelect: 'none',
                }}
              >
                {k}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              justifyContent: 'center',
              paddingLeft: 16,
              paddingRight: 16,
              boxSizing: 'border-box',
            }}
          >
            {row2.map((k) => (
              <div
                key={k}
                style={{
                  flex: 1,
                  maxWidth: 40,
                  height: 42,
                  borderRadius: 6,
                  backgroundColor: TOKENS.keyBg,
                  border: `1px solid ${TOKENS.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: TOKENS.text,
                  userSelect: 'none',
                }}
              >
                {k}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'stretch' }}>
            {row3.map((k) => (
              <div
                key={k}
                style={{
                  flex: 1,
                  maxWidth: 40,
                  height: 42,
                  borderRadius: 6,
                  backgroundColor: TOKENS.keyBg,
                  border: `1px solid ${TOKENS.borderSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: TOKENS.text,
                  userSelect: 'none',
                }}
              >
                {k}
              </div>
            ))}
            <div
              style={{
                flex: 1.5,
                maxWidth: 50,
                minWidth: 0,
                height: 42,
                borderRadius: 6,
                backgroundColor: TOKENS.keyBg,
                border: `1px solid ${TOKENS.borderSoft}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 600,
                color: TOKENS.text,
                userSelect: 'none',
              }}
            >
              ⌫
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
