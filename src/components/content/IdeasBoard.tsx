'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { uploadViaSignedUrl } from '@/lib/upload/signed-upload'
import {
  approveIdea,
  discardIdea,
  generateIdeas,
  getIdeaDetail,
  sendBrainFeedback,
} from '@/lib/api/ideas'
import {
  assignTask,
  judgeTask,
  retryBriefs as retryBriefsApi,
  selectCopy as selectCopyApi,
  sendToProduction as sendToProductionApi,
  setApprovalTier,
  type CopyOption,
  type EditingBrief,
  type JudgeVerdict,
  type RecordingBrief,
  type TaskDetail,
} from '@/lib/api/tasks'
import { AddIdeaModal } from './AddIdeaModal'

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
const ORIGIN_BADGE: Record<string, string> = {
  system: 'IA',
  human: 'Humano',
}

interface TeamMember { id: string; full_name: string }

interface Props {
  clientId: string
  initialIdeas: Array<Record<string, unknown>>
  brandBrainCompleted: boolean
  grabadores: TeamMember[]
  editores: TeamMember[]
  adminUserId: string
  adminName: string
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
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function findCopyIndex(options: CopyOption[] | null, selected: string | null): number | null {
  if (!options || !selected) return null
  const idx = options.findIndex((o) => (o.copy ?? '') === selected)
  return idx >= 0 ? idx : null
}

export function IdeasBoard({ clientId, initialIdeas, brandBrainCompleted, grabadores, editores, adminUserId, adminName }: Props) {
  const [ideas, setIdeas] = useState(initialIdeas)
  const [generating, setGenerating] = useState(false)
  const [activeStatus, setActiveStatus] = useState<string>('suggested')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<Record<string, unknown> | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showAddIdea, setShowAddIdea] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set())

  // Drawer-local state for production flow
  const [savingCopyIndex, setSavingCopyIndex] = useState<number | null>(null)
  const [grabadorPick, setGrabadorPick] = useState<string>('')
  const [editorPick, setEditorPick] = useState<string>('')
  const [savingTeam, setSavingTeam] = useState(false)
  const [sendingToProduction, setSendingToProduction] = useState(false)
  const [uploadingBruto, setUploadingBruto] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [togglingTier, setTogglingTier] = useState(false)
  const [runningJudge, setRunningJudge] = useState(false)
  const [pollingTimedOut, setPollingTimedOut] = useState(false)
  const [retryingBriefs, setRetryingBriefs] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingStartRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    pollingStartRef.current = null
  }, [])

  // Poll every 3s while task exists but briefs are still being generated (max 3 min)
  useEffect(() => {
    const brief = taskDetail?.recording_brief as Record<string, unknown> | null | undefined
    const briefsReady = brief != null && Object.keys(brief).length > 0
    if (!taskDetail || briefsReady) {
      stopPolling()
      return
    }
    if (!selectedIdea) return
    setPollingTimedOut(false)
    const ideaId = selectedIdea.id as string
    pollingStartRef.current = Date.now()
    pollingRef.current = setInterval(async () => {
      // Stop after 3 minutes
      if (pollingStartRef.current && Date.now() - pollingStartRef.current > 3 * 60 * 1000) {
        stopPolling()
        setPollingTimedOut(true)
        return
      }
      try {
        const task = await getIdeaDetail(ideaId)
        const brief = task?.recording_brief as Record<string, unknown> | null
        if (brief && Object.keys(brief).length > 0) {
          setTaskDetail(task)
          setGrabadorPick(task?.grabador_id ?? '')
          setEditorPick(task?.editor_id ?? '')
        }
      } catch { /* silent */ }
    }, 3000)
    return stopPolling
  }, [taskDetail, selectedIdea, stopPolling])

  const retryBriefs = async () => {
    if (!taskDetail) return
    setRetryingBriefs(true)
    setPollingTimedOut(false)
    try {
      await retryBriefsApi(taskDetail.id)
      // Restart polling
      setTaskDetail({ ...taskDetail, recording_brief: {} as RecordingBrief, editing_brief: {} as EditingBrief })
      toast.success('Regenerando briefs, espera unos segundos…')
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRetryingBriefs(false)
    }
  }

  const toggleApprovalTier = async () => {
    if (!taskDetail) return
    const next = taskDetail.approval_tier === 'auto' ? 'manual' : 'auto'
    setTogglingTier(true)
    try {
      await setApprovalTier(taskDetail.id, next)
      setTaskDetail({ ...taskDetail, approval_tier: next })
    } catch (err) {
      toast.error(`Error cambiando tier: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTogglingTier(false)
    }
  }

  const runJudge = async () => {
    if (!taskDetail) return
    setRunningJudge(true)
    try {
      const verdict = await judgeTask(taskDetail.id)
      setTaskDetail({
        ...taskDetail,
        judge_verdict: verdict,
        judge_run_at: new Date().toISOString(),
        auto_publish_blocked_reason: verdict.passes ? null : verdict.issues.join('; '),
      })
      toast.success(verdict.passes ? 'Judge aprobó el copy ✓' : 'Judge encontró problemas')
    } catch (err) {
      toast.error(`Error ejecutando judge: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunningJudge(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const newIdeas = await generateIdeas(clientId)
      setIdeas((prev) => [...newIdeas, ...prev])
      toast.success(`${newIdeas.length} ideas generadas`)
    } catch (err) {
      toast.error(`Error generando ideas: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(false)
    }
  }

  const approve = async (ideaId: string) => {
    if (loadingId) return
    setLoadingId(ideaId)
    try {
      await approveIdea(ideaId)
      const original = ideas.find((i) => i.id === ideaId)
      const updated = { ...(original ?? {}), id: ideaId, status: 'approved' }
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? updated : i))
      setActiveStatus('approved')
      void openDetail(updated)
      toast.success('Idea aprobada — generando briefs…')
    } catch (err) {
      toast.error(`Error aprobando idea: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoadingId(null)
    }
  }

  const discard = async (ideaId: string) => {
    if (loadingId) return
    setLoadingId(ideaId)
    try {
      await discardIdea(ideaId)
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, status: 'discarded' } : i))
    } catch (err) {
      toast.error(`Error descartando idea: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoadingId(null)
    }
  }

  const openDetail = async (idea: Record<string, unknown>) => {
    setSelectedIdea(idea)
    setTaskDetail(null)
    setUploadMessage(null)
    const status = idea.status as string
    if (['approved', 'in_production', 'published'].includes(status)) {
      setLoadingDetail(true)
      try {
        const task = await getIdeaDetail(idea.id as string)
        setTaskDetail(task)
        setGrabadorPick(task?.grabador_id ?? '')
        setEditorPick(task?.editor_id ?? '')
      } catch (err) {
        toast.error(`Error cargando briefs: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setLoadingDetail(false)
      }
    }
  }

  const closeDetail = () => {
    stopPolling()
    setSelectedIdea(null)
    setTaskDetail(null)
    setGrabadorPick('')
    setEditorPick('')
    setUploadMessage(null)
  }

  const selectCopy = async (copyIndex: number) => {
    if (!taskDetail) return
    setSavingCopyIndex(copyIndex)
    try {
      await selectCopyApi(taskDetail.id, copyIndex)
      const chosen = taskDetail.copy_options?.[copyIndex]
      setTaskDetail({
        ...taskDetail,
        copy_selected: chosen?.copy ?? '',
        hashtags: chosen?.hashtags ?? null,
        cta: chosen?.cta ?? null,
      })
    } catch (err) {
      toast.error(`Error eligiendo copy: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingCopyIndex(null)
    }
  }

  const saveTeam = async () => {
    if (!taskDetail) return
    if (grabadorPick === (taskDetail.grabador_id ?? '') && editorPick === (taskDetail.editor_id ?? '')) return
    setSavingTeam(true)
    try {
      await assignTask(taskDetail.id, {
        grabador_id: grabadorPick || null,
        editor_id: editorPick || null,
      })
      setTaskDetail({
        ...taskDetail,
        grabador_id: grabadorPick || null,
        editor_id: editorPick || null,
      })
      toast.success('Equipo asignado')
    } catch (err) {
      toast.error(`Error asignando equipo: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingTeam(false)
    }
  }

  const sendToProduction = async () => {
    if (!taskDetail || !selectedIdea) return
    if (!taskDetail.copy_selected) {
      toast.warning('Elige un copy antes de enviar a producción.')
      return
    }
    setSendingToProduction(true)
    try {
      await sendToProductionApi(taskDetail.id)
      const ideaId = selectedIdea.id as string
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, status: 'in_production' } : i))
      setSelectedIdea({ ...selectedIdea, status: 'in_production' })
      setTaskDetail({ ...taskDetail, status: 'recording' })
      setActiveStatus('in_production')
      toast.success('Enviado a producción — ya puedes grabar')
    } catch (err) {
      toast.error(`Error enviando a producción: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSendingToProduction(false)
    }
  }

  const handleBrutoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !taskDetail) return
    setUploadingBruto(true)
    setUploadMessage(`Subiendo ${file.name}…`)

    try {
      const { asset_id } = await uploadViaSignedUrl({
        prepareEndpoint: `/api/tasks/${taskDetail.id}/bruto-prepare`,
        confirmEndpoint: `/api/tasks/${taskDetail.id}/bruto-confirm`,
        file,
      })
      setTaskDetail({
        ...taskDetail,
        status: 'brutos_ready',
        bruto_asset_ids: [...(taskDetail.bruto_asset_ids ?? []), asset_id],
      })
      setUploadMessage('✓ Bruto subido')
      toast.success('Bruto subido correctamente')
    } catch (err) {
      setUploadMessage(null)
      toast.error(`Error subiendo bruto: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploadingBruto(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const markSuccess = async (idea: Record<string, unknown>) => {
    const ideaId = idea.id as string
    if (feedbackSent.has(ideaId)) return
    try {
      await sendBrainFeedback(clientId, {
        idea_id: ideaId,
        concept: idea.concept,
        angle: idea.angle,
        content_type: idea.content_type,
      })
      setFeedbackSent((prev) => new Set([...prev, ideaId]))
    } catch {
      // silent — non-critical
    }
  }

  const filtered = ideas.filter((i) => i.status === activeStatus)

  const ideaStatus = (selectedIdea?.status as string | undefined) ?? ''
  const taskStatus = taskDetail?.status ?? ''
  const selectedCopyIdx = findCopyIndex(taskDetail?.copy_options ?? null, taskDetail?.copy_selected ?? null)
  const teamDirty = !!taskDetail && (grabadorPick !== (taskDetail.grabador_id ?? '') || editorPick !== (taskDetail.editor_id ?? ''))
  const brutosCount = taskDetail?.bruto_asset_ids?.length ?? 0

  return (
    <div className="mt-8">
      <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleBrutoUpload} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
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

        <div className="flex gap-2">
          <button
            onClick={() => setShowAddIdea(true)}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            + Añadir idea
          </button>
          <button
            onClick={generate}
            disabled={generating || !brandBrainCompleted}
            title={!brandBrainCompleted ? 'Completa el Brand Brain antes de generar ideas' : undefined}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {generating ? 'Generando…' : '✦ Generar plan semanal'}
          </button>
        </div>
      </div>

      {!brandBrainCompleted && (
        <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Completa el <a href="../brand-brain" className="underline">Brand Brain</a> para poder generar ideas.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="col-span-3 py-8 text-center text-sm text-ink-400">
            {activeStatus === 'suggested' ? 'Sin ideas sugeridas. Genera el plan semanal.' : `Sin ideas en "${STATUS_LABEL[activeStatus]}".`}
          </p>
        )}
        {filtered.map((idea) => (
          <div
            key={idea.id as string}
            onClick={() => openDetail(idea)}
            className="cursor-pointer rounded-lg border border-ink-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLOR[idea.status as string])}>
                {idea.content_type as string}
              </span>
              <span className="text-[10px] text-ink-400">
                {ORIGIN_BADGE[idea.content_origin as string] ?? ''}
              </span>
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
                  onClick={() => approve(idea.id as string)}
                  disabled={loadingId === idea.id as string}
                  className="flex-1 rounded bg-ink-900 py-1.5 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50"
                >
                  {loadingId === idea.id as string ? 'Aprobando…' : 'Aprobar'}
                </button>
                <button
                  onClick={() => discard(idea.id as string)}
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
                  title="Marcar como contenido que funcionó bien para aprender de él"
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
                    feedbackSent.has(idea.id as string)
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'border border-ink-200 text-ink-400 hover:border-yellow-400 hover:text-yellow-600'
                  )}
                >
                  {feedbackSent.has(idea.id as string) ? '⭐ Aprendido' : '⭐ Funcionó bien'}
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

      {/* Add idea modal */}
      {showAddIdea && (
        <AddIdeaModal
          clientId={clientId}
          onClose={() => setShowAddIdea(false)}
          onCreated={(idea) => {
            setIdeas((prev) => [idea, ...prev])
            setActiveStatus('suggested')
          }}
        />
      )}

      {/* Detail drawer */}
      {selectedIdea && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-4 md:px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_COLOR[ideaStatus])}>
                    {selectedIdea.content_type as string}
                  </span>
                  <span className="text-ink-400">{ORIGIN_BADGE[selectedIdea.content_origin as string] ?? ''}</span>
                  {Boolean(selectedIdea.angle) && (
                    <span className="text-ink-400">· {selectedIdea.angle as string}</span>
                  )}
                </div>
                <h2 className="mt-1.5 text-base font-semibold text-ink-900 leading-snug">
                  {selectedIdea.concept as string}
                </h2>
              </div>
              {ideaStatus === 'published' && (
                <button
                  onClick={() => markSuccess(selectedIdea)}
                  className={cn(
                    'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    feedbackSent.has(selectedIdea.id as string)
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'border border-ink-200 text-ink-500 hover:border-yellow-400 hover:text-yellow-600'
                  )}
                >
                  {feedbackSent.has(selectedIdea.id as string) ? '⭐ Aprendido' : '⭐ Funcionó bien'}
                </button>
              )}
              <button
                onClick={closeDetail}
                className="flex-shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-5">
              {/* Full description */}
              {Boolean(selectedIdea.full_description) && (
                <Section title="Descripción">
                  <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                    {selectedIdea.full_description as string}
                  </p>
                </Section>
              )}

              {/* Human input */}
              {Boolean(selectedIdea.human_input) && (
                <Section title="Input original">
                  <p className="rounded-md bg-ink-50 px-3 py-2 text-sm italic text-ink-600">
                    &ldquo;{selectedIdea.human_input as string}&rdquo;
                  </p>
                </Section>
              )}

              {/* Loading task */}
              {loadingDetail && (
                <div className="py-6 text-center text-sm text-ink-400">Cargando briefs…</div>
              )}

              {/* Briefs generating skeleton / error state */}
              {taskDetail && (() => { const b = taskDetail.recording_brief as Record<string,unknown>|null; return !b || Object.keys(b).length === 0 })() && (
                <>
                  {pollingTimedOut ? (
                    <Section title="Brief de grabación">
                      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <p className="font-semibold">Error al generar los briefs</p>
                        <p className="mt-1 text-xs">Claude no pudo completar la generación. Puede ser un problema temporal.</p>
                        <button
                          onClick={retryBriefs}
                          disabled={retryingBriefs}
                          className="mt-3 rounded-md bg-red-800 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {retryingBriefs ? 'Regenerando…' : '↺ Reintentar generación'}
                        </button>
                      </div>
                    </Section>
                  ) : (
                    <>
                      <Section title="Brief de grabación">
                        <div className="space-y-2 animate-pulse">
                          <div className="h-3.5 rounded bg-ink-100 w-3/4" />
                          <div className="h-3.5 rounded bg-ink-100 w-1/2" />
                          <div className="h-3.5 rounded bg-ink-100 w-2/3" />
                          <div className="h-3.5 rounded bg-ink-100 w-3/5" />
                        </div>
                        <p className="mt-3 text-xs text-ink-400">Claude está generando el brief…</p>
                      </Section>
                      <Section title="Brief de edición">
                        <div className="space-y-2 animate-pulse">
                          <div className="h-3.5 rounded bg-ink-100 w-2/3" />
                          <div className="h-3.5 rounded bg-ink-100 w-1/2" />
                          <div className="h-3.5 rounded bg-ink-100 w-3/4" />
                        </div>
                      </Section>
                    </>
                  )}
                </>
              )}

              {/* Recording brief */}
              {taskDetail?.recording_brief && Object.keys(taskDetail.recording_brief as object).length > 0 && (
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

              {/* Editing brief */}
              {taskDetail?.editing_brief && Object.keys(taskDetail.editing_brief as object).length > 0 && (
                <Section title="Brief de edición">
                  <Row label="Duración final" value={taskDetail.editing_brief.duracion_final} />
                  <Row label="Ritmo" value={taskDetail.editing_brief.ritmo} />
                  <Row label="Transiciones" value={taskDetail.editing_brief.transiciones} />
                  {taskDetail.editing_brief.texto_pantalla && (
                    <Row label="Texto en pantalla" value={taskDetail.editing_brief.texto_pantalla} />
                  )}
                  {taskDetail.editing_brief.tipografia && (
                    <Row label="Tipografía" value={taskDetail.editing_brief.tipografia} />
                  )}
                  <Row label="Música exacta" value={taskDetail.editing_brief.musica_exacta} />
                  <Row label="Color grade" value={taskDetail.editing_brief.color_grade} />
                  <Row label="Exportación" value={taskDetail.editing_brief.formato_exportacion} />
                  {taskDetail.editing_brief.notas_especiales && (
                    <Row label="Notas especiales" value={taskDetail.editing_brief.notas_especiales} />
                  )}
                </Section>
              )}

              {/* Approval tier + judge */}
              {taskDetail && (
                <Section title="Aprobación">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          taskDetail.approval_tier === 'auto'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-ink-100 text-ink-600'
                        )}>
                          {taskDetail.approval_tier === 'auto' ? '⚡ AUTO' : 'MANUAL'}
                        </span>
                        <button
                          onClick={toggleApprovalTier}
                          disabled={togglingTier || ideaStatus !== 'approved'}
                          className="text-[11px] text-brand hover:underline disabled:cursor-not-allowed disabled:text-ink-300"
                        >
                          {togglingTier ? 'cambiando…' : 'cambiar'}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-500">
                        {taskDetail.approval_tier === 'auto'
                          ? 'El sistema publicará esta pieza sin tu OK si el AI judge la aprueba.'
                          : 'Necesita tu aprobación manual para publicarse.'}
                      </p>
                    </div>
                    {taskDetail.copy_selected && (
                      <button
                        onClick={runJudge}
                        disabled={runningJudge}
                        className="rounded-md border border-ink-300 px-3 py-1.5 text-[11px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                      >
                        {runningJudge ? 'Evaluando…' : taskDetail.judge_verdict ? 'Re-evaluar' : '✦ Pasar AI judge'}
                      </button>
                    )}
                  </div>

                  {taskDetail.judge_verdict && (
                    <div className={cn(
                      'mt-3 rounded-md border p-3 text-xs',
                      taskDetail.judge_verdict.passes
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-orange-200 bg-orange-50 text-orange-900'
                    )}>
                      <p className="font-semibold">
                        {taskDetail.judge_verdict.passes ? '✓ Apto para auto-publicar' : '⚠ Bloqueado por judge'}
                        <span className="ml-2 font-normal opacity-70">score {(taskDetail.judge_verdict.score * 100).toFixed(0)}%</span>
                      </p>
                      <p className="mt-1 italic opacity-80">{taskDetail.judge_verdict.reasoning}</p>
                      {taskDetail.judge_verdict.issues.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {taskDetail.judge_verdict.issues.map((issue, i) => (
                            <li key={i} className="flex gap-2"><span>•</span><span>{issue}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {/* Per-platform copies — read-only summary */}
              {taskDetail?.copies_per_platform && Object.keys(taskDetail.copies_per_platform).length > 0 && (
                <Section title="Copy por plataforma">
                  <div className="space-y-3">
                    {Object.entries(taskDetail.copies_per_platform).map(([platform, c]) => (
                      <div key={platform} className="rounded-lg border border-ink-200 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">{platform}</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{c.copy}</p>
                        {c.cta && <p className="mt-1.5 text-xs font-medium text-brand">CTA: {c.cta}</p>}
                        {c.hashtags && c.hashtags.length > 0 && (
                          <p className="mt-1 text-[11px] text-ink-400">
                            {c.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Copy options — SELECTABLE */}
              {taskDetail?.copy_options && taskDetail.copy_options.length > 0 && (
                <Section title="Elige el copy">
                  <div className="space-y-3">
                    {taskDetail.copy_options.map((opt, i) => {
                      const isSelected = selectedCopyIdx === i
                      const isSaving = savingCopyIndex === i
                      return (
                        <div
                          key={i}
                          className={cn(
                            'rounded-lg border overflow-hidden transition-colors',
                            isSelected ? 'border-brand bg-brand/5' : 'border-ink-200'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-full border-2',
                                isSelected ? 'border-brand bg-brand' : 'border-ink-300'
                              )}>
                                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </span>
                              <span className="text-xs font-semibold text-ink-700">
                                Opción {i + 1} {isSelected && <span className="text-brand">· elegida</span>}
                              </span>
                            </div>
                            {!isSelected && ideaStatus === 'approved' && (
                              <button
                                onClick={() => selectCopy(i)}
                                disabled={savingCopyIndex !== null}
                                className="rounded-md border border-ink-300 px-3 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                              >
                                {isSaving ? 'Guardando…' : 'Usar este copy'}
                              </button>
                            )}
                          </div>
                          <div className="px-4 pb-4 pt-1 border-t border-ink-100">
                            <p className="text-sm text-ink-700 whitespace-pre-line leading-relaxed">{opt.copy}</p>
                            {opt.cta && (
                              <p className="mt-2 text-xs font-medium text-brand">CTA: {opt.cta}</p>
                            )}
                            {opt.hashtags && opt.hashtags.length > 0 && (
                              <p className="mt-2 text-[11px] text-ink-400 leading-relaxed">
                                {opt.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Team assignment — visible for admin at any production stage (including solo) */}
              {taskDetail && ['approved', 'in_production', 'published'].includes(ideaStatus) && (
                <Section title="Equipo asignado (opcional)">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-ink-500">Grabador</span>
                      <select
                        value={grabadorPick}
                        onChange={(e) => setGrabadorPick(e.target.value)}
                        className="w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
                      >
                        <option value="">Sin asignar</option>
                        <option value={adminUserId}>Yo — {adminName}</option>
                        {grabadores.filter((g) => g.id !== adminUserId).map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-ink-500">Editor</span>
                      <select
                        value={editorPick}
                        onChange={(e) => setEditorPick(e.target.value)}
                        className="w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
                      >
                        <option value="">Sin asignar</option>
                        <option value={adminUserId}>Yo — {adminName}</option>
                        {editores.filter((e) => e.id !== adminUserId).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                      </select>
                    </label>
                  </div>
                  {teamDirty && (
                    <button
                      onClick={saveTeam}
                      disabled={savingTeam}
                      className="mt-3 rounded border border-ink-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                    >
                      {savingTeam ? 'Guardando…' : 'Guardar asignación'}
                    </button>
                  )}
                </Section>
              )}

              {/* In-production controls: upload bruto */}
              {taskDetail && (ideaStatus === 'in_production' || taskStatus === 'recording' || taskStatus === 'brutos_ready') && (
                <Section title="Grabación">
                  {taskDetail.copy_selected && (
                    <div className="mb-3 rounded-md bg-blue-50 p-3 text-xs text-blue-900">
                      <p className="font-semibold mb-1">Copy final que usará el editor:</p>
                      <p className="whitespace-pre-line">{taskDetail.copy_selected}</p>
                    </div>
                  )}
                  {brutosCount > 0 && (
                    <p className="mb-2 text-xs text-green-700">
                      ✓ {brutosCount} archivo{brutosCount === 1 ? '' : 's'} subido{brutosCount === 1 ? '' : 's'} {taskDetail.editor_id ? '— editor avisado' : '— admin avisado'}
                    </p>
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingBruto}
                    className="w-full rounded-md bg-ink-900 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
                  >
                    {uploadingBruto ? (uploadMessage ?? 'Subiendo…') : (brutosCount > 0 ? '+ Añadir otro bruto' : '↑ Subir mi grabación')}
                  </button>
                  {uploadMessage && !uploadingBruto && (
                    <p className="mt-2 text-xs text-green-700">{uploadMessage}</p>
                  )}
                </Section>
              )}
            </div>

            {/* Drawer footer: Send to production */}
            {taskDetail && ideaStatus === 'approved' && (
              <div className="border-t border-ink-100 bg-ink-50 px-6 py-4">
                <button
                  onClick={sendToProduction}
                  disabled={!taskDetail.copy_selected || sendingToProduction}
                  className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sendingToProduction
                    ? 'Enviando…'
                    : taskDetail.copy_selected
                      ? '→ Enviar a producción'
                      : 'Elige un copy para continuar'}
                </button>
                {!taskDetail.copy_selected && (
                  <p className="mt-2 text-center text-[11px] text-ink-400">
                    Sin copy elegido, el editor no sabrá qué usar.
                  </p>
                )}
              </div>
            )}

            {/* No task yet (still suggested) */}
            {!loadingDetail && !taskDetail && ['approved', 'in_production', 'published'].includes(ideaStatus) && (
              <div className="border-t border-ink-100 px-6 py-4">
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                  Los briefs se están generando o no están disponibles todavía.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
