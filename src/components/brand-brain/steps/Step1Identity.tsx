'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFormState } from '../useFormState'
import { FieldRow, TextInput, TextArea, SelectField, NumberInput } from '../FormFields'

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  onSave: (section: string, data: Record<string, unknown>) => Promise<void>
}

const PRICE_TIERS = ['budget', 'mid', 'premium', 'luxury']

export function Step1Identity({ initialData, onSave }: Props) {
  const [state, update] = useFormState(initialData?.identity ?? {})
  const debouncedState = useDebounce(state, 1500)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    onSave('identity', debouncedState)
  }, [debouncedState, onSave])

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">1. Identidad del negocio</h2>
      <p className="text-sm text-ink-500">Los datos básicos que definen quiénes son y qué ofrecen.</p>

      <FieldRow>
        <TextInput label="Nombre del negocio *" value={state.business_name ?? ''} onChange={(v) => update('business_name', v)} />
        <TextInput label="Nombre comercial (si difiere)" value={state.trade_name ?? ''} onChange={(v) => update('trade_name', v)} />
      </FieldRow>

      <FieldRow>
        <TextInput label="Sector" placeholder="Restauración, Hostelería…" value={state.sector ?? ''} onChange={(v) => update('sector', v)} />
        <TextInput label="Subsector" placeholder="Restaurante gourmet, Bar de tapas…" value={state.subsector ?? ''} onChange={(v) => update('subsector', v)} />
      </FieldRow>

      <FieldRow>
        <TextInput label="Ciudad" value={state.location_city ?? ''} onChange={(v) => update('location_city', v)} />
        <TextInput label="Barrio / zona" value={state.location_neighborhood ?? ''} onChange={(v) => update('location_neighborhood', v)} />
      </FieldRow>

      <TextInput label="¿Qué hace en 1 línea? (one-liner)" value={state.one_liner ?? ''} onChange={(v) => update('one_liner', v)} />
      <TextArea label="Propuesta de valor única" placeholder="Por qué existen, qué hacen diferente…" value={state.unique_value_proposition ?? ''} onChange={(v) => update('unique_value_proposition', v)} />
      <TextArea label="Historia de fundación (opcional)" placeholder="Cómo nació el negocio…" value={state.founding_story ?? ''} onChange={(v) => update('founding_story', v)} />

      <FieldRow>
        <SelectField
          label="Nivel de precio"
          value={state.price_tier ?? 'mid'}
          options={PRICE_TIERS}
          onChange={(v) => update('price_tier', v)}
        />
        <TextInput label="Contexto de precio" placeholder="Menú del día 12€, carta media 35€" value={state.price_context ?? ''} onChange={(v) => update('price_context', v)} />
      </FieldRow>

      <FieldRow>
        <NumberInput label="Año de fundación" value={state.founded_year ?? ''} onChange={(v) => update('founded_year', v)} />
        <NumberInput label="Número de locales" value={state.locations_count ?? 1} onChange={(v) => update('locations_count', v)} />
      </FieldRow>
    </div>
  )
}
