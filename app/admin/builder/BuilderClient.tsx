'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import type { SavePayload } from '@/lib/builder-actions'
import {
  addGlossaryEntryAction,
  deleteDraftFromBuilderAction,
  saveDraftAction,
} from '@/lib/builder-actions'
import { createShapeTemplateAction } from '@/lib/shape-actions'
import type {
  Cell,
  Direction,
  GlossaryEntry,
  GridType,
  PlacedWord,
  Slot,
  ValidationIssue,
} from '@/lib/crossword'
import {
  computeActiveWordCells,
  computeNumbering,
  computeSlot,
  derivePlacedWords,
  detectValidationIssues,
  matchesPattern,
  slotKeyByPosition,
} from '@/lib/crossword'

const t = {
  bg: '#F0EEE9',
  surface: '#FBFAF6',
  surfaceAlt: '#F5F3EE',
  text: '#2B2B2B',
  textMuted: '#7A7A7A',
  textSoft: '#A09B91',
  hero: '#3D5F7A',
  heroTint: '#DDE5EC',
  heroFaint: '#EBF0F4',
  accent: '#5E9BBE',
  border: '#D6D0C4',
  borderStrong: '#2B2B2B',
  borderSoft: '#E5E0D5',
  error: '#A8505A',
  errorTint: '#F2DDE0',
  warn: '#B87A3D',
  warnTint: '#F5E4D0',
  success: '#5E8A6E',
  black: '#2B2B2B',
  glossaryTag: '#5E8A6E',
  glossaryTagBg: '#DCE7E0',
  variantTag: '#B87A3D',
  variantTagBg: '#F5E4D0',
  newWordTag: '#A8505A',
  newWordTagBg: '#F2DDE0',
}

const selectStyle: React.CSSProperties = {
  padding: '5px 8px',
  background: t.surface,
  border: `1px solid ${t.border}`,
  borderRadius: 3,
  fontSize: 12,
  color: t.text,
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
}

/** Glossary filter row only — tighter than grid/dimension selects */
const glossaryFilterSelectStyle: React.CSSProperties = {
  ...selectStyle,
  padding: '4px 6px',
  fontSize: 11,
  minWidth: 0,
  width: 'max-content',
  maxWidth: '100%',
}

function blankGrid(rows: number, cols: number): GridType {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => '' as Cell)
  )
}

function resizeGrid(grid: GridType, rows: number, cols: number): GridType {
  const next: GridType = []
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) {
      row.push(grid[r]?.[c] ?? '')
    }
    next.push(row)
  }
  return next
}

function prevLetterCell(
  grid: GridType,
  activeCell: [number, number],
  direction: Direction
): [number, number] | null {
  const slot = computeSlot(grid, activeCell, direction)
  if (!slot) return null
  const [r, c] = activeCell
  if (direction === 'across') {
    if (c <= slot.startCol) return null
    return grid[r][c - 1] !== null ? [r, c - 1] : null
  }
  if (r <= slot.startRow) return null
  return grid[r - 1]?.[c] !== null ? [r - 1, c] : null
}

function nextLetterCell(
  grid: GridType,
  activeCell: [number, number],
  direction: Direction
): [number, number] | null {
  const slot = computeSlot(grid, activeCell, direction)
  if (!slot) return null
  const [r, c] = activeCell
  if (direction === 'across') {
    const nc = c + 1
    if (nc >= slot.startCol + slot.length) return null
    return grid[r][nc] !== null ? [r, nc] : null
  }
  const nr = r + 1
  if (nr >= slot.startRow + slot.length) return null
  return grid[nr]?.[c] !== null ? [nr, c] : null
}

function buildSavePayload(
  title: string,
  difficulty: number,
  grid: GridType,
  placed: PlacedWord[]
): SavePayload {
  const pattern = grid.map((row) =>
    row.map((cell) => (cell === null ? '#' : '.')).join('')
  )
  return {
    title: title.trim() || 'Untitled puzzle',
    difficulty,
    width: grid[0]?.length ?? 0,
    height: grid.length,
    grid: { pattern },
    clues: placed.map((p) => ({
      number: p.number,
      direction: p.direction,
      row: p.row,
      col: p.col,
      word: p.word,
      clue_text: p.clueText,
    })),
  }
}

export type BuilderClientProps = {
  initialGlossary: GlossaryEntry[]
  initialDraft: {
    puzzleId: string
    title: string
    difficulty: number
    grid: GridType
    clueBySlot: Record<string, string>
    glossaryIdBySlot?: Record<string, string | null>
  } | null
  /** New shape template flow: grid only, save via create_shape_template RPC */
  shapeAuthoring?: boolean
}

