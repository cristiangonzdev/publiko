'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveBrandBrainSection(
  clientId: string,
  section: string,
  data: Record<string, unknown>
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('brand_brains')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ [section]: data, updated_at: new Date().toISOString() } as any)
    .eq('client_id', clientId)

  if (error) throw new Error(error.message)
}

export async function completeBrandBrainOnboarding(clientId: string) {
  const supabase = await createClient()

  await supabase
    .from('brand_brains')
    .update({
      onboarding_completed: true,
      onboarding_step: 6,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('client_id', clientId)
}
