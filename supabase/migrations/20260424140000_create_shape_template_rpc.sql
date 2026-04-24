-- Insert a shape template row (no clues). Used by admin builder ?mode=shape + createShapeTemplateAction.

CREATE OR REPLACE FUNCTION public.create_shape_template(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_puzzle_id uuid;
BEGIN
  IF p_payload->>'title' IS NULL OR trim(p_payload->>'title') = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;
  IF p_payload->'grid' IS NULL THEN
    RAISE EXCEPTION 'grid is required';
  END IF;

  INSERT INTO public.puzzles (title, difficulty, width, height, grid, status)
  VALUES (
    trim(p_payload->>'title'),
    3,
    (p_payload->>'width')::smallint,
    (p_payload->>'height')::smallint,
    p_payload->'grid',
    'shape_template'
  )
  RETURNING id INTO v_puzzle_id;

  RETURN jsonb_build_object('shape_id', v_puzzle_id);
END;
$$;

COMMENT ON FUNCTION public.create_shape_template(jsonb) IS
  'Creates a puzzles row with status shape_template (grid-only, no clues).';