export default function BuilderClient({
  initialGlossary,
  initialDraft,
  shapeAuthoring = false,
}: BuilderClientProps) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)

  const [puzzleId, setPuzzleId] = useState<string | null>(
    initialDraft?.puzzleId ?? null
  )
  const [title, setTitle] = useState(initialDraft?.title ?? '')
  const [difficulty, setDifficulty] = useState(initialDraft?.difficulty ?? 3)
  const [dims, setDims] = useState(() => ({
    rows: initialDraft?.grid.length ?? 8,
    cols: initialDraft?.grid[0]?.length ?? 8,
  }))
  const [grid, setGrid] = useState<GridType>(
    () => initialDraft?.grid ?? blankGrid(8, 8)
  )
  const [mode, setMode] = useState<'fill' | 'shape'>(shapeAuthoring ? 'shape' : 'fill')
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null)
  const [direction, setDirection] = useState<Direction>('across')
  const [clueBySlot, setClueBySlot] = useState<Record<string, string>>(
    () => initialDraft?.clueBySlot ?? {}
  )
  const [glossaryIdBySlot, setGlossaryIdBySlot] = useState<Record<string, string | null>>(
    () => initialDraft?.glossaryIdBySlot ?? {}
  )
  const [search, setSearch] = useState('')
  const [lengthFilter, setLengthFilter] = useState('auto')
  const [positionFilter, setPositionFilter] = useState('contains')
  const [freshFilter, setFreshFilter] = useState('any')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [glossary, setGlossary] = useState<GlossaryEntry[]>(() => initialGlossary)

  const numbering = useMemo(() => computeNumbering(grid), [grid])

  const clueMap = useMemo(() => new Map(Object.entries(clueBySlot)), [clueBySlot])

  const glossaryIdMap = useMemo(
    () => new Map(Object.entries(glossaryIdBySlot)),
    [glossaryIdBySlot]
  )

  const placedWords = useMemo(
    () => derivePlacedWords(grid, numbering, glossary, clueMap, glossaryIdMap),
    [grid, numbering, glossary, clueMap, glossaryIdMap]
  )

  const validation = useMemo(
    () => detectValidationIssues(grid, placedWords),
    [grid, placedWords]
  )

  const activeSlot = useMemo<Slot | null>(() => {
    if (!activeCell) return null
    return computeSlot(grid, activeCell, direction)
  }, [grid, activeCell, direction])

  const trimmedSearch = search.trim()
  const hasSearch = trimmedSearch.length > 0
  const searchLower = trimmedSearch.toLowerCase()

  const filteredResults = useMemo(() => {
    // TODO Sprint 5: use useDeferredValue or precomputed indexes if profiling shows jank
    const q = searchLower

    return glossary.filter((entry) => {
      if (freshFilter === 'never' && entry.lastUsedAt !== null) return false
      if (
        freshFilter === '30d' &&
        entry.daysSinceUse !== null &&
        entry.daysSinceUse < 30
      )
        return false

      if (lengthFilter === 'auto' && !activeSlot) return false

      const targetLen =
        lengthFilter === 'auto'
          ? activeSlot?.length ?? null
          : lengthFilter === 'any'
            ? null
            : parseInt(lengthFilter, 10)

      if (targetLen != null && entry.word.length !== targetLen) return false

      if (!hasSearch && lengthFilter === 'auto' && activeSlot) {
        if (!matchesPattern(entry.word, activeSlot.pattern)) return false
      }

      if (hasSearch) {
        const word = entry.word.toLowerCase()
        if (positionFilter === 'starts') return word.startsWith(q)
        if (positionFilter === 'ends') return word.endsWith(q)
        return word.includes(q)
      }

      return true
    })
  }, [
    activeSlot,
    hasSearch,
    searchLower,
    lengthFilter,
    positionFilter,
    freshFilter,
    glossary,
  ])

  const handleGlossaryEntryAdded = useCallback((entry: GlossaryEntry) => {
    setGlossary((prev) => [...prev, entry])
  }, [])

  const errorCount = validation.errors.length

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const setDimsAndGrid = useCallback(
    (nextDims: { rows: number; cols: number }) => {
      setDims(nextDims)
      setGrid((g) => resizeGrid(g, nextDims.rows, nextDims.cols))
    },
    []
  )

  function handleCellClick(r: number, c: number) {
    if (mode === 'shape') {
      const next = grid.map((row) => [...row])
      next[r][c] = next[r][c] === null ? '' : null
      setGrid(next)
      return
    }
    if (grid[r][c] === null) return
    if (activeCell && activeCell[0] === r && activeCell[1] === c) {
      setDirection((d) => (d === 'across' ? 'down' : 'across'))
    } else {
      setActiveCell([r, c])
    }
  }

  function handlePlaceWord(entry: GlossaryEntry) {
    if (!activeSlot || activeSlot.number === null) return
    const next = grid.map((row) => [...row])
    const w = entry.word.toUpperCase()
    const { startRow, startCol, length } = activeSlot
    if (w.length !== length) return
    for (let i = 0; i < length; i++) {
      const r = direction === 'across' ? startRow : startRow + i
      const col = direction === 'across' ? startCol + i : startCol
      next[r][col] = w[i]!
    }
    setGrid(next)
    const sk = slotKeyByPosition(startRow, startCol, direction)
    setClueBySlot((prev) => ({ ...prev, [sk]: entry.clue }))
    setGlossaryIdBySlot((prev) => ({ ...prev, [sk]: entry.id }))
  }

  function handleClueSlotEdit(slotKey: string, newClue: string) {
    setClueBySlot((prev) => ({ ...prev, [slotKey]: newClue }))
    setGlossaryIdBySlot((prev) => ({ ...prev, [slotKey]: null }))
  }

  async function handleSave() {
    if (errorCount > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      if (shapeAuthoring) {
        const pattern = grid.map((row) =>
          row.map((cell) => (cell === null ? '#' : '.')).join('')
        )
        await createShapeTemplateAction({
          title: title.trim() || 'Untitled shape',
          width: grid[0]?.length ?? 0,
          height: grid.length,
          grid: { pattern },
        })
        router.push('/admin/shapes')
        return
      }
      const payload = buildSavePayload(title, difficulty, grid, placedWords)
      const { puzzleId: id } = await saveDraftAction({
        puzzleId,
        payload,
      })
      setPuzzleId(id)
      router.push(`/admin/puzzles/${id}`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDraft() {
    if (!puzzleId) return
    if (!window.confirm('Delete this draft permanently?')) return
    try {
      await deleteDraftFromBuilderAction(puzzleId)
      router.push('/admin/drafts')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
    }
    setMenuOpen(false)
  }

  function handleRootKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.closest('[data-word-explorer]')) return
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    ) {
      return
    }
    if (mode !== 'fill' || !activeCell) return
    const [r, c] = activeCell

    if (e.key === 'Escape') {
      e.preventDefault()
      setActiveCell(null)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      setDirection((d) => (d === 'across' ? 'down' : 'across'))
      return
    }

    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault()
      const next = grid.map((row) => [...row])
      if (next[r][c] !== null) {
        next[r][c] = e.key.toUpperCase()
        setGrid(next)
        const nxt = nextLetterCell(next, [r, c], direction)
        if (nxt) setActiveCell(nxt)
      }
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = grid.map((row) => [...row])
      if (next[r][c] !== null) {
        next[r][c] = ''
        setGrid(next)
        const prev = prevLetterCell(grid, [r, c], direction)
        if (prev) setActiveCell(prev)
      }
      return
    }
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleRootKeyDown}
      style={{
        background: t.bg,
        margin: '-28px -32px -48px',
        paddingBottom: 48,
        outline: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: t.text,
      }}
    >
      <BuilderTopBar
        title={title}
        setTitle={setTitle}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        errorCount={errorCount}
        saving={saving}
        saveError={saveError}
        puzzleId={puzzleId}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        shapeAuthoring={shapeAuthoring}
        onBack={() => router.push(shapeAuthoring ? '/admin/shapes' : '/admin/drafts')}
        onSave={handleSave}
        onDeleteDraft={handleDeleteDraft}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: shapeAuthoring ? '1fr' : '1fr 440px',
          gap: 20,
          padding: '20px 32px 0',
          maxWidth: 1400,
          margin: '0 auto',
          alignItems: 'start',
        }}
      >
        <LeftPane
          dims={dims}
          setDims={setDimsAndGrid}
          mode={mode}
          setMode={setMode}
          grid={grid}
          activeCell={activeCell}
          direction={direction}
          onCellClick={handleCellClick}
          glossary={glossary}
          activeSlot={activeSlot}
          onPlaceWord={handlePlaceWord}
          shapeAuthoring={shapeAuthoring}
        />
        {!shapeAuthoring ? (
          <RightPane
            activeSlot={activeSlot}
            direction={direction}
            search={search}
            setSearch={setSearch}
            lengthFilter={lengthFilter}
            setLengthFilter={setLengthFilter}
            positionFilter={positionFilter}
            setPositionFilter={setPositionFilter}
            freshFilter={freshFilter}
            setFreshFilter={setFreshFilter}
            results={filteredResults}
            onPlaceWord={handlePlaceWord}
          />
        ) : null}
      </div>

      {!shapeAuthoring ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: 20,
            padding: '20px 32px 40px',
            maxWidth: 1400,
            margin: '0 auto',
          }}
        >
          <PlacedWordsPanel
            placedWords={placedWords}
            glossary={glossary}
            onClueEdit={handleClueSlotEdit}
            onGlossaryEntryAdded={handleGlossaryEntryAdded}
          />
          <ValidationPanel errors={validation.errors} warnings={validation.warnings} />
        </div>
      ) : (
        <div
          style={{
            padding: '20px 32px 40px',
            maxWidth: 1400,
            margin: '0 auto',
          }}
        >
          <ValidationPanel errors={validation.errors} warnings={validation.warnings} />
        </div>
      )}
    </div>
  )
}

