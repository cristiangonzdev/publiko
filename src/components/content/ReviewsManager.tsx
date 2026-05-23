'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  business_name: string
  source: string
  author_name: string | null
  rating: number | null
  text: string | null
  review_date: string | null
  response_options: string[]
  response_selected: string | null
  status: string
  sentiment: string | null
  ai_draft?: string | null
  ai_draft_at?: string | null
}

interface Props {
  initialReviews: Review[]
}

const STARS = (n: number | null) => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—'

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-green-600', neutral: 'text-ink-500', negative: 'text-red-600',
}

export function ReviewsManager({ initialReviews }: Props) {
  const [reviews, setReviews] = useState(initialReviews)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const respond = async (reviewId: string) => {
    const response = custom[reviewId] || selected[reviewId]
    if (!response?.trim()) { alert('Selecciona o escribe una respuesta'); return }
    setLoading(reviewId)
    try {
      await fetch(`/api/reviews/${reviewId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    } finally {
      setLoading(null)
    }
  }

  if (!reviews.length) {
    return <p className="mt-8 text-sm text-ink-400">Sin reseñas pendientes. ¡Todo respondido!</p>
  }

  return (
    <div className="mt-6 space-y-5">
      {reviews.map((review) => (
        <div key={review.id} className={cn(
          'rounded-xl border bg-white shadow-sm overflow-hidden',
          review.sentiment === 'negative' ? 'border-red-200' :
          review.sentiment === 'positive' ? 'border-green-200' : 'border-ink-200'
        )}>
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-brand">{review.business_name}</span>
                  <span className="text-[10px] text-ink-400">·</span>
                  <span className="text-[10px] text-ink-400">{review.source}</span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-sm font-medium text-ink-900">{review.author_name ?? 'Anónimo'}</span>
                  <span className="text-yellow-500 text-sm">{STARS(review.rating)}</span>
                  {review.sentiment && (
                    <span className={cn('text-[10px] font-medium capitalize', SENTIMENT_COLOR[review.sentiment])}>
                      {review.sentiment}
                    </span>
                  )}
                </div>
              </div>
              {review.review_date && (
                <span className="text-[11px] text-ink-400 flex-shrink-0">
                  {new Date(review.review_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>

            {review.text && (
              <p className="mt-3 text-sm text-ink-700 leading-relaxed">{review.text}</p>
            )}

            <div className="mt-4 space-y-2">
              {review.ai_draft && (
                <div className="rounded-lg border-2 border-brand bg-brand/5 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">⭐ Borrador IA recomendado</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCustom((prev) => ({ ...prev, [review.id]: review.ai_draft ?? '' }))
                        setSelected((prev) => ({ ...prev, [review.id]: '' }))
                      }}
                      className="text-[10px] text-brand hover:underline"
                    >
                      Editar →
                    </button>
                  </div>
                  <p className="text-sm text-ink-800">{review.ai_draft}</p>
                </div>
              )}
              <p className="text-xs font-semibold text-ink-500">{review.ai_draft ? 'Otras opciones:' : 'Opciones de respuesta generadas por IA:'}</p>
              {review.response_options.filter((opt) => opt !== review.ai_draft).map((opt, i) => (
                <label key={i} className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors',
                  selected[review.id] === opt ? 'border-brand bg-brand/5' : 'border-ink-100 hover:border-ink-300'
                )}>
                  <input
                    type="radio"
                    name={`response-${review.id}`}
                    checked={selected[review.id] === opt}
                    onChange={() => {
                      setSelected((prev) => ({ ...prev, [review.id]: opt }))
                      setCustom((prev) => ({ ...prev, [review.id]: '' }))
                    }}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <span className="text-ink-700">{opt}</span>
                </label>
              ))}

              <div>
                <p className="text-xs font-semibold text-ink-500 mb-1.5">O escribe tu propia respuesta:</p>
                <textarea
                  rows={3}
                  placeholder="Escribe una respuesta personalizada…"
                  value={custom[review.id] ?? ''}
                  onChange={(e) => {
                    setCustom((prev) => ({ ...prev, [review.id]: e.target.value }))
                    setSelected((prev) => ({ ...prev, [review.id]: '' }))
                  }}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm resize-none focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => respond(review.id)}
              disabled={loading === review.id}
              className="mt-3 w-full rounded-md bg-ink-900 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
            >
              {loading === review.id ? 'Publicando respuesta…' : 'Publicar respuesta'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
