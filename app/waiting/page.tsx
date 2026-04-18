import WaitingScreen from '@/app/components/WaitingScreen'
import { getTodaysPuzzle } from '@/lib/puzzles'

export default async function WaitingPage() {
  const puzzle = await getTodaysPuzzle()

  if (!puzzle) {
    return (
      <main style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>No puzzle found</h1>
      </main>
    )
  }

  return <WaitingScreen puzzle={puzzle} />
}

export const revalidate = 0
