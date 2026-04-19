import React, { useState, useMemo } from 'react';

// ============================================================
// SPORTS WORDS — PUZZLE BUILDER (/admin/builder)
// Desktop-first authoring tool. Matches admin console style.
// ============================================================

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
  heroOnDark: '#FFFFFF',
  accent: '#5E9BBE',
  border: '#D6D0C4',
  borderStrong: '#2B2B2B',
  borderSoft: '#E5E0D5',
  error: '#A8505A',
  errorTint: '#F2DDE0',
  warn: '#B87A3D',
  warnTint: '#F5E4D0',
  success: '#5E8A6E',
  successTint: '#DCE7E0',
  black: '#2B2B2B',
  glossaryTag: '#5E8A6E',
  glossaryTagBg: '#DCE7E0',
  variantTag: '#B87A3D',
  variantTagBg: '#F5E4D0',
  newWordTag: '#A8505A',
  newWordTagBg: '#F2DDE0',
};

// ============================================================
// GLOSSARY (demo subset — real tool loads ~1,378 on mount)
// ============================================================

const GLOSSARY = [
  // 5-letter words matching _A_E_ pattern (for demo active slot)
  { id: 'g_james',  word: 'JAMES',  clue: 'LeBron or Harden',             sport: 'NBA',    type: 'player',   lastUsed: null },
  { id: 'g_lakes',  word: 'LAKER',  clue: 'LA hardwood icon',             sport: 'NBA',    type: 'team',     lastUsed: 42 },
  { id: 'g_gamer',  word: 'GAMER',  clue: 'Clutch performer, slangily',   sport: 'General',type: 'other',    lastUsed: null },
  { id: 'g_named',  word: 'NAMED',  clue: 'Made honorable mention',       sport: 'General',type: 'action',   lastUsed: 18 },
  { id: 'g_paced',  word: 'PACED',  clue: 'Controlled the tempo',         sport: 'General',type: 'action',   lastUsed: null },
  { id: 'g_tamed',  word: 'TAMED',  clue: 'Calmed a hot streak',          sport: 'General',type: 'action',   lastUsed: 71 },
  { id: 'g_based',  word: 'BASED',  clue: 'Positioned, in baseball',      sport: 'MLB',    type: 'action',   lastUsed: null },
  { id: 'g_raved',  word: 'RAVED',  clue: 'Gushed post-game',             sport: 'General',type: 'action',   lastUsed: 124 },
  { id: 'g_caged',  word: 'CAGED',  clue: 'MMA venue, in slang',          sport: 'MMA',    type: 'nickname', lastUsed: null },
  { id: 'g_faded',  word: 'FADED',  clue: 'Jumper that looks just so',    sport: 'NBA',    type: 'action',   lastUsed: 3 },

  // Other sports terms
  { id: 'g_kobe',   word: 'KOBE',   clue: '"Black Mamba"',                sport: 'NBA',    type: 'player',   lastUsed: null },
  { id: 'g_serena', word: 'SERENA', clue: '23-time Slam champ',           sport: 'Tennis', type: 'player',   lastUsed: null },
  { id: 'g_deion',  word: 'DEION',  clue: '"Neon" Sanders',               sport: 'NFL',    type: 'player',   lastUsed: null },
  { id: 'g_brady',  word: 'BRADY',  clue: 'TB12',                         sport: 'NFL',    type: 'player',   lastUsed: 8 },
  { id: 'g_arod',   word: 'AROD',   clue: 'Yankee slugger, shorthand',    sport: 'MLB',    type: 'nickname', lastUsed: null },
  { id: 'g_kings',  word: 'KINGS',  clue: 'LA NHL club, or Sac NBA',      sport: 'Multi',  type: 'team',     lastUsed: 61 },
  { id: 'g_eagle',  word: 'EAGLE',  clue: '2-under-par',                  sport: 'Golf',   type: 'stat',     lastUsed: 14 },
  { id: 'g_mamba',  word: 'MAMBA',  clue: 'Kobe\'s second skin',          sport: 'NBA',    type: 'nickname', lastUsed: 42 },
  { id: 'g_splash', word: 'SPLASH', clue: 'Curry\'s signature',           sport: 'NBA',    type: 'action',   lastUsed: null },

  // Some that WON'T match the pattern (shown as greyed/hidden)
  { id: 'g_nba',    word: 'NBA',    clue: 'Stern\'s baby',                sport: 'NBA',    type: 'team',     lastUsed: 9 },
  { id: 'g_par',    word: 'PAR',    clue: 'Expected score',               sport: 'Golf',   type: 'stat',     lastUsed: null },
  { id: 'g_ichiro', word: 'ICHIRO', clue: 'Mariners Hall of Famer',       sport: 'MLB',    type: 'player',   lastUsed: null },
];

