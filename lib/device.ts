'use client'

import { supabase } from '@/lib/supabase'

const DEVICE_KEY = 'sportsmini:device_id'

export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.localStorage.getItem(DEVICE_KEY)
    if (id) return id
    id = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_KEY, id)
    void supabase.from('devices').upsert({ id }, { onConflict: 'id' })
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function touchDevice(deviceId: string): void {
  if (!deviceId || typeof window === 'undefined') return
  void supabase.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId)
}
