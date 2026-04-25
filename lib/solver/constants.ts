export const MIN_WORD_LEN = 3
export const MIN_LETTER_CELL_FRACTION = 0.55
export const MIN_LONGEST_SLOT_LEN = 5
export const MAX_3LETTER_SLOT_FRACTION = 0.4
export const FILLS_PER_SHAPE = 6
export const SHAPE_FILL_TIME_BUDGET_MS = 10_000

export const ANCHOR_TYPES = new Set<string>([
  'player',
  'nickname',
  'coach',
  'team',
  'venue',
  'term',
  'moment',
  'trophy',
  'event',
  'mascot',
  'brand',
  'broadcaster',
  'movie',
  'show',
  'journalist',
  'owner',
  'horse',
  'character',
  'action',
  'play',
  'position',
  'commissioner',
  'tour',
  'tournament',
])

export const LOW_VALUE_TYPES = new Set<string>(['stat', 'league', 'org', 'network', 'award'])

export const SCORE_WEIGHTS: Readonly<Record<string, number>> = {
  short_word_penalty: -2.0,
  five_letter_bonus: 1.5,
  six_plus_bonus: 2.5,
  eight_plus_bonus: 3.5,
  low_value_type_penalty: -2.5,
  anchor_type_bonus: 0.8,
  generic_sport_penalty: -0.5,
  sport_variety_bonus: 0.8,
  abbreviation_heavy_fill: -6.0,
  black_square_penalty_per_pct_over_25: -0.3,
  has_long_anchor_bonus: 4.0,
}