// ============================================================
// DEMO GRID STATE (mid-build, mock for visual fidelity)
// ============================================================

// 7x7 grid. B = black, empty string = letter cell unfilled, letter = filled
function makeInitialGrid() {
  const B = null;
  const _ = '';
  return [
    [B,   'K', 'O', 'B', 'E',  B,   B  ],
    [B,   'I', _,   _,   'A',  B,   B  ],
    [B,   'N', _,   _,   'G',  _,   _  ],
    [B,   'G', _,   _,   'L',  _,   _  ],
    [B,   'S', 'E', 'R', 'E', 'N', 'A' ],
    [B,    B,   B,   B,   B,  _,   _  ],
    [B,    B,   B,   B,   B,  _,   _  ],
  ];
}

// Pre-placed words (derived in real build; hardcoded for mock fidelity)
const INITIAL_PLACED = [
  { key: 'kobe',   number: 1, direction: 'across', row: 0, col: 1, word: 'KOBE',   clue: '"Black Mamba"',                 glossaryId: 'g_kobe',   source: 'glossary' },
  { key: 'kings',  number: 1, direction: 'down',   row: 0, col: 1, word: 'KINGS',  clue: 'LA NHL club, or Sac NBA',       glossaryId: 'g_kings',  source: 'glossary' },
  { key: 'serena', number: 5, direction: 'across', row: 4, col: 1, word: 'SERENA', clue: '23-time Slam champ',            glossaryId: 'g_serena', source: 'glossary' },
  { key: 'eagle',  number: 2, direction: 'down',   row: 0, col: 4, word: 'EAGLE',  clue: 'Two strokes under par, or a Philly pro', glossaryId: 'g_eagle', source: 'variant' },
];

// ============================================================
// ROOT
// ============================================================

