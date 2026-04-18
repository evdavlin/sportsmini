import Link from 'next/link'
import { getHistoryRows } from '@/lib/admin'

const s = {
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  border: '#D6D0C4',
  surface: '#FBFAF6',
}

function fmtAvg(sec: number | null, started: number) {
  if (started === 0) return '—'
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const r = sec % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, mo, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`
}

export default async function AdminHistoryPage() {
  const rows = await getHistoryRows()

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 24 }}>History</h1>
      <div style={{ overflowX: 'auto', border: `1px solid ${s.border}`, borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: s.surface }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${s.border}`, textAlign: 'left' }}>
              <th style={{ padding: 12 }}>Date</th>
              <th style={{ padding: 12 }}>Title</th>
              <th style={{ padding: 12 }}>Diff</th>
              <th style={{ padding: 12 }}>Status</th>
              <th style={{ padding: 12 }}>Solves</th>
              <th style={{ padding: 12 }}>Avg</th>
              <th style={{ padding: 12 }}>Completion</th>
              <th style={{ padding: 12 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct =
                r.started_count > 0 ? Math.round((r.solve_count / r.started_count) * 100) : 0
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${s.border}` }}>
                  <td style={{ padding: 12 }}>{fmtDate(r.publish_date)}</td>
                  <td style={{ padding: 12, fontWeight: 600 }}>{r.title ?? '—'}</td>
                  <td style={{ padding: 12 }}>{r.difficulty ?? '—'}</td>
                  <td style={{ padding: 12 }}>{r.status}</td>
                  <td style={{ padding: 12 }}>{r.solve_count}</td>
                  <td style={{ padding: 12, fontFamily: 'ui-monospace, monospace' }}>
                    {fmtAvg(r.avg_seconds, r.started_count)}
                  </td>
                  <td style={{ padding: 12 }}>
                    {r.started_count === 0 ? '—' : `${pct}%`}
                  </td>
                  <td style={{ padding: 12 }}>
                    <Link href={`/admin/puzzles/${r.id}`} style={{ color: s.hero, fontWeight: 600 }}>
                      Preview
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>No published or archived puzzles.</div>
      ) : null}
    </div>
  )
}
