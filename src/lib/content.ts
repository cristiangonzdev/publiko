/**
 * Single source of truth for the content taxonomy and for sanitizing
 * Claude-generated ideas before they touch the DB enums. Previously this logic
 * was copy-pasted in three routes with divergent fallbacks.
 */
export const VALID_ANGLES = [
  'emocional', 'informativo', 'humor', 'social_proof', 'educativo',
  'aspiracional', 'detras_escenas', 'anuncio', 'opinion', 'historia',
] as const
export type IdeaAngleValue = (typeof VALID_ANGLES)[number]

export const VALID_CONTENT_TYPES = [
  'reel', 'post', 'story', 'carrusel', 'gmb_post',
] as const
export type ContentTypeValue = (typeof VALID_CONTENT_TYPES)[number]

export function sanitizeAngle(value: unknown, fallback: IdeaAngleValue = 'informativo'): IdeaAngleValue {
  return VALID_ANGLES.includes(value as IdeaAngleValue) ? (value as IdeaAngleValue) : fallback
}

export function sanitizeContentType(value: unknown, fallback: ContentTypeValue = 'reel'): ContentTypeValue {
  return VALID_CONTENT_TYPES.includes(value as ContentTypeValue) ? (value as ContentTypeValue) : fallback
}

export interface RawIdea {
  concept?: string
  full_description?: string
  content_type?: string
  angle?: string
  content_pillar?: string | null
  content_origin?: string
  approval_tier?: string
  suggested_publish_time?: string
  human_input?: string
}

export interface SanitizedIdea {
  concept: string
  full_description: string | null
  content_type: ContentTypeValue
  angle: IdeaAngleValue
  content_pillar: string | null
  content_origin: 'system' | 'human'
  approval_tier: 'auto' | 'manual'
  suggested_publish_time: string | null
}

/** Normalize a single Claude-generated idea into DB-safe values. */
export function sanitizeIdea(
  idea: RawIdea,
  opts: { typeFallback?: ContentTypeValue; angleFallback?: IdeaAngleValue } = {},
): SanitizedIdea {
  return {
    concept: idea.concept ?? '',
    full_description: idea.full_description ?? null,
    content_type: sanitizeContentType(idea.content_type, opts.typeFallback ?? 'reel'),
    angle: sanitizeAngle(idea.angle, opts.angleFallback ?? 'informativo'),
    content_pillar: idea.content_pillar ?? null,
    content_origin: idea.content_origin === 'human' ? 'human' : 'system',
    approval_tier: idea.approval_tier === 'auto' ? 'auto' : 'manual',
    suggested_publish_time: idea.suggested_publish_time ?? null,
  }
}
