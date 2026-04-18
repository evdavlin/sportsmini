'use client'

import { useMemo } from 'react'
import { getMockStats } from '@/lib/mock-stats'
import { AppHeader, DistBar, StatCard, theme } from './theme'

export default function StatsScreen() {
  const stats = useMemo(() => getMockStats(null), [])

  const maxDist = Math.max(...stats.distribution.map((d) => d.count), 1)

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <AppHeader streak={stats.streak} />

        <div style={{ padding: '24px 24px 40px' }}>
          <h2
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 1,
              margin: '0 0 24px',
              color: theme.text,
            }}
          >
            YOUR STATS
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              marginBottom: 32,
            }}
          >
            <StatCard label="Current Streak" value={`🔥 ${stats.streak}`} />
            <StatCard label="Best Streak" value={String(stats.bestStreak)} />
            <StatCard label="Played" value={String(stats.played)} />
            <StatCard label="Win Rate" value={`${stats.winRate}%`} />
          </div>

          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                color: theme.textMuted,
                marginBottom: 14,
              }}
            >
              SOLVE TIME DISTRIBUTION
            </div>
            {stats.distribution.map((b, i) => (
              <DistBar key={b.label} {...b} max={maxDist} />
            ))}
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                color: theme.textMuted,
                marginBottom: 14,
              }}
            >
              LAST 7 DAYS
            </div>
            {stats.recentDays.length === 0 ? (
              <div style={{ fontSize: 13, color: theme.textMuted }}>No solves yet.</div>
            ) : (
              stats.recentDays.map((d, i) => (
                <div
                  key={`${d.date}-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom:
                      i < stats.recentDays.length - 1 ? `1px solid ${theme.borderSoft}` : 'none',
                    fontSize: 13,
                    color: theme.text,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{d.date}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>{d.time}</span>
                  <span style={{ color: theme.textMuted }}>{d.rank}</span>
                  <span>{d.streak ? '🔥' : ''}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
