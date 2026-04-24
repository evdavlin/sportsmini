"""
Sports Words — puzzle fill generator (v4, shape quality gate).

Fixes v3's degenerate-shape problem. Adds two constraints:
1. Letter-cell density must be at least 60% of total cells.
2. Longest slot must be at least 5 letters (room for an anchor).

Shape templates are loaded from Supabase: public.puzzles where status = shape_template
(grid.pattern is a list of strings). By default one template is chosen at random per run.

Runs locally. Never exposed as a web endpoint.

Usage:
    export SUPABASE_URL=https://ckakwuuginpkreqteqkz.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=<service role key>

    python3 scripts/generate_puzzles.py --count 10
    python3 scripts/generate_puzzles.py --count 10 --all-active
    python3 scripts/generate_puzzles.py --shape-id <uuid> --count 5
    python3 scripts/generate_puzzles.py --count 10 --min-dim 6 --max-dim 7 --evolve
    python3 scripts/generate_puzzles.py --count 10 --prefer-sport basketball
    python3 scripts/generate_puzzles.py --purge-run 2026-04-23T14:22:01+00:00
"""

from __future__ import annotations

import argparse
import dataclasses
import itertools
import os
import random
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Optional

try:
    from supabase import create_client, Client
except ImportError:
    sys.stderr.write("Missing dependency: pip install supabase\n")
    sys.exit(1)


# ---------- Constraints ----------

MIN_WORD_LEN = 3
MIN_ACROSS = 4
MIN_DOWN = 4
DEFAULT_MIN_DIM = 5
DEFAULT_MAX_DIM = 8

MAX_3LETTER_SLOT_FRACTION = 0.40
MIN_LETTER_CELL_FRACTION = 0.55      # at least 55% of cells must be letters
MIN_LONGEST_SLOT_LEN = 5              # at least one slot must be 5+ letters
PREFER_LONGEST_SLOT_LEN = 6           # bonus if 6+

FILLS_PER_SHAPE = 6
MAX_SHAPE_ATTEMPTS = 500
SHAPE_FILL_TIME_BUDGET = 10.0

ANCHOR_TYPES = {
    "player", "nickname", "coach", "team", "venue", "term", "moment",
    "trophy", "event", "mascot", "brand", "broadcaster", "movie",
    "show", "journalist", "owner", "horse", "character", "action",
    "play", "position", "commissioner", "tour", "tournament",
}
LOW_VALUE_TYPES = {"stat", "league", "org", "network", "award"}


# ---------- Data types ----------

@dataclasses.dataclass(frozen=True)
class Slot:
    slot_id: int
    direction: str
    row: int
    col: int
    length: int
    cells: tuple[tuple[int, int], ...]


@dataclasses.dataclass
class GlossaryEntry:
    id: str
    word: str
    clue: str
    sport: str
    entry_type: str
    desirability: float = 0.0


# ---------- Glossary ----------

def load_glossary(supabase: Client) -> list[GlossaryEntry]:
    all_rows: list[GlossaryEntry] = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            supabase.table("crossword_glossary")
            .select("id,word,clue,sport,type")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = resp.data or []
        for row in rows:
            word = (row.get("word") or "").strip().upper()
            if not word or not word.isalnum():
                continue
            all_rows.append(
                GlossaryEntry(
                    id=str(row["id"]),
                    word=word,
                    clue=row.get("clue") or "",
                    sport=row.get("sport") or "general",
                    entry_type=row.get("type") or "other",
                )
            )
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows


def score_desirability(entry: GlossaryEntry) -> float:
    score = 0.0
    L = len(entry.word)
    if L >= 8:
        score += 8.0
    elif L == 7:
        score += 7.0
    elif L == 6:
        score += 6.0
    elif L == 5:
        score += 4.0
    elif L == 4:
        score += 2.0

    if entry.entry_type in ANCHOR_TYPES:
        score += 2.0
    elif entry.entry_type in LOW_VALUE_TYPES:
        score -= 3.0

    if entry.sport == "general":
        score -= 0.5

    if entry.entry_type == "nickname" and L <= 3:
        score -= 1.5

    return score


