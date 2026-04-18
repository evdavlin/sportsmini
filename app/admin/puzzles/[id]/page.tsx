import { notFound } from 'next/navigation'
import SolveScreen from '@/app/components/SolveScreen'
import { getPuzzleAdminMeta, getPuzzlePayloadForAdmin } from '@/lib/admin'

export default async function AdminPuzzlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [payload, meta] = await Promise.all([getPuzzlePayloadForAdmin(id), getPuzzleAdminMeta(id)])
  if (!payload || !meta) notFound()

  return (
    <SolveScreen
      puzzle={payload}
      previewMode
      previewTitle={meta.title}
      previewStatus={meta.status}
    />
  )
}
