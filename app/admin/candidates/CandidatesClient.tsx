'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SolveScreen from '@/app/components/SolveScreen'
import {
  promoteCandidateAction,
  purgeRunAction,
  rejectCandidateAction,
} from '@/lib/candidate-actions'
import type { AdminCandidate, GetCandidatesFilters } from '@/lib/admin'
import { buildPuzzlePayload } from '@/lib/puzzles'
import type { PuzzleClueRowPayload, PuzzlePayload, PuzzleRowPayload } from '@/lib/puzzles'
import { theme } from '@/app/components/theme'

const s = {
  surface: '#FBFAF6',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  hero: '#3D5F7A',
  border: '#D6D0C4',
  bg: '#F0EEE9',
  warn: '#B87A3D',
}

const RUN_BG = ['#FBFAF6', '#F5F1EA', '#EDE8DF', '#E8E2D8']

type Filters = {
  status: GetCandidatesFilters['status']
  shapeName: string
  sort: NonNullable<GetCandidatesFilters['sort']>
}

function ShapeMiniGrid({ pattern }: { pattern: string[] }) {
  const rows = pattern.length
  const cols = pattern[0]?.length ?? 0
  const box = 140
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
        flexShrink: 0,
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

type ClueItem = {
  word: string
  clue_text: string
  row: number
  col: number
  direction: string
  number: number
}

function parseClueItems(raw: unknown): ClueItem[] {
  if (!Array.isArray(raw)) return []
  const out: ClueItem[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    if (typeof o.word === 'string' && typeof o.clue_text === 'string' && typeof o.number === 'number') {
      out.push({
        word: o.word,
        clue_text: o.clue_text,
        row: Number(o.row),
        col: Number(o.col),
        direction: String(o.direction ?? ''),
        number: o.number,
      })
    }
  }
  return out.sort((a, b) =>
    a.number !== b.number
      ? a.number - b.number
      : a.direction === b.direction
        ? 0
        : a.direction === 'across'
          ? -1
          : 1,
  )
}

function formatWordSample(clues: ClueItem[], maxLen = 64): string {
  if (!clues.length) return '—'
  const words = [...clues]
    .sort((a, b) => a.number - b.number)
    .map((c) => c.word)
  const s0 = words.join(', ')
  if (s0.length <= maxLen) return s0
  return s0.slice(0, maxLen - 1) + '…'
}

function candidateToPuzzlePayload(c: AdminCandidate): PuzzlePayload | null {
  const pat =
    typeof c.grid === 'object' && c.grid && 'pattern' in (c.grid as object)
      ? (c.grid as { pattern: string[] }).pattern
      : null
  if (!pat?.length) return null
  const items = parseClueItems(c.clues)
  if (!items.length) return null
  const rows: PuzzleClueRowPayload[] = items.map((x) => ({
    number: x.number,
    row: x.row,
    col: x.col,
    direction: x.direction,
    word: x.word,
    clue_text: x.clue_text,
  }))
  const puzzleRow: PuzzleRowPayload = {
    id: c.id,
    title: c.shape_title ?? c.shape_name,
    publish_date: null,
    width: c.width,
    height: c.height,
    difficulty: null,
    grid: c.grid,
  }
  return buildPuzzlePayload(puzzleRow, rows)
}

function runTintKey(run: string | null): number {
  if (!run) return 0
  let h = 0
  for (let i = 0; i < run.length; i++) h = (h + run.charCodeAt(i) * (i + 1)) % 997
  return h % RUN_BG.length
}

function groupByRun(candidates: AdminCandidate[]): Array<{ run: string | null; items: AdminCandidate[] }> {
  const order: (string | null)[] = []
  const map = new Map<string | null, AdminCandidate[]>()
  for (const c of candidates) {
    const r = c.generator_run
    if (!map.has(r)) {
      map.set(r, [])
      order.push(r)
    }
    map.get(r)!.push(c)
  }
  return order.map((run) => ({ run, items: map.get(run) ?? [] }))
}

function displayShapeLine(c: AdminCandidate): string {
  const name = (c.shape_title && c.shape_title.trim()) || c.shape_name || '—'
  return `${name} · ${c.width}×${c.height}`
}

export function CandidatesClient({
  initialCandidates,
  shapeNames,
  pendingCount,
  initialFilters,
}: {
  initialCandidates: AdminCandidate[]
  shapeNames: string[]
  pendingCount: number
  initialFilters: Filters
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AdminCandidate | null>(null)
  const [pending, startTransition] = useTransition()

  const setFilters = useCallback(
    (next: Partial<Filters>) => {
      const p = new URLSearchParams(searchParams.toString())
      const merged: Filters = { ...initialFilters, ...next }
      if (merged.status && merged.status !== 'pending') p.set('status', merged.status)
      else p.delete('status')
      if (merged.shapeName) p.set('shape', merged.shapeName)
      else p.delete('shape')
      if (merged.sort && merged.sort !== 'quality_score') p.set('sort', merged.sort)
      else p.delete('sort')
      router.push(`/admin/candidates?${p.toString()}`)
    },
    [initialFilters, router, searchParams],
  )

  const closeModal = useCallback(() => setPreview(null), [])

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, closeModal])

  const groups = useMemo(() => groupByRun(initialCandidates), [initialCandidates])

  const previewPayload = preview ? candidateToPuzzlePayload(preview) : null

  return (
    <div>
      {error ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            maxWidth: 360,
            padding: '12px 16px',
            background: '#F5E6E6',
            border: '1px solid #C45A5A',
            borderRadius: 8,
            color: '#4A2020',
            fontSize: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ marginLeft: 12, fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Candidates</h1>
          <p style={{ color: s.textMuted, margin: 0, fontSize: 14 }}>{pendingCount} pending</p>
        </div>
        <button
          type="button"
          disabled
          title="Coming next"
          style={{
            padding: '10px 18px',
            background: s.border,
            color: s.textMuted,
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 13,
            border: 'none',
            cursor: 'not-allowed',
          }}
        >
          Generate candidates
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 24,
          padding: 12,
          background: s.surface,
          border: `1px solid ${s.border}`,
          borderRadius: 8,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: s.textMuted }}>
          Status
          <select
            value={initialFilters.status ?? 'pending'}
            onChange={(e) =>
              setFilters({ status: e.target.value as Filters['status'] })
            }
            style={{ padding: 8, minWidth: 130, borderRadius: 4, border: `1px solid ${s.border}` }}
          >
            <option value="pending">Pending</option>
            <option value="promoted">Promoted</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: s.textMuted }}>
          Shape
          <select
            value={initialFilters.shapeName}
            onChange={(e) => setFilters({ shapeName: e.target.value })}
            style={{ padding: 8, minWidth: 160, borderRadius: 4, border: `1px solid ${s.border}` }}
          >
            <option value="">All shapes</option>
            {shapeNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: s.textMuted }}>
          Sort
          <select
            value={initialFilters.sort}
            onChange={(e) =>
              setFilters({ sort: e.target.value as Filters['sort'] })
            }
            style={{ padding: 8, minWidth: 160, borderRadius: 4, border: `1px solid ${s.border}` }}
          >
            <option value="quality_score">Quality score (high → low)</option>
            <option value="created_at">Created (newest first)</option>
          </select>
        </label>
      </div>

      {initialCandidates.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
          No candidates match these filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groups.map(({ run, items }) => {
            const tint = RUN_BG[runTintKey(run)]
            const runLabel =
              run && run.trim()
                ? `${new Date(run).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · ${run}`
                : 'Unknown run'
            return (
              <div
                key={run ?? 'null'}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${s.border}`,
                  overflow: 'hidden',
                  background: tint,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.45)',
                    borderBottom: `1px solid ${s.border}`,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>
                    {runLabel} — {items.length} in this list
                  </div>
                  {run && (initialFilters.status === 'pending' || initialFilters.status === 'all') ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!run) return
                        if (
                          !confirm(
                            'Delete all pending candidates from this generator run? This removes them from the database and cannot be undone.',
                          )
                        ) {
                          return
                        }
                        startTransition(async () => {
                          setError(null)
                          const res = await purgeRunAction(run)
                          if (!res.ok) setError(res.error)
                          else router.refresh()
                        })
                      }}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: s.warn,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Purge run
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
                  {items.map((c) => {
                    const pat =
                      typeof c.grid === 'object' && c.grid && 'pattern' in (c.grid as object)
                        ? (c.grid as { pattern: string[] }).pattern
                        : []
                    const clueItems = parseClueItems(c.clues)
                    const sports = c.sport_breakdown
                      ? Object.entries(c.sport_breakdown).sort((a, b) => b[1] - a[1])
                      : []
                    return (
                      <div
                        key={c.id}
                        style={{
                          background: s.surface,
                          border: `1px solid ${s.border}`,
                          borderRadius: 8,
                          padding: 16,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 16,
                          alignItems: 'center',
                        }}
                      >
                        {pat.length > 0 ? <ShapeMiniGrid pattern={pat} /> : null}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>{displayShapeLine(c)}</div>
                          <div
                            style={{
                              fontSize: 13,
                              color: s.textMuted,
                              lineHeight: 1.4,
                              marginBottom: 8,
                            }}
                          >
                            {formatWordSample(clueItems)}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {sports.map(([k, n]) => (
                              <span
                                key={k}
                                style={{
                                  fontSize: 11,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: s.bg,
                                  color: s.text,
                                  border: `1px solid ${s.border}`,
                                }}
                              >
                                {k} {n}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: 'right',
                            minWidth: 100,
                            fontSize: 32,
                            fontWeight: 800,
                            color: s.hero,
                            lineHeight: 1,
                          }}
                        >
                          {Number.isInteger(c.quality_score)
                            ? c.quality_score
                            : c.quality_score.toFixed(1)}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const pl = candidateToPuzzlePayload(c)
                              if (!pl) setError('Could not build preview for this candidate.')
                              else setPreview(c)
                            }}
                            style={{
                              padding: '8px 12px',
                              border: `1px solid ${s.hero}`,
                              color: s.hero,
                              background: 'transparent',
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                          >
                            Preview
                          </button>
                          {c.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  startTransition(async () => {
                                    setError(null)
                                    const res = await promoteCandidateAction(c.id)
                                    if (res && 'ok' in res && !res.ok) setError(res.error)
                                  })
                                }}
                                style={{
                                  padding: '8px 12px',
                                  background: s.hero,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  fontWeight: 600,
                                  fontSize: 13,
                                }}
                              >
                                Promote
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  if (!confirm('Reject this candidate?')) return
                                  startTransition(async () => {
                                    setError(null)
                                    const res = await rejectCandidateAction(c.id)
                                    if (!res.ok) setError(res.error)
                                    else router.refresh()
                                  })
                                }}
                                style={{
                                  padding: '8px 12px',
                                  color: '#A8505A',
                                  fontWeight: 600,
                                  fontSize: 13,
                                  background: 'none',
                                  border: 'none',
                                }}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {preview && previewPayload ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflow: 'auto',
          }}
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflow: 'auto',
              background: theme.surface,
              borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                padding: '12px 16px',
                borderBottom: `1px solid ${theme.borderSoft}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: theme.surface,
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: theme.textMuted }}>
                  Preview
                </div>
                <div
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontWeight: 900,
                    fontSize: 17,
                    color: theme.text,
                  }}
                >
                  {preview.shape_title ?? preview.shape_name ?? 'Candidate'}
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  padding: '8px 14px',
                  borderRadius: 4,
                  border: `1px solid ${theme.text}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
            <div style={{ maxWidth: 420, margin: '0 auto' }}>
              <SolveScreen
                puzzle={previewPayload}
                previewMode
                suppressPreviewBanner
                previewTitle={preview.shape_title ?? preview.shape_name}
                previewStatus="pending"
              />
            </div>
            <div
              style={{
                padding: '16px 20px 24px',
                borderTop: `1px solid ${theme.borderSoft}`,
                maxWidth: 420,
                margin: '0 auto',
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: theme.textMuted,
                  marginBottom: 12,
                }}
              >
                Clues
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {parseClueItems(preview.clues).map((cl) => (
                  <li
                    key={`${cl.number}-${cl.direction}-${cl.row}-${cl.col}`}
                    style={{
                      fontSize: 14,
                      marginBottom: 10,
                      paddingBottom: 10,
                      borderBottom: `1px solid ${theme.borderSoft}`,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: theme.hero }}>
                      {cl.number} {cl.direction}
                    </span>{' '}
                    <span style={{ fontWeight: 700 }}>{cl.word}</span>
                    <div style={{ marginTop: 4, color: theme.text }}>{cl.clue_text}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}
