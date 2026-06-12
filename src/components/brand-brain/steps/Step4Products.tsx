'use client'

import { useState } from 'react'
import { TextInput, TextArea } from '../FormFields'
import type { StepProps } from './Step1Identity'

interface HeroItem { name: string; description: string; price: string; why_special: string; content_angle: string }
const emptyItem = (): HeroItem => ({ name: '', description: '', price: '', why_special: '', content_angle: '' })

export function Step4Products({ data, update, preset }: StepProps) {
  const [openItem, setOpenItem] = useState<number | null>(null)

  const items: HeroItem[] = (data.hero_items as HeroItem[]) ?? []
  const updateItem = (i: number, key: keyof HeroItem, val: string) => {
    const updated = items.map((item, idx) => idx === i ? { ...item, [key]: val } : item)
    update('hero_items', updated)
  }
  const addItem = () => { update('hero_items', [...items, emptyItem()]); setOpenItem(items.length) }
  const removeItem = (i: number) => { update('hero_items', items.filter((_, idx) => idx !== i)); setOpenItem(null) }

  const itemNounCapitalized = preset.itemNoun.charAt(0).toUpperCase() + preset.itemNoun.slice(1)

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl text-ink-900">4. {preset.productsTitle}</h2>
      <p className="text-sm text-ink-500">{preset.productsHint}</p>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-md border border-ink-200">
            <button
              type="button"
              onClick={() => setOpenItem(openItem === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink-800"
            >
              <span>{item.name || `${itemNounCapitalized} ${i + 1}`}</span>
              <span className="text-ink-400">{openItem === i ? '▲' : '▼'}</span>
            </button>
            {openItem === i && (
              <div className="space-y-3 border-t border-ink-100 px-4 pb-4 pt-3">
                <TextInput label="Nombre" value={item.name} onChange={(v) => updateItem(i, 'name', v)} />
                <TextArea label="Descripción para copy" value={item.description} onChange={(v) => updateItem(i, 'description', v)} />
                <TextInput label="Precio (opcional)" placeholder={preset.itemPricePlaceholder} value={item.price} onChange={(v) => updateItem(i, 'price', v)} />
                <TextArea label="Por qué es especial / diferente" value={item.why_special} onChange={(v) => updateItem(i, 'why_special', v)} />
                <TextArea label="Mejor ángulo de contenido" value={item.content_angle} onChange={(v) => updateItem(i, 'content_angle', v)} />
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
        {preset.addItemLabel}
      </button>

      <div>
        <label className="block text-sm font-medium text-ink-700">¿Qué NO comunicar?</label>
        <textarea
          value={(data.dont_promote as string[])?.join('\n') ?? ''}
          onChange={(e) => update('dont_promote', e.target.value.split('\n').filter(Boolean))}
          rows={3}
          placeholder={preset.dontPromotePlaceholder}
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  )
}
