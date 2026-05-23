import type { SupabaseClient } from '@supabase/supabase-js'
import type { WinningPatternForPrompt } from '@/lib/claude'

export async function loadWinningPatterns(
  supabase: SupabaseClient,
  clientId: string,
  limit = 10,
): Promise<WinningPatternForPrompt[]> {
  const { data, error } = await supabase.rpc('get_winning_patterns_for_prompt', {
    p_client_id: clientId,
    p_limit: limit,
  })
  if (error || !Array.isArray(data)) return []
  return data as WinningPatternForPrompt[]
}

export function attachWinningPatterns(
  brandBrain: Record<string, unknown>,
  patterns: WinningPatternForPrompt[],
): Record<string, unknown> {
  const existingLearning = (brandBrain.performance_learning as Record<string, unknown>) ?? {}
  return {
    ...brandBrain,
    performance_learning: {
      ...existingLearning,
      winning_patterns: patterns,
    },
  }
}
