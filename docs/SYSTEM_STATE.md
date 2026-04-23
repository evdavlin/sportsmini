# SportsMini — Cleanup & System Design (as of 2026-04-23)

## What we cleaned up today

### Database
- Deleted 8 experimental/broken drafts (Gen #1-3 SPYGATE, Try5 #2-3 CHASTAIN variants, Draft 5, Untitled puzzle, Test c2)
- Kept 2 legitimate drafts: **Bucks**, **CHASTAIN + SKILES**
- Added `shape_template` to the `puzzles.status` enum (new 5th status)
- Converted 3 shape-test drafts to `status='shape_template'`:
  - `Shape: Donut (unfillable)` — proves shape aesthetics matter
  - `Shape: Try2 (unfillable)` — also has 1 layer of black squares
  - `Shape: Try5 (fills)` — the one that worked
- Loosened `create_draft_with_glossary` RPC to allow zero-clue drafts (so shape templates can be saved in the builder)
- Added `shape_templates_view` for easy admin listing

### Code (local generator)
- Generator v4 is in `sportsmini/scripts/generate_puzzles.py`
- Shape JSON files in `sportsmini/shapes/` are **now obsolete** — shapes live in the database
- Generator needs updating to read shapes from `puzzles` table where `status='shape_template'` (see dev ticket)

## Current drafts inventory

| Title | Status | Num clues | Notes |
|---|---|---|---|
| CHASTAIN + SKILES | draft | 20 | Generator output; polish clues and queue |
| Bucks | draft | 9 | Pre-existing WIP |

| Shape | Status | Fills? | Notes |
|---|---|---|---|
| Shape: Try5 (fills) | shape_template | Yes, -6.5 score | Functional; abbreviation-heavy output |
| Shape: Donut (unfillable) | shape_template | No | Too interlocked |
| Shape: Try2 (unfillable) | shape_template | No | Too interlocked |
| brew_serena_style (in `shapes/` file) | not migrated yet | Yes, +5.4 score | Best known shape |
| brew_giannis_style (in `shapes/` file) | not migrated yet | Unknown | From Puzzle #2 |

## The working production flow

```
┌───────────────────────────────────────────────────────┐
│  1. Design shape in builder, save as shape_template   │
│     (manually set status via SQL for now, or via      │
│      new admin shapes tab once dev builds it)         │
└───────────────────────────────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────────┐
│  2. Test the shape: generator fills it, shows words   │
│     (currently: I run the solver here in chat;        │
│      eventually: "Test fill" button in admin)         │
└───────────────────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
    Low quality               Good quality
    (0 fills or               (multiple fills
    all abbreviation)         with anchor words)
         │                         │
         ▼                         ▼
    Retire shape              Generator run
    or redesign               writes 3 fills
                              as drafts
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │  3. Review in admin.   │
                        │  Polish clues. Queue.  │
                        └────────────────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │  4. Daily cron         │
                        │  publishes at 7am ET   │
                        └────────────────────────┘
```

## Shape design rules (empirically derived)

Based on Donut/Try2/Try5/SERENA-style test results:

1. **Include at least one 6+ letter slot as an anchor.** The longer the better — a single 7-letter slot stabilizes the rest of the grid by fixing letters that short words depend on.

2. **Keep 3-letter slot fraction below ~50%.** Above that, the fill devolves into scoreboard abbreviations.

3. **Prefer "chamber" layouts to full interlocking.** Shapes with black squares that create semi-isolated regions fill better than dense grid-wide interlocks.

4. **Don't put 3 or more heavily-crossed slots adjacent to each other.** That creates combinatorial explosion the solver can't resolve.

5. **Know the gold standard:** The SERENA shape (from Puzzle #1) reliably produces quality fills with score 2-5. Use it as a reference.

## Outstanding bugs (see bug-fix tickets)

1. **Test c2 partial-save error** — the Next.js app throws a Server Component render error during save. Data persists partially. Needs investigation in `lib/builder-actions.ts` or the builder page.
2. **MIA "NEW WORD" display bug** — builder flags a correctly-linked glossary clue as new. Display-only; data is fine.
3. **Builder allows 2-letter runs** — if you can draw a shape with 2-letter gaps, the builder might let you save it even though those cells won't form valid slots. Generator handles this by ignoring those cells, but the builder should warn earlier.

## Outstanding work (see dev tickets)

1. Add `/admin/shapes` tab in the admin for managing shape templates
2. Update `sportsmini/scripts/generate_puzzles.py` to read shapes from DB instead of JSON files
3. Delete obsolete shape JSON files in `sportsmini/shapes/`
4. Migrate the 2 JSON shape files (SERENA, GIANNIS) into the DB as shape_templates
