import { createServiceClient } from '@/lib/supabase/server'

export interface FewShotExample {
  title: string
  content_type: string
  platform: string
  copy: string
  hashtags: string[]
  engagement_rate: number | null
}

interface WinnerPostRow {
  copy: string | null
  hashtags: string[] | null
  platform: string
  engagement_rate: string | null
  content_tasks: { title: string; content_type: string } | null
}

export async function loadWinnerExamples(
  clientId: string,
  limit = 5,
): Promise<FewShotExample[]> {
  const supabase = await createServiceClient()

  // winner_score, winner_marked_at, is_winner added in migration 0004 —
  // not yet in auto-generated types, cast via `as any`
  const { data } = await supabase
    .from('posts')
    .select(`
      copy,
      hashtags,
      platform,
      engagement_rate,
      content_tasks!inner(title, content_type)
    `)
    .eq('client_id', clientId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('is_winner' as any, true)
    .not('copy', 'is', null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .order('winner_score' as any, { ascending: false, nullsFirst: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .order('winner_marked_at' as any, { ascending: false })
    .limit(limit)

  if (!data) return []

  return (data as unknown as WinnerPostRow[])
    .filter((row) => row.content_tasks != null)
    .map((row) => ({
      title: row.content_tasks!.title,
      content_type: row.content_tasks!.content_type,
      platform: row.platform,
      copy: row.copy!,
      hashtags: row.hashtags ?? [],
      engagement_rate: row.engagement_rate != null ? Number(row.engagement_rate) : null,
    }))
}