export default function PuzzleBuilder() {
  const [dims, setDims] = useState({ rows: 7, cols: 7 });
  const [mode, setMode] = useState('fill'); // 'fill' | 'shape'
  const [grid, setGrid] = useState(makeInitialGrid());
  const [activeCell, setActiveCell] = useState([2, 2]);
  const [direction, setDirection] = useState('down');
  const [placedWords, setPlacedWords] = useState(INITIAL_PLACED);
  const [title, setTitle] = useState('Lakers, Kings & Slammers');
  const [difficulty, setDifficulty] = useState(3);
  const [search, setSearch] = useState('');
  const [lengthFilter, setLengthFilter] = useState('auto'); // auto | any | 2..10
  const [freshFilter, setFreshFilter] = useState('any');    // any | never | 30d

  // Derived: active slot pattern
  const activeSlot = useMemo(() => {
    if (!activeCell) return null;
    return computeSlot(grid, activeCell, direction);
  }, [grid, activeCell, direction]);

  // Derived: filtered glossary (matches pattern + search + filters)
  const filteredResults = useMemo(() => {
    if (!activeSlot) return [];
    const targetLen = lengthFilter === 'auto' ? activeSlot.length
                    : lengthFilter === 'any'  ? null
                    : parseInt(lengthFilter);

    return GLOSSARY.filter(entry => {
      if (targetLen && entry.word.length !== targetLen) return false;
      if (!matchesPattern(entry.word, activeSlot.pattern)) return false;
      if (search && !entry.word.toLowerCase().includes(search.toLowerCase()) &&
                     !entry.clue.toLowerCase().includes(search.toLowerCase())) return false;
      if (freshFilter === 'never' && entry.lastUsed !== null) return false;
      if (freshFilter === '30d' && entry.lastUsed !== null && entry.lastUsed < 30) return false;
      return true;
    });
  }, [activeSlot, search, lengthFilter, freshFilter]);

  // Derived: validation
  const validation = useMemo(() => {
    const errors = [];
    const warnings = [];

    // Example validation output (hardcoded to reflect current mock state)
    // In real tool, derive from grid + placedWords
    warnings.push({
      key: 'eagle-variant',
      type: 'warn',
      message: '2D EAGLE uses a new clue variant (differs from glossary)',
      ref: 'eagle',
    });
    warnings.push({
      key: 'unfilled',
      type: 'warn',
      message: '11 letter cells still empty',
    });
    errors.push({
      key: 'orphan-row5',
      type: 'error',
      message: 'Orphan letter cells at row 5 col 5–6 (not part of any word)',
    });

    return { errors, warnings };
  }, [grid, placedWords]);

  // Grid interactions
  function handleCellClick(r, c) {
    if (mode === 'shape') {
      // Toggle black/letter
      const next = grid.map(row => [...row]);
      next[r][c] = next[r][c] === null ? '' : null;
      setGrid(next);
    } else {
      // Fill mode: select
      if (grid[r][c] === null) return; // can't select black
      if (activeCell && activeCell[0] === r && activeCell[1] === c) {
        // Re-click same cell: flip direction
        setDirection(direction === 'across' ? 'down' : 'across');
      } else {
        setActiveCell([r, c]);
      }
    }
  }

  function handleKeyDown(e) {
    if (mode !== 'fill' || !activeCell) return;
    const [r, c] = activeCell;
    if (e.key === 'Tab') {
      e.preventDefault();
      setDirection(direction === 'across' ? 'down' : 'across');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      const next = grid.map(row => [...row]);
      if (next[r][c] !== null) {
        next[r][c] = e.key.toUpperCase();
        setGrid(next);
        // Advance
        const [nr, nc] = direction === 'across' ? [r, c + 1] : [r + 1, c];
        if (nr < dims.rows && nc < dims.cols && grid[nr]?.[nc] !== null) {
          setActiveCell([nr, nc]);
        }
      }
    } else if (e.key === 'Backspace') {
      const next = grid.map(row => [...row]);
      if (next[r][c] !== null) {
        next[r][c] = '';
        setGrid(next);
      }
    }
  }

  function handlePlaceWord(entry) {
    if (!activeSlot) return;
    const next = grid.map(row => [...row]);
    const { startRow, startCol, length } = activeSlot;
    for (let i = 0; i < length; i++) {
      const r = direction === 'across' ? startRow : startRow + i;
      const c = direction === 'across' ? startCol + i : startCol;
      next[r][c] = entry.word[i];
    }
    setGrid(next);
    // Add to placed words (demo; real logic dedupes by position+direction)
    const newPlaced = {
      key: entry.id + '_' + Date.now(),
      number: activeSlot.number,
      direction,
      row: startRow,
      col: startCol,
      word: entry.word,
      clue: entry.clue,
      glossaryId: entry.id,
      source: 'glossary',
    };
    setPlacedWords([...placedWords, newPlaced]);
  }

  function handleClueEdit(placedKey, newClue, originalGlossaryClue) {
    setPlacedWords(placedWords.map(p => {
      if (p.key !== placedKey) return p;
      const source = newClue === originalGlossaryClue ? 'glossary' :
                     p.glossaryId === null ? 'new-word' : 'variant';
      return { ...p, clue: newClue, source };
    }));
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        minHeight: '100vh',
        background: t.bg,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: t.text,
        outline: 'none',
      }}
    >
      <AdminHeader />
      <BuilderTopBar
        title={title} setTitle={setTitle}
        difficulty={difficulty} setDifficulty={setDifficulty}
        errorCount={validation.errors.length}
      />

      {/* Main work area: left grid + right slot/search */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 440px',
        gap: 20,
        padding: '20px 32px 0',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        <LeftPane
          dims={dims} setDims={setDims}
          mode={mode} setMode={setMode}
          grid={grid}
          activeCell={activeCell}
          direction={direction}
          placedWords={placedWords}
          onCellClick={handleCellClick}
        />
        <RightPane
          activeSlot={activeSlot}
          direction={direction}
          search={search} setSearch={setSearch}
          lengthFilter={lengthFilter} setLengthFilter={setLengthFilter}
          freshFilter={freshFilter} setFreshFilter={setFreshFilter}
          results={filteredResults}
          onPlaceWord={handlePlaceWord}
        />
      </div>

      {/* Bottom: placed words + validation */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 20,
        padding: '20px 32px 40px',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        <PlacedWordsPanel
          placedWords={placedWords}
          onClueEdit={handleClueEdit}
        />
        <ValidationPanel validation={validation} />
      </div>
    </div>
  );
}

