import Link from 'next/link'
import { getAdminPuzzles, projectedPublishDate } from '@/lib/admin'
import { queueMoveDown, queueMoveUp, queueRemoveAction } from '@/app/admin/actions'

const s = {
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  border: '#D6D0C4',
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

function fmt(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${mo[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`
}

export default async function AdminQueuePage() {
  const queued = await getAdminPuzzles({ status: ['queued'] })

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Queue</h1>
      <p style={{ color: s.textMuted, marginBottom: 24 }}>Reorder with ▲ / ▼. Remove pulls a puzzle back to drafts (per RPC).</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {queued.map((q, index) => {
          const pat =
            typeof q.grid === 'object' &&
            q.grid &&
            Array.isArray((q.grid as { pattern?: string[] }).pattern)
              ? (q.grid as { pattern: string[] }).pattern
              : []
          const proj = q.queue_position != null ? projectedPublishDate(q.queue_position) : null
          return (
            <div
              key={q.id}
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
              <div style={{ fontSize: 32, fontWeight: 900, color: s.hero, minWidth: 48 }}>{q.queue_position}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{q.title}</div>
                <div style={{ fontSize: 13, color: s.textMuted }}>
                  {proj ? fmt(proj) : '—'} · diff {q.difficulty ?? '—'} · {q.clue_count} clues
                </div>
              </div>
              {pat.length ? <MiniGrid pattern={pat} /> : null}
              <Link
                href={`/admin/puzzles/${q.id}`}
                style={{ color: s.hero, fontWeight: 600, fontSize: 14 }}
              >
                Preview
              </Link>
              <form action={queueMoveUp.bind(null, q.id)}>
                <button
                  type="submit"
                  disabled={index === 0}
                  style={{ padding: '8px 12px', marginRight: 4, cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                >
                  ▲
                </button>
              </form>
              <form action={queueMoveDown.bind(null, q.id)}>
                <button
                  type="submit"
                  disabled={index === queued.length - 1}
                  style={{
                    padding: '8px 12px',
                    cursor: index === queued.length - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ▼
                </button>
              </form>
              <form action={queueRemoveAction.bind(null, q.id)}>
                <button type="submit" style={{ padding: '8px 12px', color: '#a50' }}>
                  Remove
                </button>
              </form>
            </div>
          )
        })}
      </div>

      {queued.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>Queue is empty.</div>
      ) : null}
    </div>
  )
}
