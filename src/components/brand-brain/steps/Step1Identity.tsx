'use client'

import { FieldRow, TextInput, TextArea, SelectField, NumberInput } from '../FormFields'
import { BUSINESS_TYPE_OPTIONS, DEFAULT_BUSINESS_TYPE, type BusinessTypePreset } from '../businessTypes'

export interface StepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  update: (key: string, value: unknown) => void
  preset: BusinessTypePreset
}

const PRICE_TIERS = [
  { value: 'budget', label: 'Económico' },
  { value: 'mid', label: 'Medio' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Lujo' },
]

export function Step1Identity({ data, update, preset }: StepProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">1. Identidad del negocio</h2>
      <p className="text-sm text-ink-500">Los datos básicos que definen quiénes son y qué ofrecen.</p>

      <FieldRow>
        <TextInput label="Nombre del negocio *" value={data.business_name ?? ''} onChange={(v) => update('business_name', v)} />
        <TextInput label="Nombre comercial (si difiere)" value={data.trade_name ?? ''} onChange={(v) => update('trade_name', v)} />
      </FieldRow>

      <FieldRow>
        <SelectField
          label="Tipo de negocio"
          value={(data.business_type as string) ?? DEFAULT_BUSINESS_TYPE}
          options={BUSINESS_TYPE_OPTIONS}
          onChange={(v) => update('business_type', v)}
        />
        <TextInput label="Especialidad / subsector" placeholder={preset.subsectorPlaceholder} value={data.subsector ?? ''} onChange={(v) => update('subsector', v)} />
      </FieldRow>

      <FieldRow>
        <TextInput label="Ciudad" value={data.location_city ?? ''} onChange={(v) => update('location_city', v)} />
        <TextInput label="Barrio / zona" value={data.location_neighborhood ?? ''} onChange={(v) => update('location_neighborhood', v)} />
      </FieldRow>

      <TextInput label="¿Qué hace en 1 línea? (one-liner)" placeholder={preset.oneLinerPlaceholder} value={data.one_liner ?? ''} onChange={(v) => update('one_liner', v)} />
      <TextArea label="Propuesta de valor única" placeholder="Por qué existen, qué hacen diferente…" value={data.unique_value_proposition ?? ''} onChange={(v) => update('unique_value_proposition', v)} />
      <TextArea label="Historia de fundación (opcional)" placeholder="Cómo nació el negocio…" value={data.founding_story ?? ''} onChange={(v) => update('founding_story', v)} />

      <FieldRow>
        <SelectField
          label="Nivel de precio"
          value={data.price_tier ?? 'mid'}
          options={PRICE_TIERS}
          onChange={(v) => update('price_tier', v)}
        />
        <TextInput label="Contexto de precio" placeholder={preset.priceContextPlaceholder} value={data.price_context ?? ''} onChange={(v) => update('price_context', v)} />
      </FieldRow>

      <FieldRow>
        <NumberInput label="Año de fundación" value={data.founded_year ?? ''} onChange={(v) => update('founded_year', v)} />
        <NumberInput label="Número de locales" value={data.locations_count ?? 1} onChange={(v) => update('locations_count', v)} />
      </FieldRow>
    </div>
  )
}
