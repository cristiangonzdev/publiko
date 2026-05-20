'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { saveBrandBrainSection, completeBrandBrainOnboarding } from '@/app/(admin)/admin/clients/[id]/brand-brain/actions'
import { Step1Identity } from './steps/Step1Identity'
import { Step2Audience } from './steps/Step2Audience'
import { Step3Voice } from './steps/Step3Voice'
import { Step4Products } from './steps/Step4Products'
import { Step5Visual } from './steps/Step5Visual'
import { Step6Operations } from './steps/Step6Operations'

const STEPS = [
  { number: 1, label: 'Identidad', section: 'identity' },
  { number: 2, label: 'Audiencia', section: 'audience' },
  { number: 3, label: 'Voz y tono', section: 'voice' },
  { number: 4, label: 'Productos', section: 'products' },
  { number: 5, label: 'Visual', section: 'visual_identity' },
  { number: 6, label: 'Operaciones', section: 'operations' },
]

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  isCompleted: boolean
  currentStep: number
}

export function BrandBrainForm({ clientId, initialData, isCompleted, currentStep }: Props) {
  const [activeStep, setActiveStep] = useState(Math.min(currentStep, 6))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(isCompleted)

  const handleSave = useCallback(
    async (section: string, data: Record<string, unknown>) => {
      setSaving(true)
      setSaved(false)
      try {
        await saveBrandBrainSection(clientId, section, data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } finally {
        setSaving(false)
      }
    },
    [clientId]
  )

  const handleComplete = async () => {
    setCompleting(true)
    await completeBrandBrainOnboarding(clientId)
    setCompleted(true)
    setCompleting(false)
  }

  const stepProps = { clientId, initialData, onSave: handleSave }

  return (
    <div className="mt-8">
      {/* Progress bar */}
      <div className="flex gap-1">
        {STEPS.map((step) => (
          <button
            key={step.number}
            onClick={() => setActiveStep(step.number)}
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
            onClick={() => setActiveStep(step.number)}
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
      <div className="mt-3 h-4 text-right text-xs text-ink-400">
        {saving && 'Guardando…'}
        {saved && !saving && '✓ Guardado'}
      </div>

      {/* Step content */}
      <div className="mt-4 rounded-lg border border-ink-200 bg-white p-6">
        {activeStep === 1 && <Step1Identity {...stepProps} />}
        {activeStep === 2 && <Step2Audience {...stepProps} />}
        {activeStep === 3 && <Step3Voice {...stepProps} />}
        {activeStep === 4 && <Step4Products {...stepProps} />}
        {activeStep === 5 && <Step5Visual {...stepProps} />}
        {activeStep === 6 && <Step6Operations {...stepProps} />}
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
          disabled={activeStep === 1}
          className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 disabled:opacity-40"
        >
          ← Anterior
        </button>

        {activeStep < 6 ? (
          <button
            onClick={() => setActiveStep((s) => Math.min(6, s + 1))}
            className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
          >
            Siguiente →
          </button>
        ) : completed ? (
          <span className="text-sm font-medium text-green-600">✓ Brand Brain completado</span>
        ) : (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {completing ? 'Completando…' : 'Completar Brand Brain ✓'}
          </button>
        )}
      </div>
    </div>
  )
}
