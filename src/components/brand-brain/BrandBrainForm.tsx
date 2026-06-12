'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { saveBrandBrain, completeBrandBrainOnboarding } from '@/app/(admin)/admin/clients/[id]/brand-brain/actions'
import { getPreset } from './businessTypes'
import { Step1Identity } from './steps/Step1Identity'
import { Step2Audience } from './steps/Step2Audience'
import { Step3Voice } from './steps/Step3Voice'
import { Step4Products } from './steps/Step4Products'
import { Step5Visual } from './steps/Step5Visual'
import { Step6Operations } from './steps/Step6Operations'

const SECTIONS = ['identity', 'audience', 'voice', 'products', 'visual_identity', 'operations'] as const
type Section = (typeof SECTIONS)[number]

const STEPS: { number: number; label: string; section: Section }[] = [
  { number: 1, label: 'Identidad', section: 'identity' },
  { number: 2, label: 'Audiencia', section: 'audience' },
  { number: 3, label: 'Voz y tono', section: 'voice' },
  { number: 4, label: 'Productos', section: 'products' },
  { number: 5, label: 'Visual', section: 'visual_identity' },
  { number: 6, label: 'Operaciones', section: 'operations' },
]

type SectionData = Record<string, unknown>
type FormData = Record<Section, SectionData>
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  isCompleted: boolean
  currentStep: number
}