function BuilderTopBar({
  title,
  setTitle,
  difficulty,
  setDifficulty,
  errorCount,
  saving,
  saveError,
  puzzleId,
  menuOpen,
  setMenuOpen,
  shapeAuthoring,
  onBack,
  onSave,
  onDeleteDraft,
}: {
  title: string
  setTitle: (v: string) => void
  difficulty: number
  setDifficulty: (n: number) => void
  errorCount: number
  saving: boolean
  saveError: string | null
  puzzleId: string | null
  menuOpen: boolean
  setMenuOpen: (v: boolean) => void
  shapeAuthoring: boolean
  onBack: () => void
  onSave: () => void
  onDeleteDraft: () => void
}) {
  return (
    <div
      style={{
        background: t.surface,
        borderBottom: `1px solid ${t.border}`,
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        maxWidth: 1400,
        margin: '0 auto',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'transparent',
          color: t.textMuted,
          border: 'none',
          padding: '6px 10px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {shapeAuthoring ? '← Shapes' : '← Drafts'}
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: t.textMuted,
              marginBottom: 2,
              textTransform: 'uppercase',
            }}
          >
            Title
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={shapeAuthoring ? 'Untitled shape' : 'Untitled puzzle'}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              fontFamily: 'Georgia, serif',
              fontWeight: 900,
              fontSize: 22,
              color: t.text,
              outline: 'none',
              padding: 0,
              letterSpacing: -0.3,
            }}
          />
        </div>

        {!shapeAuthoring ? (
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: t.textMuted,
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Difficulty
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDifficulty(n)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: n <= difficulty ? t.hero : t.borderSoft,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {saveError ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: t.error }}>{saveError}</span>
        ) : null}
        {errorCount > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: t.error,
              background: t.errorTint,
              padding: '4px 10px',
              borderRadius: 12,
            }}
          >
            {errorCount} error{errorCount !== 1 ? 's' : ''} — fix to save
          </span>
        )}
        <button
          type="button"
          disabled={errorCount > 0 || saving}
          onClick={onSave}
          style={{
            background: errorCount > 0 ? t.borderSoft : t.hero,
            color: errorCount > 0 ? t.textMuted : '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            cursor: errorCount > 0 || saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            letterSpacing: 1,
          }}
        >
          {saving ? 'SAVING…' : shapeAuthoring ? 'SAVE SHAPE TEMPLATE' : 'SAVE DRAFT'}
        </button>
        {puzzleId && !shapeAuthoring ? (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'transparent',
                color: t.text,
                border: `1px solid ${t.border}`,
                padding: '9px 14px',
                borderRadius: 4,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                lineHeight: 1,
              }}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 6,
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  minWidth: 160,
                  zIndex: 10,
                }}
              >
                <button
                  type="button"
                  onClick={onDeleteDraft}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.error,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Delete draft
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function WordExplorer({
  glossary,
  activeSlot,
  onPlaceWord,
}: {
  glossary: GlossaryEntry[]
  activeSlot: Slot | null
  onPlaceWord: (e: GlossaryEntry) => void
}) {
  const [length, setLength] = useState(5)
  const [pattern, setPattern] = useState<string[]>(() =>
    Array.from({ length: 5 }, () => '')
  )
  const [placeError, setPlaceError] = useState<string | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    setPattern((prev) => {
      const next = prev.slice(0, length)
      while (next.length < length) next.push('')
      return next
    })
  }, [length])

  useEffect(() => {
    setPlaceError(null)
  }, [pattern, length, activeSlot])

  const filtered = useMemo(() => {
    return glossary.filter((entry) => {
      if (entry.word.length !== length) return false
      const w = entry.word.toUpperCase()
      for (let i = 0; i < length; i++) {
        const p = pattern[i]
        if (p && w[i] !== p.toUpperCase()) return false
      }
      return true
    })
  }, [glossary, length, pattern])

  const shown = filtered.slice(0, 40)
  const total = filtered.length

  const bumpLength = (delta: number) => {
    setLength((n) => Math.min(10, Math.max(2, n + delta)))
  }

  const focusAt = (idx: number) => {
    window.requestAnimationFrame(() => {
      inputRefs.current[idx]?.focus()
      inputRefs.current[idx]?.select()
    })
  }

  function tryPlace(entry: GlossaryEntry) {
    if (!activeSlot || activeSlot.number === null) {
      setPlaceError('Select a cell on the grid to choose an active slot.')
      return
    }
    if (entry.word.length !== activeSlot.length) {
      setPlaceError(`Doesn't fit active slot (needs ${activeSlot.length} letters)`)
      return
    }
    setPlaceError(null)
    onPlaceWord(entry)
  }

  const BLOCK = 36

  return (
    <div data-word-explorer style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              color: t.textMuted,
              textTransform: 'uppercase',
            }}
          >
            Word Explorer
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>Length:</span>
            <button
              type="button"
              aria-label="Decrease length"
              data-word-explorer
              onClick={() => bumpLength(-1)}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                border: `1px solid ${t.border}`,
                borderRadius: 3,
                background: t.surfaceAlt,
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                color: t.text,
              }}
            >
              −
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
              {length}
            </span>
            <button
              type="button"
              aria-label="Increase length"
              data-word-explorer
              onClick={() => bumpLength(1)}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                border: `1px solid ${t.border}`,
                borderRadius: 3,
                background: t.surfaceAlt,
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                color: t.text,
              }}
            >
              +
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 4,
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {Array.from({ length }, (_, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el
              }}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-label={`Pattern letter ${i + 1}`}
              value={pattern[i] ?? ''}
              maxLength={1}
              data-word-explorer
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setPattern((prev) => {
                    const next = [...prev]
                    next[i] = ''
                    return next
                  })
                  return
                }
                const letters = raw.replace(/[^a-zA-Z]/g, '')
                const ch = letters.slice(-1).toUpperCase()
                if (!/^[A-Z]$/.test(ch)) return
                setPattern((prev) => {
                  const next = [...prev]
                  next[i] = ch
                  return next
                })
                if (i < length - 1) focusAt(i + 1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const next = e.shiftKey ? i - 1 : i + 1
                  if (next >= 0 && next < length) focusAt(next)
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  e.currentTarget.blur()
                  return
                }
                if (e.key === 'Backspace') {
                  if (pattern[i]) {
                    e.preventDefault()
                    setPattern((prev) => {
                      const next = [...prev]
                      next[i] = ''
                      return next
                    })
                  } else if (i > 0) {
                    e.preventDefault()
                    focusAt(i - 1)
                    setPattern((prev) => {
                      const next = [...prev]
                      next[i - 1] = ''
                      return next
                    })
                  }
                }
              }}
              onClick={() => {
                inputRefs.current[i]?.select()
              }}
              style={{
                width: BLOCK,
                height: BLOCK,
                boxSizing: 'border-box',
                padding: 0,
                textAlign: 'center',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 3,
                border: `1px solid ${pattern[i] ? t.hero : t.borderSoft}`,
                background: pattern[i] ? t.heroTint : t.surfaceAlt,
                color: pattern[i] ? t.hero : t.textSoft,
                fontFamily: 'inherit',
                outline: 'none',
                caretColor: pattern[i] ? t.hero : t.textSoft,
              }}
              placeholder="·"
            />
          ))}
        </div>

        {placeError ? (
          <div
            style={{
              fontSize: 12,
              color: t.error,
              marginBottom: 10,
              lineHeight: 1.35,
            }}
          >
            {placeError}
          </div>
        ) : null}

        <div
          style={{
            fontSize: 11,
            color: t.textMuted,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {total} matches · showing first {Math.min(40, Math.max(0, total))}
        </div>

        <div
          style={{
            borderTop: `1px solid ${t.borderSoft}`,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {shown.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
              No matches for this pattern.
            </div>
          ) : (
            shown.map((entry) => (
              <GlossaryResult key={`explorer-${entry.id}`} entry={entry} onClick={() => tryPlace(entry)} />
            ))
          )}
        </div>

        <div
          style={{
            padding: '8px 0 0',
            fontSize: 10,
            color: t.textMuted,
            fontWeight: 600,
          }}
        >
          Showing {Math.min(40, total)} of {total}
        </div>
    </div>
  )
}

function LeftPane({
  dims,
  setDims,
  mode,
  setMode,
  grid,
  activeCell,
  direction,
  onCellClick,
  glossary,
  activeSlot,
  onPlaceWord,
  shapeAuthoring,
}: {
  dims: { rows: number; cols: number }
  setDims: (d: { rows: number; cols: number }) => void
  mode: 'fill' | 'shape'
  setMode: (m: 'fill' | 'shape') => void
  grid: GridType
  activeCell: [number, number] | null
  direction: Direction
  onCellClick: (r: number, c: number) => void
  glossary: GlossaryEntry[]
  activeSlot: Slot | null
  onPlaceWord: (e: GlossaryEntry) => void
  shapeAuthoring: boolean
}) {
  const numbering = useMemo(() => computeNumbering(grid), [grid])

  const activeWordCells = useMemo(() => {
    if (!activeCell) return new Set<string>()
    return computeActiveWordCells(grid, activeCell, direction)
  }, [grid, activeCell, direction])

  return (
    <div>
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 6,
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {!shapeAuthoring ? (
          <>
            <ModeToggle mode={mode} setMode={setMode} />
            <div style={{ width: 1, height: 24, background: t.borderSoft }} />
          </>
        ) : null}
        <DimensionsPicker dims={dims} setDims={setDims} />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 0.5 }}>
          {shapeAuthoring
            ? 'Shape template: toggle black vs letter cells · set dimensions above'
            : mode === 'fill'
              ? 'Click a cell to select · Tab flips direction · Type letters directly'
              : 'Click any cell to toggle black/letter'}
        </div>
      </div>

      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 6,
          padding: '20px 20px 18px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <GridView
          grid={grid}
          dims={dims}
          numbering={numbering}
          activeCell={activeCell}
          activeWordCells={activeWordCells}
          mode={mode}
          onCellClick={onCellClick}
        />
      </div>

      {!shapeAuthoring ? (
        <div
          style={{
            marginTop: 18,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            padding: '18px 20px 16px',
          }}
        >
          <WordExplorer glossary={glossary} activeSlot={activeSlot} onPlaceWord={onPlaceWord} />
        </div>
      ) : null}
    </div>
  )
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: 'fill' | 'shape'
  setMode: (m: 'fill' | 'shape') => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: t.surfaceAlt,
        border: `1px solid ${t.border}`,
        borderRadius: 4,
        padding: 2,
      }}
    >
      {[
        { k: 'fill' as const, l: 'Fill' },
        { k: 'shape' as const, l: 'Shape' },
      ].map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => setMode(o.k)}
          style={{
            padding: '6px 14px',
            background: mode === o.k ? t.hero : 'transparent',
            color: mode === o.k ? '#fff' : t.text,
            border: 'none',
            borderRadius: 3,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 0.5,
            fontFamily: 'inherit',
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function DimensionsPicker({
  dims,
  setDims,
}: {
  dims: { rows: number; cols: number }
  setDims: (d: { rows: number; cols: number }) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: t.textMuted,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        Dims
      </span>
      <select
        value={dims.rows}
        onChange={(e) =>
          setDims({ ...dims, rows: parseInt(e.target.value, 10) })
        }
        style={selectStyle}
      >
        {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span style={{ color: t.textSoft, fontSize: 12 }}>×</span>
      <select
        value={dims.cols}
        onChange={(e) =>
          setDims({ ...dims, cols: parseInt(e.target.value, 10) })
        }
        style={selectStyle}
      >
        {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  )
}

function GridView({
  grid,
  dims,
  numbering,
  activeCell,
  activeWordCells,
  mode,
  onCellClick,
}: {
  grid: GridType
  dims: { rows: number; cols: number }
  numbering: (number | null)[][]
  activeCell: [number, number] | null
  activeWordCells: Set<string>
  mode: 'fill' | 'shape'
  onCellClick: (r: number, c: number) => void
}) {
  const CELL_SIZE = 52
  const gridW = dims.cols * CELL_SIZE
  const gridH = dims.rows * CELL_SIZE

  return (
    <div
      style={{
        width: gridW,
        height: gridH,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: `repeat(${dims.cols}, ${CELL_SIZE}px)`,
        gridTemplateRows: `repeat(${dims.rows}, ${CELL_SIZE}px)`,
        border: `2px solid ${t.borderStrong}`,
      }}
    >
      {Array.from({ length: dims.rows }).map((_, r) =>
        Array.from({ length: dims.cols }).map((__, c) => {
          const cell = grid[r]?.[c]
          const isBlack = cell === null
          const isSelected =
            activeCell && activeCell[0] === r && activeCell[1] === c
          const isInActiveWord = activeWordCells.has(`${r},${c}`)
          const num = numbering[r]?.[c]

          let bg = t.surface
          if (isBlack) bg = t.black
          else if (isSelected) bg = t.hero
          else if (isInActiveWord) bg = t.heroTint

          const letterColor = isBlack ? 'transparent' : isSelected ? '#fff' : t.text
          const numColor = isSelected ? '#E5E0D5' : t.textMuted

          const letter =
            typeof cell === 'string' && cell.length ? cell : ''

          return (
            <div
              key={`${r}-${c}`}
              role="presentation"
              onClick={() => onCellClick(r, c)}
              style={{
                boxSizing: 'border-box',
                background: bg,
                borderRight: c < dims.cols - 1 ? `1px solid ${t.borderStrong}` : 'none',
                borderBottom: r < dims.rows - 1 ? `1px solid ${t.borderStrong}` : 'none',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isBlack && mode === 'fill' ? 'default' : 'pointer',
                userSelect: 'none',
                transition: 'background 0.08s',
              }}
            >
              {num && !isBlack ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    color: numColor,
                  }}
                >
                  {num}
                </span>
              ) : null}
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: letterColor,
                }}
              >
                {letter}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

function RightPane({
  activeSlot,
  direction,
  search,
  setSearch,
  lengthFilter,
  setLengthFilter,
  positionFilter,
  setPositionFilter,
  freshFilter,
  setFreshFilter,
  results,
  onPlaceWord,
}: {
  activeSlot: Slot | null
  direction: Direction
  search: string
  setSearch: (s: string) => void
  lengthFilter: string
  setLengthFilter: (v: string) => void
  positionFilter: string
  setPositionFilter: (v: string) => void
  freshFilter: string
  setFreshFilter: (v: string) => void
  results: GlossaryEntry[]
  onPlaceWord: (e: GlossaryEntry) => void
}) {
  return (
    <div>
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${t.borderSoft}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              color: t.textMuted,
              marginBottom: 4,
              textTransform: 'uppercase',
            }}
          >
            Active slot
          </div>
          {activeSlot && activeSlot.number !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div
                style={{
                  fontFamily: 'Georgia, serif',
                  fontWeight: 900,
                  fontSize: 18,
                  color: t.text,
                }}
              >
                {activeSlot.number} {direction === 'across' ? 'Across' : 'Down'}
              </div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                · {activeSlot.length} letters
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: t.textSoft, fontStyle: 'italic' }}>
              No cell selected
            </div>
          )}
        </div>

        {activeSlot ? (
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              gap: 4,
              justifyContent: 'center',
            }}
          >
            {activeSlot.pattern.map((ch, i) => (
              <div
                key={i}
                style={{
                  width: 28,
                  height: 32,
                  background: ch ? t.heroTint : t.surfaceAlt,
                  border: `1px solid ${ch ? t.hero : t.borderSoft}`,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 700,
                  color: ch ? t.hero : t.textSoft,
                }}
              >
                {ch || '·'}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 6,
        }}
      >
        <div style={{ padding: '14px 16px 10px' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search glossary (e.g. 'AE', 'james', 'nba')..."
            style={{
              width: '100%',
              padding: '10px 12px',
              background: t.surfaceAlt,
              border: `1px solid ${t.border}`,
              borderRadius: 4,
              fontSize: 13,
              color: t.text,
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: 4,
              minWidth: 0,
            }}
          >
            <FilterSelect
              label="LEN"
              value={lengthFilter}
              onChange={setLengthFilter}
              options={[
                { v: 'auto', l: `Auto${activeSlot ? ` (${activeSlot.length})` : ''}` },
                { v: 'any', l: 'Any' },
                ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
                  v: String(n),
                  l: String(n),
                })),
              ]}
            />
            <FilterSelect
              label="POS"
              value={positionFilter}
              onChange={setPositionFilter}
              options={[
                { v: 'contains', l: 'Contains' },
                { v: 'starts', l: 'Starts with' },
                { v: 'ends', l: 'Ends with' },
              ]}
            />
            <FilterSelect
              label="FRESH"
              value={freshFilter}
              onChange={setFreshFilter}
              options={[
                { v: 'any', l: 'Any' },
                { v: 'never', l: 'Never used' },
                { v: '30d', l: '30+ days ago' },
              ]}
            />
            <div
              style={{
                marginLeft: 'auto',
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 600,
                color: t.textMuted,
                lineHeight: 1,
              }}
              title={`${results.length} match${results.length !== 1 ? 'es' : ''}`}
              aria-label={`${results.length} matches`}
            >
              {results.length}
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${t.borderSoft}`,
            maxHeight: 540,
            overflowY: 'auto',
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: t.textMuted,
                fontSize: 13,
              }}
            >
              No matches. Try relaxing the filters or typing the word directly into the grid.
            </div>
          ) : (
            results.map((entry) => (
              <GlossaryResult key={entry.id} entry={entry} onClick={() => onPlaceWord(entry)} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: 0.9,
          color: t.textMuted,
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={glossaryFilterSelectStyle}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  )
}

function GlossaryResult({
  entry,
  onClick,
}: {
  entry: GlossaryEntry
  onClick: () => void
}) {
  const d = entry.daysSinceUse
  const fresh =
    entry.lastUsedAt == null
      ? 'never used'
      : d != null && d > 365
        ? `${Math.floor(d / 30)}mo ago`
        : `${d ?? 0}d ago`
  const freshColor =
    entry.lastUsedAt == null || (d != null && d > 90)
      ? t.success
      : d != null && d > 30
        ? t.textMuted
        : t.warn

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${t.borderSoft}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = t.heroFaint
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 15,
              fontWeight: 700,
              color: t.text,
              letterSpacing: 1,
            }}
          >
            {entry.word}
          </div>
          <div style={{ fontSize: 11, color: t.textSoft }}>
            {entry.sport} · {entry.type}
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.clue}
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: freshColor,
          whiteSpace: 'nowrap',
        }}
      >
        {fresh}
      </div>
    </div>
  )
}

function PlacedWordsPanel({
  placedWords,
  glossary,
  onClueEdit,
  onGlossaryEntryAdded,
}: {
  placedWords: PlacedWord[]
  glossary: GlossaryEntry[]
  onClueEdit: (slotKey: string, clue: string) => void
  onGlossaryEntryAdded: (entry: GlossaryEntry) => void
}) {
  const [openAddFormKey, setOpenAddFormKey] = useState<string | null>(null)

  const typeOptions = useMemo(
    () => Array.from(new Set(glossary.map((e) => e.type))).filter(Boolean).sort(),
    [glossary]
  )
  const sportOptions = useMemo(
    () => Array.from(new Set(glossary.map((e) => e.sport))).filter(Boolean).sort(),
    [glossary]
  )

  useEffect(() => {
    if (openAddFormKey == null) return
    if (!placedWords.some((p) => p.key === openAddFormKey)) {
      setOpenAddFormKey(null)
    }
  }, [placedWords, openAddFormKey])

  const across = placedWords
    .filter((p) => p.direction === 'across')
    .sort((a, b) => a.number - b.number)
  const down = placedWords
    .filter((p) => p.direction === 'down')
    .sort((a, b) => a.number - b.number)

  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${t.borderSoft}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              color: t.textMuted,
              marginBottom: 4,
              textTransform: 'uppercase',
            }}
          >
            Placed words
          </div>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 17,
              fontWeight: 900,
              color: t.text,
            }}
          >
            Clues
          </div>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {placedWords.length} placed · edit any clue inline
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <ClueColumn
          label="ACROSS"
          items={across}
          onClueEdit={onClueEdit}
          typeOptions={typeOptions}
          sportOptions={sportOptions}
          openAddFormKey={openAddFormKey}
          setOpenAddFormKey={setOpenAddFormKey}
          onGlossaryEntryAdded={onGlossaryEntryAdded}
        />
        <div style={{ borderLeft: `1px solid ${t.borderSoft}` }}>
          <ClueColumn
            label="DOWN"
            items={down}
            onClueEdit={onClueEdit}
            typeOptions={typeOptions}
            sportOptions={sportOptions}
            openAddFormKey={openAddFormKey}
            setOpenAddFormKey={setOpenAddFormKey}
            onGlossaryEntryAdded={onGlossaryEntryAdded}
          />
        </div>
      </div>
    </div>
  )
}

function ClueColumn({
  label,
  items,
  onClueEdit,
  typeOptions,
  sportOptions,
  openAddFormKey,
  setOpenAddFormKey,
  onGlossaryEntryAdded,
}: {
  label: string
  items: PlacedWord[]
  onClueEdit: (slotKey: string, clue: string) => void
  typeOptions: string[]
  sportOptions: string[]
  openAddFormKey: string | null
  setOpenAddFormKey: (k: string | null) => void
  onGlossaryEntryAdded: (entry: GlossaryEntry) => void
}) {
  return (
    <div>
      <div
        style={{
          padding: '12px 20px 8px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: t.textMuted,
        }}
      >
        {label}
      </div>
      {items.length === 0 ? (
        <div
          style={{
            padding: '16px 20px 20px',
            color: t.textSoft,
            fontSize: 12,
            fontStyle: 'italic',
          }}
        >
          No {label.toLowerCase()} words yet
        </div>
      ) : (
        items.map((item) => (
          <PlacedWordRow
            key={item.key}
            item={item}
            onClueEdit={onClueEdit}
            typeOptions={typeOptions}
            sportOptions={sportOptions}
            openAddFormKey={openAddFormKey}
            setOpenAddFormKey={setOpenAddFormKey}
            onGlossaryEntryAdded={onGlossaryEntryAdded}
          />
        ))
      )}
    </div>
  )
}

const inputCompact: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 12,
  color: t.text,
  background: t.surfaceAlt,
  border: `1px solid ${t.border}`,
  borderRadius: 3,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function PlacedWordRow({
  item,
  onClueEdit,
  typeOptions,
  sportOptions,
  openAddFormKey,
  setOpenAddFormKey,
  onGlossaryEntryAdded,
}: {
  item: PlacedWord
  onClueEdit: (slotKey: string, clue: string) => void
  typeOptions: string[]
  sportOptions: string[]
  openAddFormKey: string | null
  setOpenAddFormKey: (k: string | null) => void
  onGlossaryEntryAdded: (entry: GlossaryEntry) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftClue, setDraftClue] = useState(item.clueText)
  const [formClue, setFormClue] = useState(item.clueText)
  const [formType, setFormType] = useState('')
  const [formSport, setFormSport] = useState('')
  const [formTeam, setFormTeam] = useState('')
  const [formAlt, setFormAlt] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successFlash, setSuccessFlash] = useState(false)
  const formOpen = openAddFormKey === item.key
  const listSafe = item.key.replace(/[^a-zA-Z0-9_-]/g, '_')
  const wasFormOpenRef = useRef(false)

  useEffect(() => {
    setDraftClue(item.clueText)
  }, [item.key, item.clueText])

  useEffect(() => {
    const nowOpen = openAddFormKey === item.key
    if (nowOpen && !wasFormOpenRef.current) {
      setFormClue(item.clueText)
      setFormType('')
      setFormSport('')
      setFormTeam('')
      setFormAlt('')
      setSubmitError(null)
    }
    wasFormOpenRef.current = nowOpen
  }, [openAddFormKey, item.key])

  useEffect(() => {
    if (!formOpen) return
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenAddFormKey(null)
    }
    document.addEventListener('keydown', onDocKey)
    return () => document.removeEventListener('keydown', onDocKey)
  }, [formOpen, setOpenAddFormKey])

  useEffect(() => {
    if (!successFlash) return
    const id = window.setTimeout(() => setSuccessFlash(false), 2000)
    return () => window.clearTimeout(id)
  }, [successFlash])

  const sourceStyles: Record<
    PlacedWord['source'],
    { bg: string; fg: string; label: string }
  > = {
    glossary: { bg: t.glossaryTagBg, fg: t.glossaryTag, label: 'glossary' },
    variant: { bg: t.variantTagBg, fg: t.variantTag, label: 'new variant' },
    'new-word': { bg: t.newWordTagBg, fg: t.newWordTag, label: 'new word' },
  }
  const srcStyle = sourceStyles[item.source]

  const slotKey = slotKeyByPosition(item.row, item.col, item.direction)

  function commit() {
    onClueEdit(slotKey, draftClue)
    setEditing(false)
  }

  const clueOk = formClue.trim().length > 0
  const typeOk = formType.trim().length > 0
  const sportOk = formSport.trim().length > 0
  const teamOk = formTeam.length <= 40
  const altOk = formAlt.length <= 60
  const canSubmit =
    clueOk && typeOk && sportOk && teamOk && altOk && !submitting

  async function submitGlossary() {
    if (!canSubmit) return
    setSubmitError(null)
    setSubmitting(true)
    const res = await addGlossaryEntryAction({
      word: item.word,
      clue: formClue,
      type: formType,
      sport: formSport,
      team: formTeam.trim() || null,
      alternate_name: formAlt.trim() || null,
    })
    setSubmitting(false)
    if (!res.ok) {
      setSubmitError(res.error)
      return
    }
    onClueEdit(slotKey, formClue.trim())
    onGlossaryEntryAdded(res.entry)
    setOpenAddFormKey(null)
    setSuccessFlash(true)
  }

  function updateFormClue(v: string) {
    setFormClue(v)
    onClueEdit(slotKey, v)
  }

  return (
    <div
      style={{
        padding: '10px 20px',
        borderTop: `1px solid ${t.borderSoft}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ width: 80, flexShrink: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: t.hero,
            marginBottom: 2,
          }}
        >
          {item.number}
          {item.direction === 'across' ? 'A' : 'D'}
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
            fontWeight: 700,
            color: t.text,
            letterSpacing: 0.5,
          }}
        >
          {item.word}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={draftClue}
            onChange={(e) => setDraftClue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraftClue(item.clueText)
                setEditing(false)
              }
            }}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: 12,
              color: t.text,
              background: t.surfaceAlt,
              border: `1px solid ${t.hero}`,
              borderRadius: 3,
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            role="presentation"
            onClick={() => setEditing(true)}
            style={{
              fontSize: 12,
              color: t.text,
              cursor: 'text',
              padding: '4px 6px',
              borderRadius: 3,
              lineHeight: 1.4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.surfaceAlt
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {item.clueText}
          </div>
        )}
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: srcStyle.fg,
              background: srcStyle.bg,
              padding: '1px 6px',
              borderRadius: 2,
            }}
          >
            {srcStyle.label}
          </span>
          {item.source === 'new-word' ? (
            <button
              type="button"
              onClick={() => setOpenAddFormKey(formOpen ? null : item.key)}
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: t.hero,
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              Add to glossary
            </button>
          ) : null}
          {successFlash ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: t.success,
                opacity: successFlash ? 1 : 0,
                transition: 'opacity 0.4s ease',
              }}
            >
              Added to glossary
            </span>
          ) : null}
        </div>

        {formOpen ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: t.surfaceAlt,
              border: `1px solid ${t.borderSoft}`,
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px 12px',
                alignItems: 'start',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                  Word
                </div>
                <input readOnly value={item.word} style={{ ...inputCompact, fontWeight: 700 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                  Length
                </div>
                <input readOnly value={String(item.word.length)} style={inputCompact} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                  Clue
                </div>
                <input
                  value={formClue}
                  onChange={(e) => updateFormClue(e.target.value)}
                  style={{
                    ...inputCompact,
                    borderColor: clueOk ? t.border : t.error,
                  }}
                />
                {!clueOk ? (
                  <div style={{ fontSize: 10, color: t.error, marginTop: 4 }}>Clue is required</div>
                ) : null}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                  Type
                </div>
                <input
                  list={`glossary-types-${listSafe}`}
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="e.g. player, team, stat..."
                  style={{
                    ...inputCompact,
                    borderColor: typeOk ? t.border : t.error,
                  }}
                />
                <datalist id={`glossary-types-${listSafe}`}>
                  {typeOptions.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
                {!typeOk ? (
                  <div style={{ fontSize: 10, color: t.error, marginTop: 4 }}>Type is required</div>
                ) : null}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                  Sport
                </div>
                <input
                  list={`glossary-sports-${listSafe}`}
                  value={formSport}
                  onChange={(e) => setFormSport(e.target.value)}
                  placeholder="e.g. NBA, NFL..."
                  style={{
                    ...inputCompact,
                    borderColor: sportOk ? t.border : t.error,
                  }}
                />
                <datalist id={`glossary-sports-${listSafe}`}>
                  {sportOptions.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
                {!sportOk ? (
                  <div style={{ fontSize: 10, color: t.error, marginTop: 4 }}>Sport is required</div>
                ) : null}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                  Team <span style={{ fontWeight: 500 }}>(optional)</span>
                </div>
                <input
                  value={formTeam}
                  onChange={(e) => setFormTeam(e.target.value)}
                  style={{
                    ...inputCompact,
                    borderColor: teamOk ? t.border : t.error,
                  }}
                />
                {!teamOk ? (
                  <div style={{ fontSize: 10, color: t.error, marginTop: 4 }}>Max 40 characters</div>
                ) : null}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                  Alternate name <span style={{ fontWeight: 500 }}>(optional)</span>
                </div>
                <input
                  value={formAlt}
                  onChange={(e) => setFormAlt(e.target.value)}
                  style={{
                    ...inputCompact,
                    borderColor: altOk ? t.border : t.error,
                  }}
                />
                {!altOk ? (
                  <div style={{ fontSize: 10, color: t.error, marginTop: 4 }}>Max 60 characters</div>
                ) : null}
              </div>

              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenAddFormKey(null)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${t.border}`,
                    background: t.surface,
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void submitGlossary()}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    border: `1px solid ${t.hero}`,
                    background: canSubmit ? t.hero : t.borderSoft,
                    color: canSubmit ? '#fff' : t.textMuted,
                    borderRadius: 3,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >
                  Add to glossary
                </button>
              </div>
            </div>
            {submitError ? (
              <div style={{ fontSize: 11, color: t.error, marginTop: 10 }}>{submitError}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ValidationPanel({
  errors,
  warnings,
}: {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}) {
  const blocking = errors.length > 0

  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${t.borderSoft}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            color: t.textMuted,
            marginBottom: 4,
            textTransform: 'uppercase',
          }}
        >
          Validation
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 17,
              fontWeight: 900,
              color: blocking ? t.error : warnings.length > 0 ? t.warn : t.success,
            }}
          >
            {blocking ? 'Not ready' : warnings.length > 0 ? 'Ready with notes' : 'All clear'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
          {errors.length} error{errors.length !== 1 ? 's' : ''} · {warnings.length} warning
          {warnings.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div>
        {errors.map((e) => (
          <ValidationRow key={e.key} level="error" message={e.message} />
        ))}
        {warnings.map((w) => (
          <ValidationRow key={w.key} level="warn" message={w.message} />
        ))}
        {errors.length === 0 && warnings.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>✓</div>
            <div style={{ fontSize: 13, color: t.success, fontWeight: 600 }}>
              Grid is complete and valid
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: '10px 20px',
          borderTop: `1px solid ${t.borderSoft}`,
          background: t.surfaceAlt,
          fontSize: 11,
          color: t.textMuted,
          lineHeight: 1.5,
        }}
      >
        {blocking ? (
          <>
            <strong style={{ color: t.error }}>✗ Errors block save.</strong> Fix the issues above to
            enable Save Draft.
          </>
        ) : (
          <>Warnings don&apos;t block save — review them if desired.</>
        )}
      </div>
    </div>
  )
}

function ValidationRow({ level, message }: { level: 'error' | 'warn'; message: string }) {
  const cfg = {
    error: { icon: '✗', color: t.error, bg: t.errorTint },
    warn: { icon: '⚠', color: t.warn, bg: t.warnTint },
  }[level]

  return (
    <div
      style={{
        padding: '10px 20px',
        borderBottom: `1px solid ${t.borderSoft}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: cfg.bg,
          color: cfg.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {cfg.icon}
      </div>
      <div
        style={{
          fontSize: 12,
          color: t.text,
          lineHeight: 1.4,
          paddingTop: 2,
        }}
      >
        {message}
      </div>
    </div>
  )
}
