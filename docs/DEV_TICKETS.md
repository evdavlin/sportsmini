# SportsMini — Dev Tickets (next sprint)

Context: We've been building a puzzle generator that produces candidate fills
against hand-designed shape templates. The database changes and status enum
are already applied. These tickets cover the app changes needed to make the
workflow usable without manual SQL.

## Ticket 1: Add `/admin/shapes` tab for shape template management

### What

New admin page that lists `puzzles` rows where `status='shape_template'`
and lets the admin:
- See each shape's grid rendered (reuse the read-only grid component)
- Create new shapes via the builder
- Delete shapes
- Tag shapes as "active" vs "retired" (see Ticket 4)

### Where

- `app/admin/shapes/page.tsx` (list)
- `app/admin/shapes/new/page.tsx` (redirects to `/admin/builder?mode=shape`)
- Add "Shapes" tab to `AdminShell.tsx`
- New fetcher in `lib/admin.ts`: `getShapeTemplates()`

### Data source

Use the `shape_templates_view` already created in Supabase:

```sql
SELECT * FROM public.shape_templates_view;
```

Columns: `id, title, width, height, grid, created_at, updated_at, letter_cell_count, total_cells`.

### Builder changes

The existing `/admin/builder` page should accept a new query param `?mode=shape`
that:
- Hides the clue-editing panel (we're editing grid only)
- Changes the save button from "Save Draft" to "Save Shape Template"
- On save, calls `create_draft_with_glossary` with an empty `clues` array
  (the RPC already accepts this), then immediately runs a SQL UPDATE to
  set `status='shape_template'`. OR:
- Preferred: create a new RPC `create_shape_template(p_payload jsonb)` that
  does both atomically.

### Recommended RPC

```sql
CREATE OR REPLACE FUNCTION public.create_shape_template(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
declare
  v_puzzle_id uuid;
begin
  if p_payload->>'title' is null or p_payload->>'title' = '' then
    raise exception 'title is required';
  end if;
  if p_payload->'grid' is null then
    raise exception 'grid is required';
  end if;

  insert into public.puzzles (title, difficulty, width, height, grid, status)
  values (
    p_payload->>'title',
    3,  -- default difficulty for shapes (unused)
    (p_payload->>'width')::smallint,
    (p_payload->>'height')::smallint,
    p_payload->'grid',
    'shape_template'
  )
  returning id into v_puzzle_id;

  return jsonb_build_object('shape_id', v_puzzle_id);
end;
$$;
```

### Estimated effort

~4 hours including builder mode switch.

---

## Ticket 2: Update generate_puzzles.py to read shapes from DB

### What

Currently the generator reads shape patterns from JSON files in
`sportsmini/shapes/`. Change it to read from the database instead.

### Where

`sportsmini/scripts/generate_puzzles.py`

### Changes

Replace the `--shape <path>` flag with:
- `--shape-id <uuid>` — run against a specific shape
- `--all-active` — run against all shape_templates (default)

Load shapes via Supabase:

```python
resp = (
    supabase.table('puzzles')
    .select('id,title,grid,width,height')
    .eq('status', 'shape_template')
    .execute()
)
```

Delete the `shapes/` directory after migrating the two known-good shapes
into the DB (see Ticket 5).

### Estimated effort

~2 hours.

---

## Ticket 3: Fix Test c2 partial-save bug

### Reproduction

1. Open `/admin/builder` against an existing draft
2. Edit the title and/or some clues
3. Click Save Draft

### Symptom

- Error page: "An error occurred in the Server Components render."
- Grid and some clues DID save to DB
- Title may NOT have saved
- User sees an error but doesn't know what state the data is in

### Investigation

The `update_draft_with_glossary` RPC works correctly when called directly
with the same payload. So the bug is in the Next.js server action or the
page that re-renders after save.

Likely suspects:
- `lib/builder-actions.ts` — the `saveDraftAction` or similar
- `app/admin/builder/page.tsx` — the post-save re-render
- `app/admin/drafts/page.tsx` — if the redirect goes here

### What to check

1. Vercel logs for the actual exception (production shields it)
2. Run locally with `npm run dev` and reproduce — the real stack trace will
   be in terminal
3. Look for any `.find()`, `.filter()`, or destructuring that might fail if
   a clue has an empty `clue_text` or missing field
4. Check if the server action is doing something like:

```ts
const { data } = await supabase.rpc('update_draft_with_glossary', ...)
redirect(`/admin/drafts/${data.puzzle_id}`)  // suspect: data.puzzle_id vs data[0].puzzle_id
```

RPC return shape is `{puzzle_id: uuid, clue_count: int, ...}`, not an array.

### Estimated effort

1-3 hours depending on whether logs give a clear line number.

---

## Ticket 4: Fix MIA "NEW WORD" display bug in builder

### Reproduction

1. Open any draft with MIA in the clues (e.g., CHASTAIN + SKILES)
2. Builder shows "NEW WORD" badge on MIA row, even though it's correctly
   linked to a glossary entry in DB

### Investigation

Data is correct: `puzzle_clues.glossary_id` points at a real
`crossword_glossary.id`. Verified via SQL. Clue text matches exactly
(same MD5 hash).

### What to check

The builder's glossary-lookup logic probably does something like:

```ts
const match = glossary.find(g => g.word === clue.word && g.clue === clue.clue_text)
if (!match) { /* show NEW WORD badge */ }
```

Problems this could have:
1. **Case sensitivity:** glossary may have some words stored without consistent uppercasing
2. **Duplicate handling:** MIA has 5 glossary rows. Does `.find()` return the right one? Should the match check also consider `sport` or `type`?
3. **Timing:** glossary loaded on builder mount. If the draft was saved AFTER mount, the glossary is stale.
4. **Better:** use `clue.glossary_id` directly. The `puzzle_clues` table already stores the FK. Match via `glossary.find(g => g.id === clue.glossary_id)` — more reliable than word+clue text matching.

### Recommended fix

Refactor the lookup to use `glossary_id` as the primary match, falling back
to word+clue only if `glossary_id` is null. This aligns the UI with the
actual DB relationship.

### Estimated effort

1-2 hours.

---

## Ticket 5: Migrate known-good shape JSON files into DB

### What

Two JSON shape files in `sportsmini/shapes/` (brew_serena_style, brew_giannis_style)
have been verified to produce quality fills. Move them into the DB as
shape_templates, then delete the JSON files.

### How

SQL one-liner (or run through the new `/admin/shapes/new` page once Ticket 1 ships):

```sql
INSERT INTO public.puzzles (title, difficulty, width, height, grid, status)
VALUES (
  'Shape: Brew Serena (gold standard)',
  3, 8, 8,
  '{"pattern":["##.#####","##.###.#","##.#.#.#","#......#","#.......","....#...","#...###.","#.######"]}'::jsonb,
  'shape_template'
);

INSERT INTO public.puzzles (title, difficulty, width, height, grid, status)
VALUES (
  'Shape: Brew Giannis',
  3, 8, 7,
  '{"pattern":["######.","####...","##.....","#.....#",".......","...#.##",".#.####","##.####"]}'::jsonb,
  'shape_template'
);
```

Then delete `sportsmini/shapes/` directory.

### Estimated effort

15 minutes.

---

## Ticket 6: Update AdminShell to visually separate shapes from drafts

### What

Make sure `/admin/drafts` only shows `status='draft'` — not shape_templates.
Same for `/admin/history` (already archived only). The pipeline_summary
dashboard card should only count drafts.

### What to check

- `lib/admin.ts` `getAdminPuzzles()` — does it filter by status explicitly?
- Dashboard queries — already use `pipeline_summary` view which doesn't
  count shape_templates, so this should be fine

If `getAdminPuzzles()` returns all statuses, add an explicit filter:

```ts
const statusFilter = options?.status ?? ['draft', 'queued', 'published', 'archived']
// i.e. default excludes shape_template
```

### Estimated effort

30 minutes.

---

## Suggested sprint ordering

1. Tickets 5 and 6 first (cheapest, unblocks visual cleanup)
2. Ticket 3 (bug fix — the save crash is blocking normal use)
3. Ticket 4 (UI bug, lower priority but cheap)
4. Tickets 1 and 2 together (the shape-template workflow — the real feature)

Total rough estimate: **1-2 days of focused dev work**.