def index_by_length(entries: list[GlossaryEntry]) -> dict[int, list[GlossaryEntry]]:
    out: dict[int, list[GlossaryEntry]] = defaultdict(list)
    for e in entries:
        out[len(e.word)].append(e)
    for bucket in out.values():
        bucket.sort(key=lambda e: -e.desirability)
    return out


# ---------- Shape utilities ----------

def shape_dims(pattern: list[str]) -> tuple[int, int]:
    return len(pattern), len(pattern[0])


def is_letter_cell(pattern: list[str], r: int, c: int) -> bool:
    h, w = shape_dims(pattern)
    return 0 <= r < h and 0 <= c < w and pattern[r][c] == "."


def extract_slots(pattern: list[str]) -> list[Slot]:
    h, w = shape_dims(pattern)
    slots: list[Slot] = []
    sid = 0
    for r in range(h):
        for c in range(w):
            if not is_letter_cell(pattern, r, c):
                continue
            if not is_letter_cell(pattern, r, c - 1) and is_letter_cell(pattern, r, c + 1):
                cells = []
                cc = c
                while is_letter_cell(pattern, r, cc):
                    cells.append((r, cc))
                    cc += 1
                if len(cells) >= MIN_WORD_LEN:
                    slots.append(Slot(sid, "A", r, c, len(cells), tuple(cells)))
                    sid += 1
            if not is_letter_cell(pattern, r - 1, c) and is_letter_cell(pattern, r + 1, c):
                cells = []
                rr = r
                while is_letter_cell(pattern, rr, c):
                    cells.append((rr, c))
                    rr += 1
                if len(cells) >= MIN_WORD_LEN:
                    slots.append(Slot(sid, "D", r, c, len(cells), tuple(cells)))
                    sid += 1
    return slots


def shape_is_valid(pattern: list[str]) -> tuple[bool, str]:
    h, w = shape_dims(pattern)
    total_cells = h * w
    letter_cells = sum(row.count(".") for row in pattern)
    if total_cells and letter_cells / total_cells < MIN_LETTER_CELL_FRACTION:
        return False, f"letter density {letter_cells}/{total_cells} below min"

    slots = extract_slots(pattern)
    across = [s for s in slots if s.direction == "A"]
    down = [s for s in slots if s.direction == "D"]
    if len(across) < MIN_ACROSS:
        return False, f"only {len(across)} across"
    if len(down) < MIN_DOWN:
        return False, f"only {len(down)} down"

    # Every letter must be covered by at least one slot
    covered = set()
    for s in slots:
        for cell in s.cells:
            covered.add(cell)
    for r in range(h):
        for c in range(w):
            if pattern[r][c] == "." and (r, c) not in covered:
                return False, f"orphan at ({r},{c})"

    # Short-run check (redundant with snap but double-check)
    for r in range(h):
        run = 0
        for c in range(w + 1):
            if c < w and pattern[r][c] == ".":
                run += 1
            else:
                if 0 < run < MIN_WORD_LEN:
                    return False, f"row {r} short run"
                run = 0
    for c in range(w):
        run = 0
        for r in range(h + 1):
            if r < h and pattern[r][c] == ".":
                run += 1
            else:
                if 0 < run < MIN_WORD_LEN:
                    return False, f"col {c} short run"
                run = 0

    if slots:
        three_letter_count = sum(1 for s in slots if s.length == 3)
        if three_letter_count / len(slots) > MAX_3LETTER_SLOT_FRACTION:
            return False, f"{three_letter_count}/{len(slots)} 3-letter"

        longest_slot = max(s.length for s in slots)
        if longest_slot < MIN_LONGEST_SLOT_LEN:
            return False, f"longest slot only {longest_slot} letters"

    return True, "ok"


