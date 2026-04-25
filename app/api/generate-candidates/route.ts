import { NextResponse } from 'next/server'

import { generateCandidates, SHAPE_FILL_TIME_BUDGET_MS } from '@/lib/solver'
import { supabaseService } from '@/lib/supabase-service'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  shape_id?: string
  count?: number
  prefer_sport?: string
}

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json(
      {
        success: false,
        generator_run: '',
        candidate_count: 0,
        top_score: null,
        top_words: null,
        error: 'Invalid JSON body',
      },
      { status: 400 },
    )
  }

  const rawCount = body.count ?? 3
  const count = Math.min(10, Math.max(1, Math.floor(Number(rawCount)) || 3))

  if (body.shape_id !== undefined && body.shape_id !== null && body.shape_id !== '') {
    if (!UUID_RE.test(String(body.shape_id))) {
      return NextResponse.json(
        {
          success: false,
          generator_run: '',
          candidate_count: 0,
          top_score: null,
          top_words: null,
          error: 'shape_id must be a valid UUID',
        },
        { status: 400 },
      )
    }
  }

  const preferSport =
    typeof body.prefer_sport === 'string' && body.prefer_sport.trim()
      ? body.prefer_sport.trim()
      : undefined

  try {
    const result = await generateCandidates(supabaseService, {
      shapeId: body.shape_id && String(body.shape_id).length ? String(body.shape_id) : undefined,
      count,
      preferSport,
      wallDeadlineMs: 58_000,
      solverTimeBudgetSec: SHAPE_FILL_TIME_BUDGET_MS / 1000,
    })

    return NextResponse.json({
      success: result.success,
      generator_run: result.generator_run,
      candidate_count: result.candidate_count,
      top_score: result.top_score,
      top_words: result.top_words,
      ...(result.error ? { error: result.error } : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Generation failed'
    return NextResponse.json(
      {
        success: false,
        generator_run: '',
        candidate_count: 0,
        top_score: null,
        top_words: null,
        error: message,
      },
      { status: 500 },
    )
  }
}
