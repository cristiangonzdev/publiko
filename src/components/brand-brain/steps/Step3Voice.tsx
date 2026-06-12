'use client'

import { TextInput, SelectField, TagsInput, FieldRow } from '../FormFields'
import type { StepProps } from './Step1Identity'

const EMOJI_OPTIONS = [
  { value: 'none', label: 'Ninguno' },
  { value: 'minimal', label: 'Mínimo' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'frequent', label: 'Frecuente' },
]

export function Step3Voice({ data, update, preset }: StepProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">3. Voz y tono</h2>
      <p className="text-sm text-ink-500">Define cómo habla la marca. La IA usará esto en cada pieza de contenido.</p>

      <TagsInput label="Rasgos de personalidad (máx 5)" placeholder="elegante, cercano, directo…" value={data.personality_traits as string[] ?? []} onChange={(v) => update('personality_traits', v)} />

      <FieldRow>
        <SelectField
          label="Formalidad (1=muy informal, 5=muy formal)"
          value={String(data.formality_level ?? '3')}
          options={['1','2','3','4','5']}
          onChange={(v) => update('formality_level', parseInt(v))}
        />
        <SelectField
          label="Uso de emojis"
          value={data.emoji_usage as string ?? 'minimal'}
          options={EMOJI_OPTIONS}
          onChange={(v) => update('emoji_usage', v)}
        />
      </FieldRow>

      <TextInput label="Estilo de emojis (si los usa)" placeholder={preset.emojiStylePlaceholder} value={data.emoji_style as string ?? ''} onChange={(v) => update('emoji_style', v)} />

      <FieldRow>
        <SelectField label="Idioma principal" value={data.primary_language as string ?? 'es'} options={['es','en','fr','de','pt']} onChange={(v) => update('primary_language', v)} />
        <TagsInput label="Idiomas secundarios" placeholder="en, de…" value={data.secondary_languages as string[] ?? []} onChange={(v) => update('secondary_languages', v)} />
      </FieldRow>

      <TagsInput label="Palabras PROHIBIDAS" placeholder="barato, económico, mega…" value={data.forbidden_words as string[] ?? []} onChange={(v) => update('forbidden_words', v)} />
      <TagsInput label="Temas PROHIBIDOS" placeholder="política, competidores…" value={data.forbidden_topics as string[] ?? []} onChange={(v) => update('forbidden_topics', v)} />
      <TagsInput label="Palabras PREFERIDAS" placeholder="experiencia, temporada…" value={data.preferred_words as string[] ?? []} onChange={(v) => update('preferred_words', v)} />
      <TagsInput label="Expresiones firma" placeholder="Frases que ya usan y funcionan" value={data.signature_expressions as string[] ?? []} onChange={(v) => update('signature_expressions', v)} />
      <TagsInput label="Cuentas de referencia de tono" placeholder={preset.toneReferencesPlaceholder} value={data.tone_references as string[] ?? []} onChange={(v) => update('tone_references', v)} />

      <div>
        <label className="block text-sm font-medium text-ink-700">Anti-tono (cómo NO sonar NUNCA)</label>
        <textarea
          value={data.anti_tone as string ?? ''}
          onChange={(e) => update('anti_tone', e.target.value)}
          rows={2}
          placeholder="No sonar como un menú impreso. No ser frío."
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
    </div>
  )
}
