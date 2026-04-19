'use client'

import type { ReactNode } from 'react'

import { GridDisplay, StatCard, theme, type GridData } from '@/app/components/theme'

/** Demo grid for the tutorial — static shape with numbered starts and sample letters */
const DEMO_GRID: GridData = [
  [
    { number: 1, letter: 'S' },
    { letter: 'P' },
    { letter: 'O' },
    { letter: 'R' },
    { letter: 'T' },
  ],
  [
    { number: 2, letter: '' },
    null,
    { letter: '' },
    null,
    { letter: '' },
  ],
  [
    { number: 3, letter: '' },
    { letter: '' },
    { letter: '' },
    null,
    { letter: '' },
  ],
  [
    null,
    { letter: '' },
    { letter: '' },
    { letter: '' },
    { letter: '' },
  ],
  [
    { number: 4, letter: '' },
    { letter: '' },
    null,
    { letter: '' },
    { letter: '' },
  ],
]

function CloseIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 2,
        padding: 8,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        lineHeight: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M18 6L6 18M6 6l12 12"
          stroke={theme.text}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function LightbulbInline({ color = theme.hero }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}
    >
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

function HowToSection({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children: ReactNode
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: theme.hero,
          marginBottom: 10,
          textTransform: 'uppercase',
        }}
      >
        {kicker} · {title}
      </div>
      {children}
    </section>
  )
}

function HintRow({
  label,
  description,
}: {
  label: string
  description: ReactNode
}) {
  return (
    <div
      style={{
        padding: '14px 0',
        borderBottom: `1px solid ${theme.borderSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2,
          color: theme.text,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.45 }}>{description}</div>
    </div>
  )
}

export default function HowToPlayScreen({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: theme.bg,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <CloseIcon onClick={onClose} />

      <div style={{ padding: '56px 24px 40px', maxWidth: 420, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 26,
            fontWeight: 900,
            color: theme.text,
            margin: '0 0 8px',
            letterSpacing: -0.5,
            textAlign: 'center',
          }}
        >
          How to Play
        </h1>
        <p style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', margin: '0 0 32px' }}>
          Sports Words Mini in under a minute.
        </p>

        <HowToSection kicker="01" title="The grid">
          <p style={{ fontSize: 14, color: theme.text, lineHeight: 1.5, margin: '0 0 16px' }}>
            Fill every white square so words match the clues. Numbers show where Across and Down answers
            begin — words read left→right and top→bottom.
          </p>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <GridDisplay data={DEMO_GRID} size={200} />
          </div>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: 0, lineHeight: 1.45 }}>
            Tap a square to move the cursor. Use the on-screen keyboard or your device keyboard to type
            letters. Black squares separate words.
          </p>
        </HowToSection>

        <HowToSection kicker="02" title="Tools">
          <p style={{ fontSize: 14, color: theme.text, margin: '0 0 8px', lineHeight: 1.5 }}>
            <LightbulbInline />
            While solving, three actions sit under the grid:
          </p>
          <div style={{ marginTop: 4 }}>
            <HintRow
              label="CHECK"
              description="Flags any wrong letters in red so you can fix them."
            />
            <HintRow
              label="HINT"
              description={
                <>
                  Fills one cell you&apos;re stuck on. Each hint{' '}
                  <strong style={{ color: theme.text }}>counts as a hint</strong> on your final result.
                </>
              }
            />
            <HintRow
              label="REVEAL"
              description={
                <>
                  Shows the full answer at once. Your solve is{' '}
                  <strong style={{ color: theme.text }}>marked revealed</strong> — share it with care.
                </>
              }
            />
          </div>
        </HowToSection>

        <HowToSection kicker="03" title="After you finish">
          <p style={{ fontSize: 14, color: theme.text, lineHeight: 1.5, margin: '0 0 16px' }}>
            When the grid is complete, you&apos;ll see your time and how it stacks up against everyone who
            played today.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard label="Your time" value="2:34" />
            <StatCard label="vs everyone" value="Top 12%" />
          </div>
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 28,
              textAlign: 'center',
              fontSize: 14,
              color: theme.text,
              lineHeight: 1.45,
            }}
          >
            <span aria-hidden style={{ marginRight: 6 }}>
              🔥
            </span>
            Come back each day to build a streak — consecutive solves keep the flame alive.
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              background: theme.hero,
              color: theme.heroOnDark,
              border: 'none',
              padding: '16px 24px',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 3,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            GOT IT
          </button>
        </HowToSection>
      </div>
    </div>
  )
}
