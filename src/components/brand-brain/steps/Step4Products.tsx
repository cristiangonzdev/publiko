'use client'

import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFormState } from '../useFormState'
import { TextInput, TextArea } from '../FormFields'

interface Props {
  clientId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
  onSave: (section: string, data: Record<string, unknown>) => Promise<void>
}

interface HeroItem { name: string; description: string; price: string; why_special: string; content_angle: string }
const emptyItem = (): HeroItem => ({ name: '', description: '', price: '', why_special: '', content_angle: '' })

export function Step4Products({ initialData, onSave }: Props) {
  const [state, update] = useFormState(initialData?.products ?? {})
  const debouncedState = useDebounce(state, 1500)
  const isFirst = useRef(true)
  const [openItem, setOpenItem] = useState<number | null>(null)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    onSave('products', debouncedState)
  }, [debouncedState, onSave])

  const items: HeroItem[] = (state.hero_items as HeroItem[]) ?? []
  const updateItem = (i: number, key: keyof HeroItem, val: string) => {
    const updated = items.map((item, idx) => idx === i ? { ...item, [key]: val } : item)
    update('hero_items', updated)
  }
  const addItem = () => { update('hero_items', [...items, emptyItem()]); setOpenItem(items.length) }
  const removeItem = (i: number) => { update('hero_items', items.filter((_, idx) => idx !== i)); setOpenItem(null) }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">4. Productos y servicios estrella</h2>
      <p className="text-sm text-ink-500">Los platos / servicios que el grabador debe priorizar y Claude debe mencionar.</p>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-md border border-ink-200">
            <button
              type="button"
              onClick={() => setOpenItem(openItem === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink-800"
            >
              <span>{item.name || `Producto ${i + 1}`}</span>
              <span className="text-ink-400">{openItem === i ? '▲' : '▼'}</span>
            </button>
            {openItem === i && (
              <div className="space-y-3 border-t border-ink-100 px-4 pb-4 pt-3">
                <TextInput label="Nombre" value={item.name} onChange={(v) => updateItem(i, 'name', v)} />
                <TextArea label="Descripción para copy" value={item.description} onChange={(v) => updateItem(i, 'description', v)} />
                <TextInput label="Precio (opcional)" placeholder="28€" value={item.price} onChange={(v) => updateItem(i, 'price', v)} />
                <TextArea label="Por qué es especial / diferente" value={item.why_special} onChange={(v) => updateItem(i, 'why_special', v)} />
                <TextArea label="Mejor ángulo de contenido para este producto" value={item.content_angle} onChange={(v) => updateItem(i, 'content_angle', v)} />
                <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-500 hover:underline">Eliminar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="rounded-md border border-dashed border-ink-300 px-4 py-2.5 text-sm text-ink-500 hover:border-ink-400 hover:text-ink-700 w-full"
      >
        + Añadir producto / plato estrella
      </button>

      <div>
        <label className="block text-sm font-medium text-ink-700">¿Qué NO comunicar?</label>
        <textarea
          value={(state.dont_promote as string[])?.join('\n') ?? ''}
          onChange={(e) => update('dont_promote', e.target.value.split('\n').filter(Boolean))}
          rows={3}
          placeholder="El menú del día, precios sin contexto… (una línea cada uno)"
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  )
}
