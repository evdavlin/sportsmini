import WinScreen from '@/app/components/WinScreen'
import { getTodaysPuzzle } from '@/lib/puzzles'

export default async function WinPage() {
  const puzzle = await getTodaysPuzzle()

  if (!puzzle) {
    return (
      <main style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>No puzzle found</h1>
      </main>
    )
  }

  return <WinScreen puzzle={puzzle} />
}

export const revalidate = 0
