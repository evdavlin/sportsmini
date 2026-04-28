import Link from 'next/link'

import { DeleteShapeTemplateButton } from '@/app/admin/shapes/DeleteShapeTemplateButton'
import { ShapeGenerateButton } from '@/app/admin/shapes/ShapeGenerateButton'
import { getShapeTemplates } from '@/lib/admin'

export const dynamic = 'force-dynamic'

const s = {
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  border: '#D6D0C4',
  bg: '#F0EEE9',
}

function ShapePreviewGrid({ pattern }: { pattern: string[] }) {
  const rows = pattern.length
  const cols = pattern[0]?.length ?? 0
  const box = 120
  const cell = rows && cols ? Math.min(Math.floor(box / cols), Math.floor(box / rows), 24) : 12
  const w = cols * cell
  const h = rows * cell
  return (
    <div
      style={{
        width: box,
        height: box,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: s.bg,
        borderRadius: 6,
        border: `1px solid ${s.border}`,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: w,
          height: h,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
          gridTemplateRows: `repeat(${rows}, ${cell}px)`,
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
          )),
        )}
      </div>
    </div>
  )
}

export default async function AdminShapesPage() {
  const shapes = await getShapeTemplates()

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Shapes</h1>
          <p style={{ color: s.textMuted, margin: 0 }}>Grid templates for the generator (status: shape_template).</p>
        </div>
        <Link
          href="/admin/builder?mode=shape"
          style={{
            padding: '10px 18px',
            background: s.hero,
            color: '#fff',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          New Shape
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {shapes.map((row) => {
          const pat =
            typeof row.grid === 'object' &&
            row.grid &&
            Array.isArray((row.grid as { pattern?: string[] }).pattern)
              ? (row.grid as { pattern: string[] }).pattern
              : []
          return (
            <div
              key={row.id}
              style={{
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                gap: 20,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {pat.length ? <ShapePreviewGrid pattern={pat} /> : null}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{row.title ?? '—'}</div>
                <div style={{ fontSize: 13, color: s.textMuted }}>
                  {row.width}×{row.height}
                  {row.letter_cell_count != null && row.total_cells != null
                    ? ` · ${row.letter_cell_count}/${row.total_cells} letter cells`
                    : null}
                </div>
                <div style={{ fontSize: 12, color: s.textMuted, marginTop: 4 }}>
                  Created {new Date(row.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <ShapeGenerateButton shapeId={row.id} />
                <DeleteShapeTemplateButton shapeId={row.id} />
              </div>
            </div>
          )
        })}
      </div>

      {shapes.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
          No shape templates yet. Use New Shape to create one.
        </div>
      ) : null}
    </div>
  )
}
