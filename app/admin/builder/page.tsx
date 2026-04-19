import { notFound } from 'next/navigation'

import BuilderClient from '@/app/admin/builder/BuilderClient'
import { cluesToSlotMap, gridFromDraft, loadDraftForEditing, loadGlossary } from '@/lib/builder'

export const dynamic = 'force-dynamic'

export default async function AdminBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const glossary = await loadGlossary()
  const { id } = await searchParams

  if (id) {
    const draft = await loadDraftForEditing(id)
    if (!draft) notFound()
    const pattern = (draft.puzzle.grid as { pattern?: string[] })?.pattern ?? []
    const grid = gridFromDraft(pattern, draft.clues)
    const clueMap = cluesToSlotMap(draft.clues)
    return (
      <BuilderClient
        initialGlossary={glossary}
        initialDraft={{
          puzzleId: draft.puzzle.id,
          title: draft.puzzle.title ?? '',
          difficulty: draft.puzzle.difficulty ?? 3,
          grid,
          clueBySlot: Object.fromEntries(clueMap),
        }}
      />
    )
  }

  return <BuilderClient initialGlossary={glossary} initialDraft={null} />
}