// ============================================================
// ADMIN HEADER (shared chrome)
// ============================================================

function AdminHeader() {
  return (
    <div style={{
      background: t.surface,
      borderBottom: `1px solid ${t.border}`,
      padding: '14px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontWeight: 900, fontSize: 17, letterSpacing: 1.5,
          color: t.text,
        }}>
          SPORTS WORDS<span style={{ color: t.hero, marginLeft: 8 }}>/ ADMIN</span>
        </div>
        <nav style={{ display: 'flex', gap: 24 }}>
          <NavLink label="Dashboard" />
          <NavLink label="Queue" />
          <NavLink label="Drafts" />
          <NavLink label="Builder" active />
          <NavLink label="History" />
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: t.textMuted }}>evan@sportswords.app</span>
      </div>
    </div>
  );
}

function NavLink({ label, active }) {
  return (
    <span style={{
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      color: active ? t.text : t.textMuted,
      cursor: 'pointer',
      borderBottom: active ? `2px solid ${t.hero}` : '2px solid transparent',
      paddingBottom: 4,
    }}>{label}</span>
  );
}

// ============================================================
// BUILDER TOP BAR
// ============================================================

function BuilderTopBar({ title, setTitle, difficulty, setDifficulty, errorCount }) {
  return (
    <div style={{
      background: t.surface,
      borderBottom: `1px solid ${t.border}`,
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      <button style={{
        background: 'transparent',
        color: t.textMuted,
        border: 'none',
        padding: '6px 10px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}>← Drafts</button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            color: t.textMuted, marginBottom: 2, textTransform: 'uppercase',
          }}>Title</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled puzzle"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              fontFamily: 'Georgia, serif',
              fontWeight: 900, fontSize: 22,
              color: t.text,
              outline: 'none',
              padding: 0,
              letterSpacing: -0.3,
            }}
          />
        </div>

        <div>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            color: t.textMuted, marginBottom: 4, textTransform: 'uppercase',
          }}>Difficulty</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[1,2,3,4,5].map(n => (
              <button key={n}
                onClick={() => setDifficulty(n)}
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: n <= difficulty ? t.hero : t.borderSoft,
                  border: 'none', cursor: 'pointer', padding: 0,
                }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {errorCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: t.error,
            background: t.errorTint,
            padding: '4px 10px',
            borderRadius: 12,
          }}>{errorCount} error{errorCount !== 1 ? 's' : ''} — fix to save</span>
        )}
        <button style={{
          background: errorCount > 0 ? t.borderSoft : t.hero,
          color: errorCount > 0 ? t.textMuted : '#fff',
          border: 'none',
          padding: '10px 18px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          cursor: errorCount > 0 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          letterSpacing: 1,
        }}>SAVE DRAFT</button>
        <button style={{
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
        }}>⋯</button>
      </div>
    </div>
  );
}

