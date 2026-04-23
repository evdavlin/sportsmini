-- Seed Brew Serena + Brew Giannis shape templates (DEV_TICKETS Ticket 5).
-- Replaces obsolete JSON under shapes/; apply manually when ready.

INSERT INTO public.puzzles (title, difficulty, width, height, grid, status)
VALUES (
  'Shape: Brew Serena (gold standard)',
  3,
  8,
  8,
  '{"pattern":["##.#####","##.###.#","##.#.#.#","#......#","#.......","....#...","#...###.","#.######"]}'::jsonb,
  'shape_template'
);

INSERT INTO public.puzzles (title, difficulty, width, height, grid, status)
VALUES (
  'Shape: Brew Giannis',
  3,
  7,
  8,
  '{"pattern":["######.","####...","##.....","#.....#",".......","...#.##",".#.####","##.####"]}'::jsonb,
  'shape_template'
);
