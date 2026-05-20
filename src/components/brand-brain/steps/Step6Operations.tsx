'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFormState } from '../useFormState'
import { TextInput, TextArea, FieldRow } from '../FormFields'

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  onSave: (section: string, data: Record<string, unknown>) => Promise<void>
}

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
const DAY_LABELS: Record<string, string> = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' }

export function Step6Operations({ initialData, onSave }: Props) {
  const [state, update] = useFormState(initialData?.operations ?? {})
  const debouncedState = useDebounce(state, 1500)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    onSave('operations', debouncedState)
  }, [debouncedState, onSave])

  const schedule = (state.schedule as Record<string, string>) ?? {}
  const booking = (state.booking as Record<string, unknown>) ?? {}
  const goals = (state.social_goals as Record<string, unknown>) ?? {}

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">6. Operaciones y objetivos</h2>
      <p className="text-sm text-ink-500">Horarios, reservas y metas en redes. Esta info evita publicar cuando están cerrados.</p>

      <h3 className="text-sm font-semibold text-ink-700">Horario semanal</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DAYS.map((day) => (
          <div key={day}>
            <label className="block text-xs font-medium text-ink-600">{DAY_LABELS[day]}</label>
            <input
              type="text"
              placeholder="Cerrado"
              value={schedule[day] ?? ''}
              onChange={(e) => update('schedule', { ...schedule, [day]: e.target.value })}
              className="mt-1 w-full rounded border border-ink-200 px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
            />
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-ink-700 pt-2">Reservas y contacto</h3>
      <FieldRow>
        <TextInput label="WhatsApp" placeholder="+34 600 000 000" value={booking.whatsapp as string ?? ''} onChange={(v) => update('booking', { ...booking, whatsapp: v })} />
        <TextInput label="Teléfono" value={booking.phone as string ?? ''} onChange={(v) => update('booking', { ...booking, phone: v })} />
      </FieldRow>
      <FieldRow>
        <TextInput label="Email de reservas" value={booking.email as string ?? ''} onChange={(v) => update('booking', { ...booking, email: v })} />
        <TextInput label="CTA de reservas" placeholder="Reserva tu mesa en…" value={booking.booking_cta as string ?? ''} onChange={(v) => update('booking', { ...booking, booking_cta: v })} />
      </FieldRow>

      <h3 className="text-sm font-semibold text-ink-700 pt-2">Objetivos en redes</h3>
      <TextInput label="Objetivo principal" placeholder="Aumentar reservas para eventos privados" value={goals.primary as string ?? ''} onChange={(v) => update('social_goals', { ...goals, primary: v })} />
      <TextInput label="Objetivo secundario" value={goals.secondary as string ?? ''} onChange={(v) => update('social_goals', { ...goals, secondary: v })} />

      <TextArea
        label="Contexto adicional importante"
        placeholder="Info relevante que Claude debe conocer y no encaja en otra sección…"
        value={state.important_context as string ?? ''}
        onChange={(v) => update('important_context', v)}
      />
      <TextArea
        label="Notas internas (no se muestran al cliente)"
        value={state.client_notes as string ?? ''}
        onChange={(v) => update('client_notes', v)}
      />
    </div>
  )
}
