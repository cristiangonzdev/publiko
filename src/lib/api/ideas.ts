/**
 * Typed client-side wrappers for the idea-scoped API endpoints.
 *
 * Every function performs the fetch, checks `res.ok` and throws
 * `Error(await res.text())` on failure, and returns the parsed JSON when the
 * endpoint produces a body. Callers are expected to wrap these in try/catch and
 * surface the error (toast / alert). This keeps business logic out of the
 * components per CLAUDE.md ("cero lógica de negocio en componentes").
 */

import type { TaskDetail } from './tasks'

type IdeaRecord = Record<string, unknown>

async function ensureOk(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await res.text())
}

/** POST /api/ideas/generate — generate a weekly plan of ideas for a client. */
export async function generateIdeas(clientId: string): Promise<IdeaRecord[]> {
  const res = await fetch('/api/ideas/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId }),
  })
  await ensureOk(res)
  const { ideas } = (await res.json()) as { ideas: IdeaRecord[] }
  return ideas
}

/** POST /api/ideas/[id]/approve — approve an idea (kicks off brief generation). */
export async function approveIdea(ideaId: string): Promise<void> {
  const res = await fetch(`/api/ideas/${ideaId}/approve`, { method: 'POST' })
  await ensureOk(res)
}

/**
 * POST /api/ideas/[id]/discard — discard an idea.
 *
 * Historically this was fire-and-forget (no `res.ok` check). We now surface a
 * failure by throwing so callers can decide whether to revert optimistic state.
 */
export async function discardIdea(ideaId: string): Promise<void> {
  const res = await fetch(`/api/ideas/${ideaId}/discard`, { method: 'POST' })
  await ensureOk(res)
}

/** GET /api/ideas/[id]/detail — load the production task attached to an idea. */
export async function getIdeaDetail(ideaId: string): Promise<TaskDetail | null> {
  const res = await fetch(`/api/ideas/${ideaId}/detail`)
  await ensureOk(res)
  const { task } = (await res.json()) as { task: TaskDetail | null }
  return task
}

/** POST /api/ideas/human — turn a human-described input into an adapted idea. */
export async function createHumanIdea(payload: {
  client_id: string
  human_input: string
  content_type: 'reel' | 'post' | 'story' | 'carrusel'
}): Promise<IdeaRecord> {
  const res = await fetch('/api/ideas/human', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await ensureOk(res)
  const { idea } = (await res.json()) as { idea: IdeaRecord }
  return idea
}

/**
 * POST /api/clients/[id]/brain/feedback — mark a published idea as one that
 * worked well so the Brand Brain learns from it. Non-critical: throws on
 * failure but callers historically swallow it silently.
 */
export async function sendBrainFeedback(
  clientId: string,
  payload: {
    idea_id: string
    concept: unknown
    angle: unknown
    content_type: unknown
  },
): Promise<void> {
  const res = await fetch(`/api/clients/${clientId}/brain/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await ensureOk(res)
}
