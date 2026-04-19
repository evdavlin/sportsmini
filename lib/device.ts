'use client'

import { supabase } from '@/lib/supabase'

const DEVICE_KEY = 'sportsmini:device_id'

export type EnsureDeviceResult =
  | { ok: true; deviceId: string }
  | { ok: false; error: unknown }

async function upsertDeviceOnce(id: string): Promise<{ error: unknown | null }> {
  const { error } = await supabase.from('devices').upsert({ id }, { onConflict: 'id' })
  return { error: error ?? null }
}

/**
 * Registers the client device in Supabase before solve rows are written.
 * On persistent failure after one retry, returns ok: false — do not use a device id for DB writes.
 */
export async function getDeviceId(): Promise<EnsureDeviceResult> {
  if (typeof window === 'undefined') return { ok: false, error: new Error('no window') }
  try {
    let id = window.localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(DEVICE_KEY, id)
    }
    let { error } = await upsertDeviceOnce(id)
    if (error) {
      console.error('[device] upsert failed; retrying once', error)
      ;({ error } = await upsertDeviceOnce(id))
    }
    if (error) {
      console.error('[device] upsert failed after retry', error)
      return { ok: false, error }
    }
    return { ok: true, deviceId: id }
  } catch (e) {
    console.error('[device] getDeviceId exception', e)
    return { ok: false, error: e }
  }
}

export async function touchDevice(deviceId: string): Promise<void> {
  if (!deviceId || typeof window === 'undefined') return
  try {
    const { error } = await supabase
      .from('devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', deviceId)
    if (error) console.error('[device] touchDevice failed', error)
  } catch (e) {
    console.error('[device] touchDevice exception', e)
  }
}
