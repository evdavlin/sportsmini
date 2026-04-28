'use client'

import { useEffect, useState } from 'react'

const FADE_MS = 2600
const GONE_MS = 3000

type Props = {
  text: string | null
  variant: 'success' | 'error'
  onDone: () => void
}

/** Fixed bottom message: auto-dismiss after ~3s with opacity fade (last ~400ms). */
export function AdminBottomMessage({ text, variant, onDone }: Props) {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    if (!text) return
    const tReset = window.setTimeout(() => setFade(false), 0)
    const tFade = window.setTimeout(() => setFade(true), FADE_MS)
    const tDone = window.setTimeout(() => onDone(), GONE_MS)
    return () => {
      window.clearTimeout(tReset)
      window.clearTimeout(tFade)
      window.clearTimeout(tDone)
    }
  }, [text, onDone])

  if (!text) return null

  const bg = variant === 'success' ? '#E8F2EA' : '#F5E6E6'
  const border = variant === 'success' ? '#4A8A55' : '#C45A5A'
  const fg = variant === 'success' ? '#1F3D24' : '#4A2020'

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 220,
        opacity: fade ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
        maxWidth: 420,
        padding: '12px 16px',
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        borderRadius: 8,
        fontSize: 14,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}
    >
      {text}
    </div>
  )
}
