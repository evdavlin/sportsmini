-- Atomic draft creation: insert puzzle + resolve crossword_glossary (match or insert) + insert puzzle_clues with glossary_id.
-- Apply in Supabase SQL editor or `supabase db push` before relying on createDraftFromDslAction.

CREATE OR REPLACE FUNCTION public.create_draft_with_glossary(
  p_title text,
  p_difficulty integer,
  p_width integer,
  p_height integer,
  p_grid jsonb,
  p_clues jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_puzzle_id uuid;
  v_elem jsonb;
  v_glossary_id uuid;
BEGIN
  INSERT INTO public.puzzles (title, difficulty, status, width, height, grid)
  VALUES (p_title, p_difficulty, 'draft', p_width, p_height, p_grid)
  RETURNING id INTO v_puzzle_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_clues)
  LOOP
    SELECT cg.id INTO v_glossary_id
    FROM public.crossword_glossary cg
    WHERE cg.word = (v_elem->>'word')
      AND cg.clue = (v_elem->>'clue_text')
    LIMIT 1;

    IF v_glossary_id IS NULL THEN
      BEGIN
        INSERT INTO public.crossword_glossary (word, clue, type, sport, team)
        VALUES (
          v_elem->>'word',
          v_elem->>'clue_text',
          'other',
          'general',
          NULL
        )
        RETURNING id INTO v_glossary_id;
      EXCEPTION
        WHEN unique_violation THEN
          SELECT cg.id INTO v_glossary_id
          FROM public.crossword_glossary cg
          WHERE cg.word = (v_elem->>'word')
            AND cg.clue = (v_elem->>'clue_text')
          LIMIT 1;
      END;
    END IF;

    INSERT INTO public.puzzle_clues (
      puzzle_id,
      number,
      row,
      col,
      direction,
      word,
      clue_text,
      glossary_id
    )
    VALUES (
      v_puzzle_id,
      (v_elem->>'num')::integer,
      (v_elem->>'row')::integer,
      (v_elem->>'col')::integer,
      v_elem->>'direction',
      v_elem->>'word',
      v_elem->>'clue_text',
      v_glossary_id
    );
  END LOOP;

  RETURN v_puzzle_id;
END;
$$;

COMMENT ON FUNCTION public.create_draft_with_glossary(text, integer, integer, integer, jsonb, jsonb) IS
  'Creates a draft puzzle and puzzle_clues; matches or inserts crossword_glossary rows in one transaction.';
