'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFormState } from '../useFormState'
import { TextInput, TextArea, SelectField, TagsInput } from '../FormFields'

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  onSave: (section: string, data: Record<string, unknown>) => Promise<void>
}

export function Step2Audience({ initialData, onSave }: Props) {
  const [state, update] = useFormState(initialData?.audience ?? {})
  const debouncedState = useDebounce(state, 1500)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    onSave('audience', debouncedState)
  }, [debouncedState, onSave])

  const primary = (state.primary as Record<string, unknown>) ?? {}
  const updatePrimary = (key: string, val: unknown) => update('primary', { ...primary, [key]: val })

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">2. Audiencia objetivo</h2>
      <p className="text-sm text-ink-500">Psicografía del cliente ideal. Esto alimenta el tono de Claude.</p>

      <div className="grid grid-cols-2 gap-4">
        <TextInput label="Rango de edad" placeholder="25-40" value={primary.age_range as string ?? ''} onChange={(v) => updatePrimary('age_range', v)} />
        <SelectField label="Foco de género" value={primary.gender_focus as string ?? 'mixed'} options={['male','female','mixed']} onChange={(v) => updatePrimary('gender_focus', v)} />
      </div>

      <TextInput label="Ocupación / perfil" placeholder="Profesionales, turistas de nivel medio-alto" value={primary.occupation as string ?? ''} onChange={(v) => updatePrimary('occupation', v)} />
      <TextArea label="Estilo de vida" placeholder="Cómo es su vida, qué valoran…" value={primary.lifestyle as string ?? ''} onChange={(v) => updatePrimary('lifestyle', v)} />

      <TextArea label="¿Qué sienten ANTES de encontrar este negocio?" value={primary.pain_before as string ?? ''} onChange={(v) => updatePrimary('pain_before', v)} />
      <TextArea label="¿Qué quieren conseguir?" value={primary.desire as string ?? ''} onChange={(v) => updatePrimary('desire', v)} />
      <TextArea label="¿Cómo se sienten DESPUÉS de la experiencia?" value={primary.transformation as string ?? ''} onChange={(v) => updatePrimary('transformation', v)} />
      <TextArea label="¿Cómo habla este cliente? ¿Qué palabras usa?" value={primary.how_they_talk as string ?? ''} onChange={(v) => updatePrimary('how_they_talk', v)} />

      <TagsInput label="Lo que el cliente NUNCA diría" placeholder="Añadir frase + Enter" value={state.never_says as string[] ?? []} onChange={(v) => update('never_says', v)} />
      <TagsInput label="Lo que el cliente SÍ dice (testimonios)" placeholder="Añadir frase + Enter" value={state.they_say as string[] ?? []} onChange={(v) => update('they_say', v)} />
    </div>
  )
}
