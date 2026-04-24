'use server'

import { revalidatePath } from 'next/cache'

import { supabaseService } from '@/lib/supabase-service'

export type CreateShapeTemplatePayload = {
  title: string
  width: number
  height: number
  grid: { pattern: string[] }
}

function extractShapeId(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'object' && data !== null && 'shape_id' in data) {
    const id = (data as { shape_id?: unknown }).shape_id
    if (id != null) return String(id)
  }
  return null
}

export async function createShapeTemplateAction(
  payload: CreateShapeTemplatePayload,
): Promise<{ shapeId: string }> {
  const { data, error } = await supabaseService.rpc('create_shape_template', {
    p_payload: payload,
  })
  if (error) throw new Error(error.message)
  const shapeId = extractShapeId(data)
  if (!shapeId) {
    throw new Error(
      typeof data === 'string'
        ? data
        : 'create_shape_template returned no shape_id — check RPC response shape',
    )
  }
  revalidatePath('/admin/shapes')
  revalidatePath('/admin')
  return { shapeId }
}

export async function deleteShapeTemplateAction(id: string): Promise<void> {
  const { error } = await supabaseService
    .from('puzzles')
    .delete()
    .eq('id', id)
    .eq('status', 'shape_template')
  if (error) throw new Error(error.message)
  revalidatePath('/admin/shapes')
  revalidatePath('/admin')
}
