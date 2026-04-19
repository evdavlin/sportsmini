'use client'

import { useRouter } from 'next/navigation'

import HowToPlayScreen from '@/app/components/HowToPlayScreen'
import { theme } from '@/app/components/theme'

export default function HowToPage() {
  const router = useRouter()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.bg,
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        <HowToPlayScreen onClose={() => router.push('/')} />
      </div>
    </div>
  )
}