// ============================================================
// LEFT PANE — Grid + controls
// ============================================================

function LeftPane({ dims, setDims, mode, setMode, grid, activeCell, direction, placedWords, onCellClick }) {
  const numbering = useMemo(() => computeNumbering(grid), [grid]);

  // Which cells are part of active word
  const activeWordCells = useMemo(() => {
    if (!activeCell) return new Set();
    return computeActiveWordCells(grid, activeCell, direction);
  }, [grid, activeCell, direction]);

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        padding: '12px 14px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <ModeToggle mode={mode} setMode={setMode} />
        <div style={{ width: 1, height: 24, background: t.borderSoft }} />
        <DimensionsPicker dims={dims} setDims={setDims} />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 0.5 }}>
          {mode === 'fill' ? 'Click a cell to select · Tab flips direction · Type letters directly'
                           : 'Click any cell to toggle black/letter'}
        </div>
      </div>

      {/* Grid */}
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        padding: 20,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <Grid
          grid={grid}
          dims={dims}
          numbering={numbering}
          activeCell={activeCell}
          activeWordCells={activeWordCells}
          mode={mode}
          onCellClick={onCellClick}
        />
      </div>
    </div>
  );
}

function ModeToggle({ mode, setMode }) {
  return (
    <div style={{
      display: 'flex',
      background: t.surfaceAlt,
      border: `1px solid ${t.border}`,
      borderRadius: 4,
      padding: 2,
    }}>
      {[{k:'fill', l:'Fill'}, {k:'shape', l:'Shape'}].map(o => (
        <button key={o.k}
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
          }}>{o.l}</button>
      ))}
    </div>
  );
}