def snap_short_runs(pattern: list[str]) -> list[str]:
    h, w = shape_dims(pattern)
    grid = [list(row) for row in pattern]
    changed = True
    while changed:
        changed = False
        for r in range(h):
            run_start = None
            run_len = 0
            for c in range(w + 1):
                if c < w and grid[r][c] == ".":
                    if run_start is None:
                        run_start = c
                    run_len += 1
                else:
                    if 0 < run_len < MIN_WORD_LEN:
                        for cc in range(run_start, run_start + run_len):
                            if grid[r][cc] == ".":
                                grid[r][cc] = "#"
                                changed = True
                    run_start = None
                    run_len = 0
        for c in range(w):
            run_start = None
            run_len = 0
            for r in range(h + 1):
                if r < h and grid[r][c] == ".":
                    if run_start is None:
                        run_start = r
                    run_len += 1
                else:
                    if 0 < run_len < MIN_WORD_LEN:
                        for rr in range(run_start, run_start + run_len):
                            if grid[rr][c] == ".":
                                grid[rr][c] = "#"
                                changed = True
                    run_start = None
                    run_len = 0
    return ["".join(row) for row in grid]


def random_shape(min_dim: int, max_dim: int, rng: random.Random) -> list[str]:
    h = rng.randint(min_dim, max_dim)
    w = rng.randint(min_dim, max_dim)
    target_density = rng.uniform(0.05, 0.22)   # lower black-square density
    grid = [["." for _ in range(w)] for _ in range(h)]
    cells = [(r, c) for r in range(h) for c in range(w)]
    rng.shuffle(cells)
    n_black = int(round(target_density * h * w))
    for (r, c) in cells[:n_black]:
        grid[r][c] = "#"
    pattern = ["".join(row) for row in grid]
    pattern = snap_short_runs(pattern)
    return pattern


def mutate_shape(pattern: list[str], failing_slot: Slot, rng: random.Random) -> Optional[list[str]]:
    if failing_slot.length <= MIN_WORD_LEN:
        return None
    grid = [list(row) for row in pattern]
    candidates = []
    for i in range(MIN_WORD_LEN, failing_slot.length - MIN_WORD_LEN + 1):
        r, c = failing_slot.cells[i]
        candidates.append((r, c))
    if not candidates:
        i = failing_slot.length // 2
        r, c = failing_slot.cells[i]
        candidates = [(r, c)]
    r, c = rng.choice(candidates)
    grid[r][c] = "#"
    pattern = ["".join(row) for row in grid]
    pattern = snap_short_runs(pattern)
    return pattern


# ---------- Solver ----------

class MultiFillSolver:
    def __init__(
        self,
        slots: list[Slot],
        by_length: dict[int, list[GlossaryEntry]],
        time_budget_sec: float,
        max_fills: int,
    ):
        self.slots = slots
        self.by_length = by_length
        self.deadline = time.time() + time_budget_sec
        self.max_fills = max_fills
        self.fills: list[list[GlossaryEntry]] = []
        self.assignment: dict[int, GlossaryEntry] = {}
        self.grid_letters: dict[tuple[int, int], str] = {}
        self.deepest_remaining = len(slots)
        self.deepest_slot: Optional[Slot] = None

    def candidates_for(self, slot: Slot) -> list[GlossaryEntry]:
        pool = self.by_length.get(slot.length, [])
        constraints = []
        for i, (r, c) in enumerate(slot.cells):
            if (r, c) in self.grid_letters:
                constraints.append((i, self.grid_letters[(r, c)]))
        if not constraints:
            return pool
        return [e for e in pool if all(e.word[i] == ch for i, ch in constraints)]

    def pick_next_slot(self, remaining: list[Slot]) -> Slot:
        best = None
        best_count = None
        for s in remaining:
            count = len(self.candidates_for(s))
            if best is None or count < best_count:
                best = s
                best_count = count
        return best  # type: ignore

    def backtrack(self, remaining: list[Slot]) -> None:
        if len(self.fills) >= self.max_fills:
            return
        if time.time() > self.deadline:
            return
        if not remaining:
            self.fills.append([self.assignment[s.slot_id] for s in self.slots])
            return

        if len(remaining) < self.deepest_remaining:
            self.deepest_remaining = len(remaining)
            self.deepest_slot = None

        slot = self.pick_next_slot(remaining)
        candidates = self.candidates_for(slot)

        if not candidates and self.deepest_slot is None:
            self.deepest_slot = slot

        used_words = {e.word for e in self.assignment.values()}

        for entry in candidates:
            if entry.word in used_words:
                continue
            placed_cells = []
            conflict = False
            for i, (r, c) in enumerate(slot.cells):
                letter = entry.word[i]
                if (r, c) in self.grid_letters:
                    if self.grid_letters[(r, c)] != letter:
                        conflict = True
                        break
                else:
                    self.grid_letters[(r, c)] = letter
                    placed_cells.append((r, c))
            if not conflict:
                self.assignment[slot.slot_id] = entry
                rest = [s for s in remaining if s.slot_id != slot.slot_id]
                self.backtrack(rest)
                del self.assignment[slot.slot_id]
                if len(self.fills) >= self.max_fills:
                    for rc in placed_cells:
                        del self.grid_letters[rc]
                    return
            for rc in placed_cells:
                del self.grid_letters[rc]