export function BrandBrainForm({ clientId, initialData, isCompleted, currentStep }: Props) {
  const [activeStep, setActiveStep] = useState(Math.min(currentStep, 6))
  // Única fuente de verdad de las 6 secciones: vive en el padre, así navegar
  // entre pasos NUNCA pierde cambios (antes cada paso tenía su propio estado
  // y se destruía al desmontar, perdiendo lo no-flusheado por el debounce).
  const [data, setData] = useState<FormData>(() => ({
    identity: initialData?.identity ?? {},
    audience: initialData?.audience ?? {},
    voice: initialData?.voice ?? {},
    products: initialData?.products ?? {},
    visual_identity: initialData?.visual_identity ?? {},
    operations: initialData?.operations ?? {},
  }))
  const [dirty, setDirty] = useState<ReadonlySet<Section>>(new Set())
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(isCompleted)
  const [validationMsg, setValidationMsg] = useState('')

  // Refs espejo para poder guardar desde callbacks sin closures obsoletos
  const dataRef = useRef(data)
  dataRef.current = data
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const savingRef = useRef(false)

  const updateSection = useCallback((section: Section, key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
    setDirty((prev) => new Set(prev).add(section))
  }, [])

  /** Guarda todas las secciones con cambios pendientes (+ extras como onboarding_step). */
  const flush = useCallback(
    async (extra?: Record<string, unknown>): Promise<boolean> => {
      const sections = [...dirtyRef.current]
      if (sections.length === 0 && !extra) return true
      if (savingRef.current) return true // ya hay un guardado en vuelo con los mismos datos (refs)

      savingRef.current = true
      setStatus('saving')
      setErrorMsg('')
      const patch: Record<string, unknown> = { ...extra }
      for (const s of sections) patch[s] = dataRef.current[s]

      try {
        await saveBrandBrain(clientId, patch)
        setDirty((prev) => {
          const next = new Set(prev)
          sections.forEach((s) => next.delete(s))
          return next
        })
        setStatus('saved')
        return true
      } catch (e) {
        setStatus('error')
        setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
        return false
      } finally {
        savingRef.current = false
      }
    },
    [clientId]
  )

  // Autosave: 1,5s después del último cambio
  useEffect(() => {
    if (dirty.size === 0) return
    const t = setTimeout(() => void flush(), 1500)
    return () => clearTimeout(t)
  }, [data, dirty, flush])

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar
  useEffect(() => {
    if (dirty.size === 0) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const goNext = async () => {
    const next = Math.min(6, activeStep + 1)
    setActiveStep(next)
    // Guarda lo pendiente y registra el avance del onboarding
    await flush({ onboarding_step: next })
  }

  const goToStep = (step: number) => {
    setActiveStep(step)
    if (dirtyRef.current.size > 0) void flush()
  }

  const handleComplete = async () => {
    setValidationMsg('')
    const name = (dataRef.current.identity.business_name as string | undefined)?.trim()
    if (!name) {
      setValidationMsg('Falta el nombre del negocio (paso 1) para completar el Brand Brain.')
      return
    }
    setCompleting(true)
    try {
      const ok = await flush()
      if (!ok) return
      await completeBrandBrainOnboarding(clientId)
      setCompleted(true)
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Error al completar')
    } finally {
      setCompleting(false)
    }
  }

  const preset = getPreset(data.identity.business_type as string | undefined)
  const stepProps = (section: Section) => ({
    data: data[section],
    update: (key: string, value: unknown) => updateSection(section, key, value),
    preset,
  })

  const hasPending = dirty.size > 0

  return (
    <div className="mt-8">
      {/* Progress bar */}
      <div className="flex gap-1">
        {STEPS.map((step) => (
          <button
            key={step.number}
            onClick={() => goToStep(step.number)}
            className={cn(
              'flex-1 rounded-full h-1.5 transition-colors',
              activeStep >= step.number ? 'bg-brand' : 'bg-ink-200'
            )}
          />
        ))}
      </div>

      {/* Step tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((step) => (
          <button
            key={step.number}
            onClick={() => goToStep(step.number)}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeStep === step.number
                ? 'bg-ink-900 text-white'
                : 'border border-ink-200 text-ink-500 hover:border-ink-400'
            )}
          >
            {step.number}. {step.label}
          </button>
        ))}
      </div>

      {/* Save indicator */}
      <div className="mt-3 flex h-5 items-center justify-end gap-2 text-xs">
        {status === 'saving' && <span className="text-ink-400">Guardando…</span>}
        {status === 'saved' && !hasPending && <span className="text-green-600">✓ Guardado</span>}
        {status !== 'saving' && hasPending && status !== 'error' && (
          <span className="text-amber-600">Cambios sin guardar</span>
        )}
        {status === 'error' && (
          <>
            <span className="text-red-600">⚠ No se pudo guardar{errorMsg ? `: ${errorMsg}` : ''}</span>
            <button onClick={() => void flush()} className="font-medium text-red-600 underline">
              Reintentar
            </button>
          </>
        )}
      </div>

      {/* Step content */}
      <div className="mt-2 rounded-lg border border-ink-200 bg-white p-6">
        {activeStep === 1 && <Step1Identity {...stepProps('identity')} />}
        {activeStep === 2 && <Step2Audience {...stepProps('audience')} />}
        {activeStep === 3 && <Step3Voice {...stepProps('voice')} />}
        {activeStep === 4 && <Step4Products {...stepProps('products')} />}
        {activeStep === 5 && <Step5Visual {...stepProps('visual_identity')} />}
        {activeStep === 6 && <Step6Operations {...stepProps('operations')} />}
      </div>

      {validationMsg && (
        <p className="mt-3 text-sm text-red-600">{validationMsg}</p>
      )}

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => goToStep(Math.max(1, activeStep - 1))}
          disabled={activeStep === 1}
          className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 disabled:opacity-40"
        >
          ← Anterior
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void flush()}
            disabled={!hasPending || status === 'saving'}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          >
            {status === 'saving' ? 'Guardando…' : 'Guardar'}
          </button>

          {activeStep < 6 ? (
            <button
              onClick={() => void goNext()}
              className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
            >
              Guardar y siguiente →
            </button>
          ) : completed ? (
            <span className="text-sm font-medium text-green-600">✓ Brand Brain completado</span>
          ) : (
            <button
              onClick={() => void handleComplete()}
              disabled={completing || status === 'saving'}
              className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {completing ? 'Completando…' : 'Completar Brand Brain ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