function DimensionsPicker({ dims, setDims }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
        Dims
      </span>
      <select
        value={dims.rows}
        onChange={e => setDims({ ...dims, rows: parseInt(e.target.value) })}
        style={selectStyle}
      >
        {[3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <span style={{ color: t.textSoft, fontSize: 12 }}>×</span>
      <select
        value={dims.cols}
        onChange={e => setDims({ ...dims, cols: parseInt(e.target.value) })}
        style={selectStyle}
      >
        {[3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}

function Grid({ grid, dims, numbering, activeCell, activeWordCells, mode, onCellClick }) {
  const CELL_SIZE = 52;
  const gridW = dims.cols * CELL_SIZE;
  const gridH = dims.rows * CELL_SIZE;

  return (
    <div style={{
      width: gridW,
      height: gridH,
      display: 'grid',
      gridTemplateColumns: `repeat(${dims.cols}, ${CELL_SIZE}px)`,
      gridTemplateRows: `repeat(${dims.rows}, ${CELL_SIZE}px)`,
      border: `2px solid ${t.borderStrong}`,
    }}>
      {Array.from({ length: dims.rows }).map((_, r) =>
        Array.from({ length: dims.cols }).map((__, c) => {
          const cell = grid[r]?.[c];
          const isBlack = cell === null;
          const isSelected = activeCell && activeCell[0] === r && activeCell[1] === c;
          const isInActiveWord = activeWordCells.has(`${r},${c}`);
          const num = numbering[r]?.[c];

          let bg = t.surface;
          if (isBlack) bg = t.black;
          else if (isSelected) bg = t.hero;
          else if (isInActiveWord) bg = t.heroTint;

          const letterColor = isBlack ? 'transparent' : isSelected ? '#fff' : t.text;
          const numColor = isSelected ? '#E5E0D5' : t.textMuted;

          return (
            <div
              key={`${r}-${c}`}
              onClick={() => onCellClick(r, c)}
              style={{
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
              {num && !isBlack && (
                <span style={{
                  position: 'absolute',
                  top: 3, left: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  color: numColor,
                }}>{num}</span>
              )}
              <span style={{
                fontSize: 28,
                fontWeight: 700,
                color: letterColor,
              }}>{cell || ''}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// RIGHT PANE — Active slot + search
// ============================================================

function RightPane({ activeSlot, direction, search, setSearch, lengthFilter, setLengthFilter, freshFilter, setFreshFilter, results, onPlaceWord }) {
  return (
    <div>
      {/* Active slot */}
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        marginBottom: 16,
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${t.borderSoft}`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: t.textMuted, marginBottom: 4, textTransform: 'uppercase',
          }}>Active slot</div>
          {activeSlot ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontWeight: 900, fontSize: 18, color: t.text,
              }}>
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

        {/* Pattern visualization */}
        {activeSlot && (
          <div style={{ padding: '14px 16px', display: 'flex', gap: 4, justifyContent: 'center' }}>
            {activeSlot.pattern.map((ch, i) => (
              <div key={i} style={{
                width: 28, height: 32,
                background: ch ? t.heroTint : t.surfaceAlt,
                border: `1px solid ${ch ? t.hero : t.borderSoft}`,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: ch ? t.hero : t.textSoft,
              }}>{ch || '·'}</div>
            ))}
          </div>
        )}
      </div>

      {/* Search panel */}
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
      }}>
        {/* Search input */}
        <div style={{ padding: '14px 16px 10px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
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

        {/* Filter row */}
        <div style={{
          padding: '0 16px 12px',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}>
          <FilterSelect
            label="LEN"
            value={lengthFilter}
            onChange={setLengthFilter}
            options={[
              { v: 'auto', l: `Auto${activeSlot ? ` (${activeSlot.length})` : ''}` },
              { v: 'any', l: 'Any' },
              ...[2,3,4,5,6,7,8,9,10].map(n => ({ v: String(n), l: String(n) })),
            ]}
          />
          <FilterSelect
            label="FRESH"
            value={freshFilter}
            onChange={setFreshFilter}
            options={[
              { v: 'any',   l: 'Any' },
              { v: 'never', l: 'Never used' },
              { v: '30d',   l: '30+ days ago' },
            ]}
          />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
            {results.length} match{results.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {/* Results list */}
        <div style={{
          borderTop: `1px solid ${t.borderSoft}`,
          maxHeight: 440,
          overflowY: 'auto',
        }}>
          {results.length === 0 ? (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: t.textMuted,
              fontSize: 13,
            }}>
              No matches. Try relaxing the filters or typing the word directly into the grid.
            </div>
          ) : (
            results.map(entry => (
              <GlossaryResult key={entry.id} entry={entry} onClick={() => onPlaceWord(entry)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1,
        color: t.textMuted,
      }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={selectStyle}
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function GlossaryResult({ entry, onClick }) {
  const fresh = entry.lastUsed === null ? 'never used'
              : entry.lastUsed > 365 ? `${Math.floor(entry.lastUsed/30)}mo ago`
              : `${entry.lastUsed}d ago`;
  const freshColor = entry.lastUsed === null || entry.lastUsed > 90 ? t.success
                   : entry.lastUsed > 30 ? t.textMuted : t.warn;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${t.borderSoft}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = t.heroFaint}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 15, fontWeight: 700,
            color: t.text,
            letterSpacing: 1,
          }}>{entry.word}</div>
          <div style={{ fontSize: 11, color: t.textSoft }}>
            {entry.sport} · {entry.type}
          </div>
        </div>
        <div style={{
          fontSize: 12,
          color: t.textMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{entry.clue}</div>
      </div>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: freshColor,
        whiteSpace: 'nowrap',
      }}>{fresh}</div>
    </div>
  );
}

// ============================================================
// BOTTOM: PLACED WORDS (with inline clue editing)
// ============================================================

function PlacedWordsPanel({ placedWords, onClueEdit }) {
  const across = placedWords.filter(p => p.direction === 'across').sort((a,b) => a.number - b.number);
  const down = placedWords.filter(p => p.direction === 'down').sort((a,b) => a.number - b.number);

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 6,
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${t.borderSoft}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: t.textMuted, marginBottom: 4, textTransform: 'uppercase',
          }}>Placed words</div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 17, fontWeight: 900, color: t.text,
          }}>Clues</div>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {placedWords.length} placed · edit any clue inline
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <ClueColumn label="ACROSS" items={across} onClueEdit={onClueEdit} />
        <div style={{ borderLeft: `1px solid ${t.borderSoft}` }}>
          <ClueColumn label="DOWN" items={down} onClueEdit={onClueEdit} />
        </div>
      </div>
    </div>
  );
}

function ClueColumn({ label, items, onClueEdit }) {
  return (
    <div>
      <div style={{
        padding: '12px 20px 8px',
        fontSize: 10, fontWeight: 700, letterSpacing: 2,
        color: t.textMuted,
      }}>{label}</div>
      {items.length === 0 ? (
        <div style={{
          padding: '16px 20px 20px',
          color: t.textSoft,
          fontSize: 12,
          fontStyle: 'italic',
        }}>No {label.toLowerCase()} words yet</div>
      ) : (
        items.map(item => (
          <PlacedWordRow key={item.key} item={item} onClueEdit={onClueEdit} />
        ))
      )}
    </div>
  );
}

function PlacedWordRow({ item, onClueEdit }) {
  const [editing, setEditing] = useState(false);
  const [draftClue, setDraftClue] = useState(item.clue);

  const sourceStyles = {
    glossary: { bg: t.glossaryTagBg, fg: t.glossaryTag, label: 'glossary' },
    variant:  { bg: t.variantTagBg,  fg: t.variantTag,  label: 'new variant' },
    'new-word': { bg: t.newWordTagBg, fg: t.newWordTag,  label: 'new word' },
  };
  const srcStyle = sourceStyles[item.source] || sourceStyles.glossary;

  function commit() {
    onClueEdit(item.key, draftClue, item.clue);
    setEditing(false);
  }

  return (
    <div style={{
      padding: '10px 20px',
      borderTop: `1px solid ${t.borderSoft}`,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      {/* Number + word */}
      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: t.hero,
          marginBottom: 2,
        }}>{item.number}{item.direction === 'across' ? 'A' : 'D'}</div>
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13, fontWeight: 700,
          color: t.text,
          letterSpacing: 0.5,
        }}>{item.word}</div>
      </div>

      {/* Clue (editable) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={draftClue}
            onChange={e => setDraftClue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraftClue(item.clue); setEditing(false); } }}
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
            onClick={() => setEditing(true)}
            style={{
              fontSize: 12,
              color: t.text,
              cursor: 'text',
              padding: '4px 6px',
              borderRadius: 3,
              lineHeight: 1.4,
            }}
            onMouseEnter={e => e.currentTarget.style.background = t.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >{item.clue}</div>
        )}
        <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: srcStyle.fg,
            background: srcStyle.bg,
            padding: '1px 6px',
            borderRadius: 2,
          }}>{srcStyle.label}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VALIDATION PANEL
// ============================================================

function ValidationPanel({ validation }) {
  const { errors, warnings } = validation;
  const blocking = errors.length > 0;

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 6,
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${t.borderSoft}`,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 2,
          color: t.textMuted, marginBottom: 4, textTransform: 'uppercase',
        }}>Validation</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 17, fontWeight: 900,
            color: blocking ? t.error : warnings.length > 0 ? t.warn : t.success,
          }}>
            {blocking ? 'Not ready' : warnings.length > 0 ? 'Ready with notes' : 'All clear'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
          {errors.length} error{errors.length !== 1 ? 's' : ''} · {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div>
        {errors.map(e => <ValidationRow key={e.key} level="error" message={e.message} />)}
        {warnings.map(w => <ValidationRow key={w.key} level="warn" message={w.message} />)}
        {errors.length === 0 && warnings.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center' }}>
            <div style={{
              fontSize: 26,
              marginBottom: 6,
            }}>✓</div>
            <div style={{ fontSize: 13, color: t.success, fontWeight: 600 }}>
              Grid is complete and valid
            </div>
          </div>
        )}
      </div>

      <div style={{
        padding: '10px 20px',
        borderTop: `1px solid ${t.borderSoft}`,
        background: t.surfaceAlt,
        fontSize: 11,
        color: t.textMuted,
        lineHeight: 1.5,
      }}>
        {blocking ? (
          <><strong style={{ color: t.error }}>✗ Errors block save.</strong> Fix the issues above to enable Save Draft.</>
        ) : (
          <>Warnings don't block save — review them if desired.</>
        )}
      </div>
    </div>
  );
}

function ValidationRow({ level, message }) {
  const cfg = {
    error: { icon: '✗', color: t.error, bg: t.errorTint },
    warn:  { icon: '⚠', color: t.warn,  bg: t.warnTint },
  }[level];

  return (
    <div style={{
      padding: '10px 20px',
      borderBottom: `1px solid ${t.borderSoft}`,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <div style={{
        width: 20, height: 20,
        borderRadius: '50%',
        background: cfg.bg,
        color: cfg.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}>{cfg.icon}</div>
      <div style={{
        fontSize: 12,
        color: t.text,
        lineHeight: 1.4,
        paddingTop: 2,
      }}>{message}</div>
    </div>
  );
}

// ============================================================
// PURE HELPERS
// ============================================================

function computeSlot(grid, activeCell, direction) {
  const [r, c] = activeCell;
  if (!grid[r] || grid[r][c] === null || grid[r][c] === undefined) return null;

  let startRow = r, startCol = c;
  if (direction === 'across') {
    while (startCol > 0 && grid[r][startCol - 1] !== null) startCol--;
  } else {
    while (startRow > 0 && grid[startRow - 1]?.[c] !== null && grid[startRow - 1]?.[c] !== undefined) startRow--;
  }

  const pattern = [];
  if (direction === 'across') {
    let col = startCol;
    while (col < grid[0].length && grid[r][col] !== null) {
      pattern.push(grid[r][col] || '');
      col++;
    }
  } else {
    let row = startRow;
    while (row < grid.length && grid[row]?.[c] !== null && grid[row]?.[c] !== undefined) {
      pattern.push(grid[row][c] || '');
      row++;
    }
  }

  // Compute number at startRow, startCol
  const numbering = computeNumbering(grid);
  const number = numbering[startRow]?.[startCol] || '?';

  return {
    startRow, startCol,
    length: pattern.length,
    pattern,
    number,
  };
}

function computeActiveWordCells(grid, activeCell, direction) {
  const set = new Set();
  const slot = computeSlot(grid, activeCell, direction);
  if (!slot) return set;
  for (let i = 0; i < slot.length; i++) {
    const r = direction === 'across' ? slot.startRow : slot.startRow + i;
    const c = direction === 'across' ? slot.startCol + i : slot.startCol;
    set.add(`${r},${c}`);
  }
  return set;
}

function computeNumbering(grid) {
  const num = grid.map(row => row.map(() => null));
  let counter = 1;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === null) continue;
      const startsAcross = (c === 0 || grid[r][c-1] === null) &&
                           (c + 1 < grid[r].length && grid[r][c+1] !== null);
      const startsDown = (r === 0 || grid[r-1]?.[c] === null || grid[r-1]?.[c] === undefined) &&
                         (r + 1 < grid.length && grid[r+1]?.[c] !== null && grid[r+1]?.[c] !== undefined);
      if (startsAcross || startsDown) {
        num[r][c] = counter++;
      }
    }
  }
  return num;
}

function matchesPattern(word, pattern) {
  if (word.length !== pattern.length) return false;
  for (let i = 0; i < word.length; i++) {
    if (pattern[i] && word[i] !== pattern[i]) return false;
  }
  return true;
}

// ============================================================
// SHARED STYLES
// ============================================================

const selectStyle = {
  padding: '5px 8px',
  background: t.surface,
  border: `1px solid ${t.border}`,
  borderRadius: 3,
  fontSize: 12,
  color: t.text,
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
};
