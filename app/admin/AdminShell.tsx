'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const a = {
  bg: '#F0EEE9',
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  border: '#D6D0C4',
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const path = usePathname()
  const active = path === href || (href !== '/admin' && path.startsWith(href))
  return (
    <Link
      href={href}
      style={{
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? a.text : a.textMuted,
        borderBottom: active ? `2px solid ${a.hero}` : `2px solid transparent`,
        paddingBottom: 4,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: a.bg, fontFamily: 'system-ui, sans-serif', color: a.text }}>
      <div
        style={{
          background: a.surface,
          borderBottom: `1px solid ${a.border}`,
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 900,
              fontSize: 17,
              letterSpacing: 1.5,
              color: a.text,
            }}
          >
            SPORTS WORDS<span style={{ color: a.hero, marginLeft: 8 }}>/ ADMIN</span>
          </div>
          <nav style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <NavLink href="/admin">Dashboard</NavLink>
            <NavLink href="/admin/queue">Queue</NavLink>
            <NavLink href="/admin/drafts">Drafts</NavLink>
            <NavLink href="/admin/history">History</NavLink>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: a.textMuted }}>admin@sportswords.app</span>
          <Link
            href="/admin/new"
            style={{
              background: a.hero,
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            + New Puzzle
          </Link>
        </div>
      </div>
      <div style={{ padding: '28px 32px 48px', maxWidth: 1100, margin: '0 auto' }}>{children}</div>
    </div>
  )
}