def attempt_fill_multi(
    pattern: list[str],
    by_length: dict[int, list[GlossaryEntry]],
    time_budget_sec: float,
    max_fills: int,
) -> tuple[list[list[GlossaryEntry]], Optional[Slot]]:
    slots = extract_slots(pattern)
    if not slots:
        return [], None
    solver = MultiFillSolver(slots, by_length, time_budget_sec, max_fills)
    solver.backtrack(slots)
    return solver.fills, solver.deepest_slot


# ---------- Quality scoring ----------

SCORE_WEIGHTS = {
    "short_word_penalty": -2.0,
    "five_letter_bonus": 1.5,
    "six_plus_bonus": 2.5,
    "eight_plus_bonus": 3.5,
    "low_value_type_penalty": -2.5,
    "anchor_type_bonus": 0.8,
    "generic_sport_penalty": -0.5,
    "sport_variety_bonus": 0.8,
    "abbreviation_heavy_fill": -6.0,
    "black_square_penalty_per_pct_over_25": -0.3,
    "has_long_anchor_bonus": 4.0,
}


def score_candidate(fill: list[GlossaryEntry], pattern: list[str]) -> float:
    total = 0.0
    sports = Counter(e.sport for e in fill)
    n = len(fill)

    low_value_count = 0
    has_long_anchor = False

    for e in fill:
        L = len(e.word)
        if L == 3:
            total += SCORE_WEIGHTS["short_word_penalty"]
        elif L == 5:
            total += SCORE_WEIGHTS["five_letter_bonus"]
        elif L in (6, 7):
            total += SCORE_WEIGHTS["six_plus_bonus"]
            has_long_anchor = True
        elif L >= 8:
            total += SCORE_WEIGHTS["eight_plus_bonus"]
            has_long_anchor = True

        if e.entry_type in LOW_VALUE_TYPES:
            total += SCORE_WEIGHTS["low_value_type_penalty"]
            low_value_count += 1
        elif e.entry_type in ANCHOR_TYPES:
            total += SCORE_WEIGHTS["anchor_type_bonus"]

        if e.sport == "general":
            total += SCORE_WEIGHTS["generic_sport_penalty"]

    if n > 0 and low_value_count / n > 0.4:
        total += SCORE_WEIGHTS["abbreviation_heavy_fill"]

    if has_long_anchor:
        total += SCORE_WEIGHTS["has_long_anchor_bonus"]

    total += SCORE_WEIGHTS["sport_variety_bonus"] * len(sports)

    h, w = shape_dims(pattern)
    total_cells = h * w
    black_cells = sum(row.count("#") for row in pattern)
    black_pct = (black_cells / total_cells) * 100
    if black_pct > 25:
        total += SCORE_WEIGHTS["black_square_penalty_per_pct_over_25"] * (black_pct - 25)

    return round(total, 2)


# ---------- Candidate payload ----------

def build_candidate_payload(
    pattern: list[str],
    fill: list[GlossaryEntry],
    shape_name: str,
    generator_run: str,
) -> dict:
    slots = extract_slots(pattern)
    cell_number: dict[tuple[int, int], int] = {}
    next_num = 1
    for s in slots:
        key = (s.row, s.col)
        if key not in cell_number:
            cell_number[key] = next_num
            next_num += 1

    clues = []
    for s, entry in zip(slots, fill):
        clues.append({
            "word": entry.word,
            "clue_text": entry.clue,
            "row": s.row,
            "col": s.col,
            "direction": s.direction,
            "number": cell_number[(s.row, s.col)],
            "glossary_id": entry.id,
        })

    sport_breakdown = dict(Counter(e.sport for e in fill))
    h, w = shape_dims(pattern)
    return {
        "grid": {"pattern": pattern},
        "width": w,
        "height": h,
        "clues": clues,
        "quality_score": score_candidate(fill, pattern),
        "sport_breakdown": sport_breakdown,
        "generator_run": generator_run,
        "shape_name": shape_name,
        "status": "pending",
    }


