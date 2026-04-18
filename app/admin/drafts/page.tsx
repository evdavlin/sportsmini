import Link from 'next/link'
import { getAdminPuzzles } from '@/lib/admin'
import { queueAddAction } from '@/app/admin/actions'
import { DeleteDraftButton } from '@/app/admin/drafts/DeleteDraftButton'

const s = {
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  border: '#D6D0C4',
  warn: '#B87A3D',
}

function MiniGrid({ pattern }: { pattern: string[] }) {
  const rows = pattern.length
  const cols = pattern[0]?.length ?? 0
  const sz = 40
  return (
    <div
      style={{
        width: sz,
        height: sz,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        border: `1px solid ${s.text}`,
        boxSizing: 'border-box',
      }}
    >
      {pattern.flatMap((row, r) =>
        row.split('').map((ch, c) => (
          <div
            key={`${r}-${c}`}
            style={{
              background: ch === '#' ? s.text : '#fff',
              borderRight: c < cols - 1 ? `1px solid ${s.border}` : undefined,
              borderBottom: r < rows - 1 ? `1px solid ${s.border}` : undefined,
            }}
          />
        ))
      )}
    </div>
  )
}

export default async function AdminDraftsPage() {
  const drafts = await getAdminPuzzles({ status: ['draft'] })

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Drafts</h1>
      <p style={{ color: s.textMuted, marginBottom: 24 }}>Ship to queue when ready.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {drafts.map((d) => {
          const pat =
            typeof d.grid === 'object' &&
            d.grid &&
            Array.isArray((d.grid as { pattern?: string[] }).pattern)
              ? (d.grid as { pattern: string[] }).pattern
              : []
          const stale = Date.now() - new Date(d.updated_at).getTime() > 14 * 86400 * 1000
          return (
            <div
              key={d.id}
              style={{
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {pat.length ? <MiniGrid pattern={pat} /> : null}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 13, color: s.textMuted }}>
                  diff {d.difficulty ?? '—'} · {d.clue_count} clues · created{' '}
                  {new Date(d.created_at).toLocaleString()}
                </div>
                {stale ? (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      color: s.warn,
                      border: `1px solid ${s.warn}`,
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    STALE 14d+
                  </span>
                ) : null}
              </div>
              <Link href={`/admin/puzzles/${d.id}`} style={{ color: s.hero, fontWeight: 600 }}>
                Preview
              </Link>
              <form action={queueAddAction.bind(null, d.id)}>
                <button type="submit" style={{ padding: '8px 14px', background: s.hero, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>
                  Add to Queue
                </button>
              </form>
              <DeleteDraftButton puzzleId={d.id} />
            </div>
          )
        })}
      </div>

      {drafts.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>No drafts.</div>
      ) : null}
    </div>
  )
}
