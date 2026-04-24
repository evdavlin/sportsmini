import { notFound } from 'next/navigation'

import BuilderClient from '@/app/admin/builder/BuilderClient'
import {
  cluesToGlossaryIdBySlot,
  cluesToSlotMap,
  gridFromDraft,
  loadDraftForEditing,
  loadGlossary,
} from '@/lib/builder'

export const dynamic = 'force-dynamic'

export default async function AdminBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; mode?: string }>
}) {
  const { id, mode } = await searchParams
  if (mode === 'shape' && !id) {
    return <BuilderClient initialGlossary={[]} initialDraft={null} shapeAuthoring />
  }

  const glossary = await loadGlossary()

  if (id) {
    const draft = await loadDraftForEditing(id)
    if (!draft) notFound()
    const pattern = (draft.puzzle.grid as { pattern?: string[] })?.pattern ?? []
    const grid = gridFromDraft(pattern, draft.clues)
    const clueMap = cluesToSlotMap(draft.clues)
    const glossaryIdBySlot = cluesToGlossaryIdBySlot(draft.clues)
    return (
      <BuilderClient
        initialGlossary={glossary}
        initialDraft={{
          puzzleId: draft.puzzle.id,
          title: draft.puzzle.title ?? '',
          difficulty: draft.puzzle.difficulty ?? 3,
          grid,
          clueBySlot: Object.fromEntries(clueMap),
          glossaryIdBySlot,
        }}
      />
    )
  }

  // New session: blank 8×8 all-letter grid and matching dims (see BuilderClient defaults)
  return <BuilderClient initialGlossary={glossary} initialDraft={null} />
}