# ---------- Main generation loop ----------

def generate_with_evolution(
    by_length: dict[int, list[GlossaryEntry]],
    target_count: int,
    min_dim: int,
    max_dim: int,
    rng: random.Random,
) -> list[tuple[list[str], list[GlossaryEntry], str]]:
    successes: list[tuple[list[str], list[GlossaryEntry], str]] = []
    attempts = 0

    while len(successes) < target_count and attempts < MAX_SHAPE_ATTEMPTS:
        attempts += 1
        pattern = random_shape(min_dim, max_dim, rng)
        valid, reason = shape_is_valid(pattern)
        if not valid:
            continue

        shape_label = f"random_{shape_dims(pattern)[0]}x{shape_dims(pattern)[1]}_a{attempts}"
        kept_fill = None
        kept_score = float("-inf")

        for mutation_round in range(3):
            fills, failing = attempt_fill_multi(
                pattern, by_length, SHAPE_FILL_TIME_BUDGET, FILLS_PER_SHAPE
            )
            if fills:
                for f in fills:
                    s = score_candidate(f, pattern)
                    if s > kept_score:
                        kept_score = s
                        kept_fill = f
                break

            if failing is None:
                break
            mutated = mutate_shape(pattern, failing, rng)
            if mutated is None:
                break
            valid, _ = shape_is_valid(mutated)
            if not valid:
                break
            pattern = mutated
            shape_label += f"_m{mutation_round + 1}"

        if kept_fill is not None:
            successes.append((pattern, kept_fill, shape_label))
            h_, w_ = shape_dims(pattern)
            print(f"  [{len(successes)}/{target_count}] filled {h_}x{w_} score={kept_score:.1f}")

    print(f"Total shape attempts: {attempts}, successes: {len(successes)}")
    return successes


def generate_fixed_shape(
    pattern: list[str],
    shape_name: str,
    by_length: dict[int, list[GlossaryEntry]],
    count: int,
    time_budget: float,
) -> list[tuple[list[str], list[GlossaryEntry], str]]:
    successes = []
    target_fills = count * 3
    fills, _ = attempt_fill_multi(pattern, by_length, time_budget, target_fills)
    scored = [(score_candidate(f, pattern), f) for f in fills]
    scored.sort(key=lambda x: -x[0])
    for score, f in scored[:count]:
        successes.append((pattern, f, shape_name))
        print(f"  filled {shape_name} score={score:.1f}")
    return successes


# ---------- Shape templates (DB) ----------


