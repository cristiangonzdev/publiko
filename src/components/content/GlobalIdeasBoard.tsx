'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const STATUS_COLS = ['suggested', 'approved', 'in_production', 'published', 'discarded'] as const
const STATUS_LABEL: Record<string, string> = {
  suggested: 'Sugeridas',
  approved: 'Aprobadas',
  in_production: 'En producción',
  published: 'Publicadas',
  discarded: 'Descartadas',
}
const STATUS_COLOR: Record<string, string> = {
  suggested: 'bg-ink-100 text-ink-600',
  approved: 'bg-blue-50 text-blue-700',
  in_production: 'bg-yellow-50 text-yellow-700',
  published: 'bg-green-50 text-green-700',
  discarded: 'bg-ink-50 text-ink-400',
}
const ORIGIN_BADGE: Record<string, string> = { system: 'IA', human: 'Humano' }
const CONTENT_TYPES = ['reel', 'post', 'story', 'carrusel'] as const

interface RecordingBrief {
  concept?: string; objective?: string; planes?: string[]; duracion_estimada?: string
  preparacion?: string[]; musica_referencia?: string; referencia_visual?: string; notas_tecnicas?: string
}
interface EditingBrief {
  duracion_final?: string; ritmo?: string; transiciones?: string; texto_pantalla?: string | null
  tipografia?: string | null; musica_exacta?: string; color_grade?: string
  formato_exportacion?: string; notas_especiales?: string
}
interface CopyOption { copy?: string; hashtags?: string[]; cta?: string }
interface TaskDetail {
  id: string; recording_brief: RecordingBrief | null
  editing_brief: EditingBrief | null; copy_options: CopyOption[] | null; status: string
}

interface Idea extends Record<string, unknown> {
  id: string
  client_id: string
  client_name: string
}

interface Client { id: string; business_name: string }

