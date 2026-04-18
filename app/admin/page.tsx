import Link from 'next/link'
import {
  getAdminPuzzles,
  getPipelineSummary,
  projectedPublishDate,
  type AdminPuzzle,
} from '@/lib/admin'

const s = {
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  border: '#D6D0C4',
  warn: '#B87A3D',
  warnTint: '#F5E4D0',
  error: '#A8505A',
  errorTint: '#F2DDE0',
  success: '#5E8A6E',
  successTint: '#DCE7E0',
}

function MiniGrid({ pattern }: { pattern: string[] }) {
  const rows = pattern.length
  const cols = pattern[0]?.length ?? 0
  const sz = 36
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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${mo[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`
}

export default async function AdminDashboardPage() {
  const pipeline = await getPipelineSummary()
  const queued = await getAdminPuzzles({ status: ['queued'] })
  const drafts = await getAdminPuzzles({ status: ['draft'] })

  const qc = pipeline.queue_count ?? 0
  const staleDrafts = drafts.filter(
    (d) => Date.now() - new Date(d.updated_at).getTime() > 14 * 86400 * 1000
  ).length

  const live = pipeline.live_puzzle as Record<string, unknown> | null
  const livePattern =
    live &&
    typeof live.grid === 'object' &&
    live.grid &&
    Array.isArray((live.grid as { pattern?: unknown }).pattern)
      ? ((live.grid as { pattern: string[] }).pattern ?? [])
      : null

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>Dashboard</h1>
        <div style={{ color: s.textMuted, fontSize: 14 }}>Pipeline overview & schedule</div>
      </div>

      {qc === 0 ? (
        <div
          style={{
            background: s.errorTint,
            border: `1px solid ${s.error}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            color: s.text,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Queue empty — next rollover will have no puzzle</div>
          <div style={{ fontSize: 13 }}>Add drafts to the queue before the daily publish job runs.</div>
        </div>
      ) : qc < 3 ? (
        <div
          style={{
            background: s.warnTint,
            border: `1px solid ${s.warn}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700 }}>Queue runs out in {qc} days</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Maintain at least 3 queued puzzles for safety.</div>
        </div>
      ) : null}

      {staleDrafts > 0 ? (
        <div
          style={{
            background: s.warnTint,
            border: `1px solid ${s.warn}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {staleDrafts} stale draft{staleDrafts === 1 ? '' : 's'} (14d+ untouched)
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 24,
          marginBottom: 28,
        }}
      >
        <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: s.textMuted, marginBottom: 8 }}>
            CURRENTLY LIVE
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Today&apos;s puzzle</div>
          {live && livePattern?.length ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <MiniGrid pattern={livePattern} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{String(live.title ?? '')}</div>
                <div style={{ fontSize: 13, color: s.textMuted }}>
                  {fmtDate(live.publish_date as string)} · Difficulty {String(live.difficulty ?? '—')}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: s.textMuted }}>No puzzle live right now.</div>
          )}
        </div>

        <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: s.textMuted, marginBottom: 8 }}>
            BACKLOG HEALTH
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>At a glance</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: s.textMuted }}>Queued</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: qc < 3 ? s.warn : s.success }}>{qc}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: s.textMuted }}>Drafts</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{pipeline.draft_count ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: s.textMuted }}>Published</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{pipeline.published_count ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: s.textMuted }}>Archived</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{pipeline.archived_count ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: s.textMuted, marginBottom: 12 }}>
          NEXT 7 DAYS (QUEUE)
        </div>
        <div style={{ overflowX: 'auto' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((slot) => {
            const q = queued.find((x) => x.queue_position === slot)
            const proj = q ? projectedPublishDate(q.queue_position!) : null
            const pat =
              q &&
              typeof q.grid === 'object' &&
              q.grid &&
              Array.isArray((q.grid as { pattern?: string[] }).pattern)
                ? (q.grid as { pattern: string[] }).pattern
                : null
            return (
              <div
                key={slot}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: `1px solid ${s.border}`,
                  background: slot === 1 ? '#DDE5EC22' : undefined,
                }}
              >
                <div style={{ width: 48, fontWeight: 700 }}>#{slot}</div>
                <div style={{ width: 120, fontSize: 13 }}>
                  {proj ? fmtDate(proj) : '—'}
                  <div style={{ fontSize: 11, color: s.textMuted }}>{q ? `pos ${q.queue_position}` : 'empty'}</div>
                </div>
                <div style={{ flex: 1, fontWeight: 600 }}>{q?.title ?? <span style={{ color: s.warn }}>Empty slot</span>}</div>
                <div style={{ width: 44 }}>{pat ? <MiniGrid pattern={pat} /> : '—'}</div>
              </div>
            )
          })}
        </div>
        <Link href="/admin/queue" style={{ display: 'inline-block', marginTop: 16, color: s.hero, fontWeight: 600 }}>
          Manage queue →
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link
          href="/admin/queue"
          style={{
            padding: '12px 20px',
            border: `1px solid ${s.border}`,
            borderRadius: 6,
            textDecoration: 'none',
            color: s.text,
            fontWeight: 600,
          }}
        >
          Queue
        </Link>
        <Link
          href="/admin/drafts"
          style={{
            padding: '12px 20px',
            border: `1px solid ${s.border}`,
            borderRadius: 6,
            textDecoration: 'none',
            color: s.text,
            fontWeight: 600,
          }}
        >
          Drafts
        </Link>
        <Link
          href="/admin/new"
          style={{
            padding: '12px 20px',
            background: s.hero,
            color: '#fff',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          New puzzle
        </Link>
      </div>
    </div>
  )
}
