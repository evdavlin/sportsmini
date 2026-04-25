-- Random active shape template (ORDER BY random() LIMIT 1) for generator API.

CREATE OR REPLACE FUNCTION public.pick_random_shape_template()
RETURNS TABLE (
  id uuid,
  title text,
  grid jsonb,
  width smallint,
  height smallint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.title, p.grid, p.width, p.height
  FROM public.puzzles p
  WHERE p.status = 'shape_template' AND p.is_active = true
  ORDER BY random()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.pick_random_shape_template() IS
  'Returns one random active shape_template row for candidate generation.';
