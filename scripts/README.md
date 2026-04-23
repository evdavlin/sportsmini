# Sports Words — Puzzle Fill Generator

Local script that generates candidate puzzle fills and writes them to the
`puzzle_candidates` table in Supabase. Reviewed and promoted into drafts
from the admin UI.

## Setup

Drop these into your existing `sportsmini` repo:

```
sportsmini/
├── scripts/
│   └── generate_puzzles.py
└── shapes/
    ├── mini_5x5_open.json
    ├── mini_5x5_cut_corners.json
    ├── mini_6x6_plus.json
    ├── brew_serena_style.json
    └── brew_giannis_style.json
```

Install the Supabase Python client:

```
pip install supabase
```

Set env vars (use the **service role** key, not the publishable key — this
script needs to write to `puzzle_candidates` which is server-side only):

```
export SUPABASE_URL=https://ckakwuuginpkreqteqkz.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

**Never commit these vars or run the script from a public-facing endpoint.**
The service role bypasses any RLS that gets added later.

## Usage

Generate 20 candidate fills for a 5x5 grid:

```
python scripts/generate_puzzles.py \
    --shape shapes/mini_5x5_open.json \
    --count 20 \
    --time-budget 30
```

Bias toward a specific sport:

```
python scripts/generate_puzzles.py \
    --shape shapes/brew_giannis_style.json \
    --count 15 \
    --prefer-sport basketball
```

Purge pending candidates from a bad batch (use the ISO timestamp printed
when the batch ran):

```
python scripts/generate_puzzles.py --purge-run 2026-04-23T14:22:01+00:00
```

## How the pipeline connects

```
generate_puzzles.py
      │
      ▼
puzzle_candidates        ← you run this script
      │
      ▼
/admin/candidates        ← (to be built) list pending by quality_score
      │                    "promote" button calls create_draft_with_glossary
      ▼
puzzles (status=draft)
      │
      ▼
/admin/builder           ← existing — polish clues, fix edges, save
      │
      ▼
puzzle queue             ← existing — reorder, schedule
      │
      ▼
cron @ 11 UTC            ← existing
      │
      ▼
live on sportsmini.vercel.app
```

The generator writes candidates but **never** promotes them directly —
promotion goes through the same RPC path a DSL paste-in uses, so
glossary linking, variant-row fallbacks, and validation all apply.

## Shape templates

Each shape is a simple JSON file in `shapes/`:

```json
{
  "name": "my_shape_name",
  "description": "human-readable notes about the shape",
  "pattern": [
    ".....",
    ".....",
    "....."
  ]
}
```

- `.` = letter cell
- `#` = black square
- All rows must be equal length
- Dimensions 3-10 in either direction
- Every answer must be 3+ letters (the extractor enforces this)

To add a new shape: sketch it on paper, translate to `.`/`#`, save as JSON.
The generator auto-derives the slot layout.

## Quality scoring

Scoring is in `SCORE_WEIGHTS` at the top of `generate_puzzles.py`. Current
heuristics:

- Penalize short (3-letter) words, heavier penalty if the fill is mostly
  abbreviations
- Bonus for sport variety
- Bonus for 6+ letter words
- Penalty for `general`-sport words (too generic for a sports puzzle)

Tweak these in one place. If you want to add freshness scoring based on
`last_used_at` from the glossary, there's a placeholder weight in the
dict; the solver loader would need to pull that column and the score
function would need to check it.

## Operating cadence

One reasonable pattern, now that queue can run dry:

1. **Weekly batch**: run the generator against 2-3 shapes, ~20 candidates
   each. ~60 candidates in the pool.
2. **Review in admin**: pick the 7 strongest for the coming week, promote
   them to drafts.
3. **Builder pass**: open each draft in the builder, polish clues, save.
4. **Queue**: drop them into the queue in desired order.
5. **Let cron do the rest**.

Total human time: ~30 minutes per week once the rhythm is established.

## What this does not do

- Does not write clues. It uses the existing clue from the glossary entry.
  Polishing to your voice still happens in the builder.
- Does not pick shapes. You curate the shape library; the generator just
  fills them.
- Does not promote candidates automatically. Review is manual until you
  specifically decide to auto-promote high-score candidates.
- Does not expand the vocabulary. If a shape produces zero fills, it
  either means the shape is too constrained or the glossary has a gap.
  Your inline add-to-glossary CTA during builder authoring is still the
  primary expansion path.
