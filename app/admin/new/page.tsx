'use client'

import { useMemo, useState } from 'react'
import { parsePuzzleDsl } from '@/lib/dsl'
import { createDraftFromDslAction } from '@/app/admin/actions'

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    String((error as { digest: string }).digest).startsWith('NEXT_REDIRECT')
  )
}

export default function NewPuzzlePage() {
  const [text, setText] = useState('')
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const parsedRun = useMemo(() => parsePuzzleDsl(text), [text])

  const canSubmit = parsedRun.errors.length === 0 && parsedRun.parsed !== null

  async function handleCreate() {
    setSubmitErr(null)
    try {
      await createDraftFromDslAction(text)
    } catch (e: unknown) {
      if (isNextRedirect(e)) throw e
      setSubmitErr(e instanceof Error ? e.message : 'Failed to create draft')
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>New puzzle</h1>
      <p style={{ color: '#7A7A7A', marginBottom: 16 }}>Paste DSL below, parse, then create a draft.</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="TITLE: ..."
        rows={14}
        style={{
          width: '100%',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
          padding: 12,
          borderRadius: 8,
          border: '1px solid #D6D0C4',
          marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />

      <button
        type="button"
        onClick={() =>
          document.getElementById('dsl-preview-panel')?.scrollIntoView({ behavior: 'smooth' })
        }
        style={{
          padding: '10px 18px',
          marginRight: 10,
          background: '#FBFAF6',
          border: '1px solid #2B2B2B',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Parse & Preview
      </button>
      <span style={{ fontSize: 12, color: '#7A7A7A' }}>
        (live — updates as you edit)
      </span>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
        <div style={{ border: '1px solid #D6D0C4', borderRadius: 8, padding: 14, minHeight: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
            ERRORS
          </div>
          {parsedRun.errors.length === 0 ? (
            <div style={{ color: '#5E8A6E', fontSize: 13 }}>None</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#A8505A' }}>
              {parsedRun.errors.map((e, i) => (
                <li key={i}>
                  {e.line ? `Line ${e.line}: ` : ''}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginTop: 16 }}>
            WARNINGS
          </div>
          {parsedRun.warnings.length === 0 ? (
            <div style={{ fontSize: 13, color: '#7A7A7A' }}>None</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#B87A3D' }}>
              {parsedRun.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        <div
          id="dsl-preview-panel"
          style={{ border: '1px solid #D6D0C4', borderRadius: 8, padding: 14, minHeight: 200 }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
            PREVIEW
          </div>
          {!parsedRun.parsed ? (
            <div style={{ fontSize: 13, color: '#7A7A7A' }}>Fix errors to see preview.</div>
          ) : (
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{parsedRun.parsed.title}</div>
              <div style={{ color: '#7A7A7A', marginBottom: 8 }}>
                Difficulty {parsedRun.parsed.difficulty} · {parsedRun.parsed.gridPattern.length}×
                {parsedRun.parsed.gridPattern[0]?.length}
              </div>
              <div style={{ marginBottom: 12 }}>
                {parsedRun.parsed.gridPattern.map((row, ri) => (
                  <div key={ri} style={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                    {row}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>ACROSS</div>
              <ul style={{ margin: '0 0 12px', paddingLeft: 16 }}>
                {parsedRun.parsed.across.map((c) => (
                  <li key={`a-${c.num}`}>
                    {c.num}. ({c.row},{c.col}) {c.word} — {c.clue}
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>DOWN</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {parsedRun.parsed.down.map((c) => (
                  <li key={`d-${c.num}`}>
                    {c.num}. ({c.row},{c.col}) {c.word} — {c.clue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleCreate}
          style={{
            padding: '14px 28px',
            background: canSubmit ? '#3D5F7A' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          Create Draft
        </button>
        {submitErr ? (
          <div style={{ marginTop: 12, color: '#A8505A', fontSize: 13 }}>{submitErr}</div>
        ) : null}
      </div>
    </div>
  )
}
