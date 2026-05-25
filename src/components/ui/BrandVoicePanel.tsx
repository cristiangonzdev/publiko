'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface BrandBrain {
  brand_name?: string
  category?: string
  unique_value?: string
  tone_voice?: string
  audience_description?: string
  products_services?: string
  visual_references?: string
  content_pillars?: string[]
  avoid_topics?: string
}

interface Props {
  clientId:   string
  clientName: string
  onClose:    () => void
}

export function BrandVoicePanel({ clientId, clientName, onClose }: Props) {
  const [data,    setData]    = useState<BrandBrain | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clients/${clientId}/brain`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.brain) setData(json.brain as BrandBrain)
      })
      .finally(() => setLoading(false))
  }, [clientId])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">Brand Voice</p>
            <p className="text-base font-semibold text-ink-900">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="mb-1.5 h-2.5 w-24 rounded bg-ink-100" />
                  <div className="h-4 rounded bg-ink-50" />
                </div>
              ))}
            </div>
          )}

          {!loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="mb-3 h-10 w-10 text-ink-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <p className="text-sm font-medium text-ink-500">Brand Brain no configurado</p>
              <p className="mt-1 text-xs text-ink-400">El admin debe completar el Brand Brain de este cliente.</p>
            </div>
          )}

          {!loading && data && (
            <>
              {data.unique_value && (
                <Section label="Propuesta única">
                  <p className="text-sm text-ink-700">{data.unique_value}</p>
                </Section>
              )}

              {data.tone_voice && (
                <Section label="Tono de voz">
                  <p className="text-sm text-ink-700">{data.tone_voice}</p>
                </Section>
              )}

              {data.audience_description && (
                <Section label="Audiencia objetivo">
                  <p className="text-sm text-ink-700">{data.audience_description}</p>
                </Section>
              )}

              {data.content_pillars && data.content_pillars.length > 0 && (
                <Section label="Pilares de contenido">
                  <div className="flex flex-wrap gap-1.5">
                    {data.content_pillars.map((p, i) => (
                      <span key={i} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                        {p}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {data.products_services && (
                <Section label="Productos y servicios">
                  <p className="text-sm text-ink-700">{data.products_services}</p>
                </Section>
              )}

              {data.visual_references && (
                <Section label="Referencias visuales">
                  <p className="text-sm text-ink-700">{data.visual_references}</p>
                </Section>
              )}

              {data.avoid_topics && (
                <Section label="Temas a evitar" accent="red">
                  <p className="text-sm text-red-700">{data.avoid_topics}</p>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children, accent }: { label: string; children: React.ReactNode; accent?: 'red' }) {
  return (
    <div>
      <p className={cn(
        'mb-1.5 text-[10px] font-bold uppercase tracking-widest',
        accent === 'red' ? 'text-red-400' : 'text-ink-400'
      )}>
        {label}
      </p>
      {children}
    </div>
  )
}
