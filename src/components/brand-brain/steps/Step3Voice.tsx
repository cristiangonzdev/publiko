'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFormState } from '../useFormState'
import { TextInput, SelectField, TagsInput, FieldRow } from '../FormFields'

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  onSave: (section: string, data: Record<string, unknown>) => Promise<void>
}

export function Step3Voice({ initialData, onSave }: Props) {
  const [state, update] = useFormState(initialData?.voice ?? {})
  const debouncedState = useDebounce(state, 1500)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    onSave('voice', debouncedState)
  }, [debouncedState, onSave])

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">3. Voz y tono</h2>
      <p className="text-sm text-ink-500">Define cómo habla la marca. Claude usará esto en cada pieza de contenido.</p>

      <TagsInput label="Rasgos de personalidad (máx 5)" placeholder="elegante, cercano, directo…" value={state.personality_traits as string[] ?? []} onChange={(v) => update('personality_traits', v)} />

      <FieldRow>
        <SelectField
          label="Formalidad (1=muy informal, 5=muy formal)"
          value={String(state.formality_level ?? '3')}
          options={['1','2','3','4','5']}
          onChange={(v) => update('formality_level', parseInt(v))}
        />
        <SelectField
          label="Uso de emojis"
          value={state.emoji_usage as string ?? 'minimal'}
          options={['none','minimal','moderate','frequent']}
          onChange={(v) => update('emoji_usage', v)}
        />
      </FieldRow>

      <TextInput label="Estilo de emojis (si los usa)" placeholder="Solo gastronómicos: 🍷🥩" value={state.emoji_style as string ?? ''} onChange={(v) => update('emoji_style', v)} />

      <FieldRow>
        <SelectField label="Idioma principal" value={state.primary_language as string ?? 'es'} options={['es','en','fr','de','pt']} onChange={(v) => update('primary_language', v)} />
        <TagsInput label="Idiomas secundarios" placeholder="en, de…" value={state.secondary_languages as string[] ?? []} onChange={(v) => update('secondary_languages', v)} />
      </FieldRow>

      <TagsInput label="Palabras PROHIBIDAS" placeholder="barato, económico, mega…" value={state.forbidden_words as string[] ?? []} onChange={(v) => update('forbidden_words', v)} />
      <TagsInput label="Temas PROHIBIDOS" placeholder="política, competidores…" value={state.forbidden_topics as string[] ?? []} onChange={(v) => update('forbidden_topics', v)} />
      <TagsInput label="Palabras PREFERIDAS" placeholder="experiencia, temporada…" value={state.preferred_words as string[] ?? []} onChange={(v) => update('preferred_words', v)} />
      <TagsInput label="Expresiones firma" placeholder="Frases que ya usan y funcionan" value={state.signature_expressions as string[] ?? []} onChange={(v) => update('signature_expressions', v)} />
      <TagsInput label="Cuentas de referencia de tono" placeholder="@DiverXO, @StreetXO…" value={state.tone_references as string[] ?? []} onChange={(v) => update('tone_references', v)} />

      <div>
        <label className="block text-sm font-medium text-ink-700">Anti-tono (cómo NO sonar NUNCA)</label>
        <textarea
          value={state.anti_tone as string ?? ''}
          onChange={(e) => update('anti_tone', e.target.value)}
          rows={2}
          placeholder="No sonar como un menú impreso. No ser frío."
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
    </div>
  )
}
