'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Guarda una o varias secciones del Brand Brain en una sola operación.
 * `patch` puede incluir claves de sección (identity, audience, voice, products,
 * visual_identity, operations) y/o `onboarding_step`.
 *
 * Es un UPSERT: si el cliente aún no tiene fila en brand_brains (clientes
 * antiguos creados antes del onboarding), se crea en vez de fallar en silencio
 * como hacía el update anterior (0 filas afectadas = "guardado" falso).
 */
export async function saveBrandBrain(
  clientId: string,
  patch: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('brand_brains')
    .upsert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        client_id: clientId,
        ...patch,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'client_id' }
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se pudo guardar el Brand Brain')
}

export async function completeBrandBrainOnboarding(clientId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('brand_brains')
    .update({
      onboarding_completed: true,
      onboarding_step: 6,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('client_id', clientId)

  if (error) throw new Error(error.message)
}
