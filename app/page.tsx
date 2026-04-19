import HomeScreen from '@/app/components/HomeScreen'
import { getTodaysPuzzle } from '@/lib/puzzles'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const puzzle = await getTodaysPuzzle()

  if (!puzzle) {
    return (
      <main style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>No puzzle found</h1>
      </main>
    )
  }

  return <HomeScreen puzzle={puzzle} />
}

export const revalidate = 0
