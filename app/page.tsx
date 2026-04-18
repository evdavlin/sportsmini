import SolveScreen from '@/app/components/SolveScreen'
import { getTodaysPuzzle } from '@/lib/puzzles'

export default async function Home() {
  const puzzle = await getTodaysPuzzle()

  if (!puzzle) {
    return (
      <main style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>No puzzle found</h1>
      </main>
    )
  }

  return <SolveScreen puzzle={puzzle} />
}

export const revalidate = 0