def load_shape_from_db(
    supabase: Client, shape_id: Optional[str] = None
) -> tuple[str, str, list[str]]:
    """
    Load one shape_template row. If shape_id is set, fetch that row; otherwise fetch all
    shape_template rows and return one at random.

    Returns (puzzle_uuid, title, pattern) where pattern is grid.pattern (list of strings).
    """
    if shape_id:
        resp = (
            supabase.table("puzzles")
            .select("id,title,grid,status")
            .eq("id", shape_id)
            .eq("status", "shape_template")
            .execute()
        )
        rows = resp.data or []
        if len(rows) != 1:
            raise RuntimeError(
                f"No shape_template puzzle found with id={shape_id!r} (got {len(rows)} row(s))."
            )
        row = rows[0]
    else:
        resp = (
            supabase.table("puzzles")
            .select("id,title,grid")
            .eq("status", "shape_template")
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise RuntimeError(
                "No rows with status='shape_template' in public.puzzles; add shape templates in the DB first."
            )
        row = random.choice(rows)

    title = (row.get("title") or "").strip() or "Untitled shape"
    grid = row.get("grid")
    if not isinstance(grid, dict):
        raise RuntimeError(f"Puzzle {row.get('id')}: grid is missing or not a JSON object.")
    pat = grid.get("pattern")
    if not isinstance(pat, list) or not pat:
        raise RuntimeError(f"Puzzle {row.get('id')}: grid.pattern is missing or empty.")
    if not all(isinstance(line, str) for line in pat):
        raise RuntimeError(f"Puzzle {row.get('id')}: grid.pattern must be a list of strings.")
    sid = str(row["id"])
    return sid, title, pat


# ---------- DB I/O ----------

def write_candidates(supabase: Client, payloads: list[dict]) -> int:
    if not payloads:
        return 0
    resp = supabase.table("puzzle_candidates").insert(payloads).execute()
    return len(resp.data or [])


def purge_run(supabase: Client, run: str) -> int:
    resp = (
        supabase.table("puzzle_candidates")
        .delete()
        .eq("generator_run", run)
        .eq("status", "pending")
        .execute()
    )
    return len(resp.data or [])


# ---------- CLI ----------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=10)
    ap.add_argument("--min-dim", type=int, default=DEFAULT_MIN_DIM)
    ap.add_argument("--max-dim", type=int, default=DEFAULT_MAX_DIM)
    ap.add_argument("--prefer-sport", type=str, default=None)
    shape_mx = ap.add_mutually_exclusive_group()
    shape_mx.add_argument(
        "--shape-id",
        type=str,
        default=None,
        metavar="UUID",
        help="Use a specific shape template (puzzles.id where status=shape_template).",
    )
    shape_mx.add_argument(
        "--all-active",
        action="store_true",
        help="Pick a random shape_template row (same as default when neither flag is set).",
    )
    ap.add_argument(
        "--evolve",
        action="store_true",
        help="Ignore DB shapes; evolve random grids within --min-dim/--max-dim (legacy mode).",
    )
    ap.add_argument("--time-budget", type=float, default=20.0)
    ap.add_argument("--purge-run", type=str, default=None)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    if args.seed is not None:
        random.seed(args.seed)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.stderr.write("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n")
        return 2
    supabase = create_client(url, key)

    if args.purge_run:
        n = purge_run(supabase, args.purge_run)
        print(f"Purged {n} pending candidates from run {args.purge_run}")
        return 0

    print("Loading glossary...")
    glossary = load_glossary(supabase)
    for e in glossary:
        e.desirability = score_desirability(e)
        if args.prefer_sport and e.sport == args.prefer_sport:
            e.desirability += 2.0
    print(f"Loaded {len(glossary)} entries")
    by_length = index_by_length(glossary)

    if args.evolve:
        if args.shape_id or args.all_active:
            ap.error("--evolve cannot be used with --shape-id or --all-active")
        print(f"Shape evolution: {args.min_dim}x{args.min_dim} to {args.max_dim}x{args.max_dim}")
        successes = generate_with_evolution(by_length, args.count, args.min_dim, args.max_dim, rng)
    else:
        try:
            sid, shape_title, pattern = load_shape_from_db(
                supabase, args.shape_id if args.shape_id else None
            )
        except RuntimeError as e:
            sys.stderr.write(f"{e}\n")
            return 2
        if args.shape_id:
            sel = "specific (--shape-id)"
        elif args.all_active:
            sel = "random (--all-active)"
        else:
            sel = "random (default)"
        h0, w0 = shape_dims(pattern)
        print(
            f"Shape selection [{sel}]: id={sid} | title={shape_title!r} | grid={h0}x{w0}"
        )
        successes = generate_fixed_shape(
            pattern, shape_title, by_length, args.count, args.time_budget
        )

    if not successes:
        print("No successful fills generated.")
        return 0

    generator_run = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")
    payloads = [build_candidate_payload(p, f, n, generator_run) for p, f, n in successes]
    payloads.sort(key=lambda p: p["quality_score"], reverse=True)

    written = write_candidates(supabase, payloads)
    print(f"Wrote {written} candidates to puzzle_candidates (run: {generator_run})")
    if payloads:
        top = payloads[0]
        print(f"Top score: {top['quality_score']}")
        print(f"Top shape: {top['width']}x{top['height']}")
        print(f"Top words: {[c['word'] for c in top['clues']]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