interface Props {
  initialIdeas: Idea[]
  clients: Client[]
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-ink-100 pt-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</h3>
      {children}
    </div>
  )
}
function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="mb-2">
      <span className="text-[11px] font-medium text-ink-400">{label}: </span>
      <span className="text-sm text-ink-700">{value}</span>
    </div>
  )
}
function BulletList({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] font-medium text-ink-400">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-700">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-300" />{item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GlobalIdeasBoard({ initialIdeas, clients }: Props) {
  const [ideas, setIdeas] = useState(initialIdeas)
  const [activeStatus, setActiveStatus] = useState<string>('suggested')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [copyExpanded, setCopyExpanded] = useState<number | null>(null)
  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set())

  // Add idea modal state
  const [showAdd, setShowAdd] = useState(false)
  const [addClientId, setAddClientId] = useState('')
  const [addInput, setAddInput] = useState('')
  const [addType, setAddType] = useState<'reel' | 'post' | 'story' | 'carrusel'>('reel')
  const [addLoading, setAddLoading] = useState(false)

  const approve = async (ideaId: string) => {
    if (loadingId) return
    setLoadingId(ideaId)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, status: 'approved' } : i))
      setActiveStatus('approved')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoadingId(null)
    }
  }

  const discard = async (ideaId: string) => {
    if (loadingId) return
    setLoadingId(ideaId)
    try {
      await fetch(`/api/ideas/${ideaId}/discard`, { method: 'POST' })
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, status: 'discarded' } : i))
    } finally {
      setLoadingId(null)
    }
  }

  const openDetail = async (idea: Idea) => {
    setSelectedIdea(idea)
    setTaskDetail(null)
    setCopyExpanded(null)
    if (['approved', 'in_production', 'published'].includes(idea.status as string)) {
      setLoadingDetail(true)
      try {
        const res = await fetch(`/api/ideas/${idea.id}/detail`)
        if (res.ok) {
          const { task } = await res.json() as { task: TaskDetail | null }
          setTaskDetail(task)
        }
      } finally {
        setLoadingDetail(false)
      }
    }
  }

  const markSuccess = async (idea: Idea) => {
    if (feedbackSent.has(idea.id)) return
    try {
      await fetch(`/api/clients/${idea.client_id}/brain/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: idea.id, concept: idea.concept, angle: idea.angle, content_type: idea.content_type }),
      })
      setFeedbackSent((prev) => new Set([...prev, idea.id]))
    } catch { /* silent */ }
  }

  const submitAdd = async () => {
    if (!addClientId || !addInput.trim()) return
    setAddLoading(true)
    try {
      const res = await fetch('/api/ideas/human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: addClientId, human_input: addInput.trim(), content_type: addType }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { idea } = await res.json() as { idea: Record<string, unknown> }
      const clientName = clients.find((c) => c.id === addClientId)?.business_name ?? addClientId
      setIdeas((prev) => [{ ...idea, id: idea.id as string, client_id: addClientId, client_name: clientName, status: 'suggested', content_type: addType, content_origin: 'human' } as Idea, ...prev])
      setActiveStatus('suggested')
      setShowAdd(false)
      setAddInput('')
      setAddClientId('')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAddLoading(false)
    }
  }

  const filtered = ideas.filter((i) => i.status === activeStatus)

  // Group by client within the filtered list
  const clientGroups = filtered.reduce<Record<string, Idea[]>>((acc, idea) => {
    const key = idea.client_name
    if (!acc[key]) acc[key] = []
    acc[key].push(idea)
    return acc
  }, {})

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_COLS.map((s) => {
            const count = ideas.filter((i) => i.status === s).length
            return (
              <button
                key={s}
                onClick={() => setActiveStatus(s)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeStatus === s ? 'bg-ink-900 text-white' : 'border border-ink-200 text-ink-500 hover:border-ink-400'
                )}
              >
                {STATUS_LABEL[s]} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          + Añadir idea
        </button>
      </div>

      {/* Ideas grid grouped by client */}
      <div className="mt-5 space-y-8">
        {Object.keys(clientGroups).length === 0 && (
          <p className="py-8 text-center text-sm text-ink-400">
            {activeStatus === 'suggested' ? 'Sin ideas sugeridas.' : `Sin ideas en "${STATUS_LABEL[activeStatus]}".`}
          </p>
        )}

        {Object.entries(clientGroups).map(([clientName, clientIdeas]) => (
          <div key={clientName}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">{clientName}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clientIdeas.map((idea) => (
                <div
                  key={idea.id}
                  onClick={() => openDetail(idea)}
                  className="cursor-pointer rounded-lg border border-ink-200 bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLOR[idea.status as string])}>
                      {idea.content_type as string}
                    </span>
                    <span className="text-[10px] text-ink-400">{ORIGIN_BADGE[idea.content_origin as string] ?? ''}</span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-ink-900">{idea.concept as string}</p>
                  {Boolean(idea.full_description) && (
                    <p className="mt-1 text-xs text-ink-500 line-clamp-2">{idea.full_description as string}</p>
                  )}
                  {Boolean(idea.angle) && (
                    <p className="mt-2 text-[10px] text-ink-400">Ángulo: {idea.angle as string}</p>
                  )}

                  {activeStatus === 'suggested' && (
                    <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => approve(idea.id)}
                        disabled={loadingId === idea.id}
                        className="flex-1 rounded bg-ink-900 py-1.5 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50"
                      >
                        {loadingId === idea.id ? 'Generando brief…' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => discard(idea.id)}
                        disabled={!!loadingId}
                        className="rounded border border-ink-200 px-3 py-1.5 text-xs text-ink-500 hover:bg-ink-50 disabled:opacity-40"
                      >
                        Descartar
                      </button>
                    </div>
                  )}

                  {activeStatus === 'published' ? (
                    <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] text-brand font-medium">Ver detalle →</p>
                      <button
                        onClick={() => markSuccess(idea)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
                          feedbackSent.has(idea.id) ? 'bg-yellow-100 text-yellow-700' : 'border border-ink-200 text-ink-400 hover:border-yellow-400 hover:text-yellow-600'
                        )}
                      >
                        {feedbackSent.has(idea.id) ? '⭐ Aprendido' : '⭐ Funcionó bien'}
                      </button>
                    </div>
                  ) : activeStatus === 'suggested' ? (
                    <p className="mt-3 text-[10px] text-ink-400">Toca para ver descripción completa</p>
                  ) : (
                    <p className="mt-3 text-[10px] text-brand font-medium">Ver detalle →</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add idea modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="border-b border-ink-100 px-6 py-4">
              <h2 className="text-base font-semibold text-ink-900">Añadir idea</h2>
              <p className="mt-0.5 text-sm text-ink-500">Describe el formato o inspiración. Claude la adaptará a la marca.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-600">Cliente</label>
                <select
                  value={addClientId}
                  onChange={(e) => setAddClientId(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-600">¿Qué idea has visto funcionar?</label>
                <textarea
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  placeholder="Ej: vi un reel de un restaurante donde el dueño muestra cómo prepara el plato del día antes de abrir. Música lofi, planos de manos, sin hablar. Tuvo 200k reproducciones."
                  rows={4}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-600">Formato</label>
                <div className="flex gap-2">
                  {CONTENT_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setAddType(t)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        addType === t ? 'bg-ink-900 text-white' : 'border border-ink-200 text-ink-500 hover:border-ink-400'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setShowAdd(false)} className="rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-ink-50">
                Cancelar
              </button>
              <button
                onClick={submitAdd}
                disabled={!addClientId || !addInput.trim() || addLoading}
                className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
              >
                {addLoading ? 'Generando…' : '✦ Convertir en idea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedIdea && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedIdea(null)} />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-medium text-brand">{selectedIdea.client_name}</span>
                  <span className="text-ink-300">·</span>
                  <span className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_COLOR[selectedIdea.status as string])}>
                    {selectedIdea.content_type as string}
                  </span>
                  <span className="text-ink-400">{ORIGIN_BADGE[selectedIdea.content_origin as string] ?? ''}</span>
                  {Boolean(selectedIdea.angle) && <span className="text-ink-400">· {selectedIdea.angle as string}</span>}
                </div>
                <h2 className="mt-1.5 text-base font-semibold text-ink-900 leading-snug">{selectedIdea.concept as string}</h2>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {selectedIdea.status === 'published' && (
                  <button
                    onClick={() => markSuccess(selectedIdea)}
                    className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      feedbackSent.has(selectedIdea.id) ? 'bg-yellow-100 text-yellow-700' : 'border border-ink-200 text-ink-500 hover:border-yellow-400 hover:text-yellow-600'
                    )}
                  >
                    {feedbackSent.has(selectedIdea.id) ? '⭐ Aprendido' : '⭐ Funcionó bien'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedIdea(null)}
                  className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {Boolean(selectedIdea.full_description) && (
                <Section title="Descripción">
                  <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{selectedIdea.full_description as string}</p>
                </Section>
              )}
              {Boolean(selectedIdea.human_input) && (
                <Section title="Input original">
                  <p className="rounded-md bg-ink-50 px-3 py-2 text-sm italic text-ink-600">&ldquo;{selectedIdea.human_input as string}&rdquo;</p>
                </Section>
              )}
              {loadingDetail && <div className="py-6 text-center text-sm text-ink-400">Cargando briefs…</div>}
              {taskDetail?.recording_brief && (
                <Section title="Brief de grabación">
                  <Row label="Concepto visual" value={taskDetail.recording_brief.concept} />
                  <Row label="Objetivo" value={taskDetail.recording_brief.objective} />
                  <Row label="Duración material bruto" value={taskDetail.recording_brief.duracion_estimada} />
                  <BulletList label="Planos" items={taskDetail.recording_brief.planes} />
                  <BulletList label="Preparación" items={taskDetail.recording_brief.preparacion} />
                  <Row label="Música referencia" value={taskDetail.recording_brief.musica_referencia} />
                  <Row label="Referencia visual" value={taskDetail.recording_brief.referencia_visual} />
                  <Row label="Notas técnicas" value={taskDetail.recording_brief.notas_tecnicas} />
                </Section>
              )}
              {taskDetail?.editing_brief && (
                <Section title="Brief de edición">
                  <Row label="Duración final" value={taskDetail.editing_brief.duracion_final} />
                  <Row label="Ritmo" value={taskDetail.editing_brief.ritmo} />
                  <Row label="Transiciones" value={taskDetail.editing_brief.transiciones} />
                  {taskDetail.editing_brief.texto_pantalla && <Row label="Texto en pantalla" value={taskDetail.editing_brief.texto_pantalla} />}
                  <Row label="Música exacta" value={taskDetail.editing_brief.musica_exacta} />
                  <Row label="Color grade" value={taskDetail.editing_brief.color_grade} />
                  <Row label="Exportación" value={taskDetail.editing_brief.formato_exportacion} />
                  {taskDetail.editing_brief.notas_especiales && <Row label="Notas especiales" value={taskDetail.editing_brief.notas_especiales} />}
                </Section>
              )}
              {taskDetail?.copy_options && taskDetail.copy_options.length > 0 && (
                <Section title="Opciones de copy">
                  <div className="space-y-3">
                    {taskDetail.copy_options.map((opt, i) => (
                      <div key={i} className="rounded-lg border border-ink-200 overflow-hidden">
                        <button
                          onClick={() => setCopyExpanded(copyExpanded === i ? null : i)}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-ink-50"
                        >
                          <span className="text-xs font-semibold text-ink-700">Opción {i + 1}</span>
                          <svg className={cn('h-4 w-4 text-ink-400 transition-transform', copyExpanded === i && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {copyExpanded === i && (
                          <div className="px-4 pb-4 pt-1 border-t border-ink-100">
                            <p className="text-sm text-ink-700 whitespace-pre-line leading-relaxed">{opt.copy}</p>
                            {opt.cta && <p className="mt-2 text-xs font-medium text-brand">CTA: {opt.cta}</p>}
                            {opt.hashtags && opt.hashtags.length > 0 && (
                              <p className="mt-2 text-[11px] text-ink-400 leading-relaxed">
                                {opt.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
