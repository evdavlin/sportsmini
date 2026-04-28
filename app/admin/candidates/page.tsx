import {
  getActiveShapeTemplates,
  getCandidateShapeNames,
  getCandidates,
  getPendingCandidateCount,
} from '@/lib/admin'
import { CandidatesClient } from './CandidatesClient'

export const dynamic = 'force-dynamic'

type PageSearch = {
  status?: string
  shape?: string
  sort?: string
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearch>
}) {
  const sp = await searchParams
  const statusParam = (sp.status ?? 'pending').toLowerCase()
  const status =
    statusParam === 'promoted' || statusParam === 'rejected' || statusParam === 'all'
      ? (statusParam as 'promoted' | 'rejected' | 'all')
      : 'pending'
  const sort = sp.sort === 'created_at' ? 'created_at' : 'quality_score'
  const shapeName = sp.shape?.trim() || null

  const [candidates, shapeNames, pendingCount, activeShapes] = await Promise.all([
    getCandidates({ status, shapeName: shapeName || null, sort }),
    getCandidateShapeNames(),
    getPendingCandidateCount(),
    getActiveShapeTemplates(),
  ])

  return (
    <CandidatesClient
      initialCandidates={candidates}
      shapeNames={shapeNames}
      activeShapes={activeShapes}
      pendingCount={pendingCount}
      initialFilters={{ status, shapeName: shapeName || '', sort }}
    />
  )
}
