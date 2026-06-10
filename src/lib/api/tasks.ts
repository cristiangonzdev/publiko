/**
 * Typed client-side wrappers for the task-scoped API endpoints used by the
 * ideas boards. Same contract as lib/api/ideas.ts: fetch, check `res.ok`,
 * throw `Error(await res.text())` on failure, return parsed JSON when present.
 */

export interface RecordingBrief {
  concept?: string
  objective?: string
  planes?: string[]
  duracion_estimada?: string
  preparacion?: string[]
  musica_referencia?: string
  referencia_visual?: string
  notas_tecnicas?: string
}

export interface EditingBrief {
  duracion_final?: string
  ritmo?: string
  transiciones?: string
  texto_pantalla?: string | null
  tipografia?: string | null
  musica_exacta?: string
  color_grade?: string
  formato_exportacion?: string
  notas_especiales?: string
}

export interface CopyOption {
  copy?: string
  hashtags?: string[]
  cta?: string
}

export interface JudgeVerdict {
  passes: boolean
  score: number
  issues: string[]
  reasoning: string
}

export interface TaskDetail {
  id: string
  recording_brief: RecordingBrief | null
  editing_brief: EditingBrief | null
  copy_options: CopyOption[] | null
  copy_selected: string | null
  hashtags: string[] | null
  cta: string | null
  status: string
  grabador_id: string | null
  editor_id: string | null
  deadline: string | null
  bruto_asset_ids: string[] | null
  approval_tier: 'auto' | 'manual' | null
  copies_per_platform: Record<string, { copy: string; hashtags: string[]; cta: string | null }> | null
  judge_verdict: JudgeVerdict | null
  judge_run_at: string | null
  auto_publish_blocked_reason: string | null
  target_platforms: string[] | null
  publish_at: string | null
}

async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await res.text())
}

/** POST /api/tasks/[id]/retry-briefs — re-trigger brief generation. */
export async function retryBriefs(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/retry-briefs`, { method: 'POST' })
  await ensureOk(res)
}

/** PATCH /api/tasks/[id]/approval-tier — switch between auto / manual approval. */
export async function setApprovalTier(taskId: string, tier: 'auto' | 'manual'): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/approval-tier`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }),
  })
  await ensureOk(res)
}

/** POST /api/tasks/[id]/judge — run the AI judge over the selected copy. */
export async function judgeTask(taskId: string): Promise<JudgeVerdict> {
  const res = await fetch(`/api/tasks/${taskId}/judge`, { method: 'POST' })
  await ensureOk(res)
  const { verdict } = (await res.json()) as { verdict: JudgeVerdict }
  return verdict
}

/** POST /api/tasks/[id]/select-copy — choose which generated copy to use. */
export async function selectCopy(taskId: string, copyIndex: number): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/select-copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ copy_index: copyIndex }),
  })
  await ensureOk(res)
}

/** PATCH /api/tasks/[id]/assign — assign grabador / editor to the task. */
export async function assignTask(
  taskId: string,
  team: { grabador_id: string | null; editor_id: string | null },
): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(team),
  })
  await ensureOk(res)
}

/** POST /api/tasks/[id]/to-production — move an approved idea into production. */
export async function sendToProduction(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/to-production`, { method: 'POST' })
  await ensureOk(res)
}
