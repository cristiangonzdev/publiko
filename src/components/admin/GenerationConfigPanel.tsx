'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface DailyGenerationConfig {
  reels_per_day?: number
  posts_per_day?: number
  stories_per_day?: number
  carrusels_per_day?: number
  auto_tier_content_types?: string[]
  publish_hours?: string[]
  platforms?: string[]
}

interface Props {
  clientId: string
  initialConfig: DailyGenerationConfig
}

const CONTENT_TYPES = [
  { key: 'story', label: 'Stories' },
  { key: 'post', label: 'Posts' },
  { key: 'reel', label: 'Reels' },
  { key: 'carrusel', label: 'Carruseles' },
]

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'gmb']

const DEFAULT_HOURS = ['09:00', '14:00', '20:00']

export function GenerationConfigPanel({ clientId, initialConfig }: Props) {
  const [config, setConfig] = useState<DailyGenerationConfig>({
    reels_per_day: initialConfig.reels_per_day ?? 0,
    posts_per_day: initialConfig.posts_per_day ?? 0,
    stories_per_day: initialConfig.stories_per_day ?? 0,
    carrusels_per_day: initialConfig.carrusels_per_day ?? 0,
    auto_tier_content_types: initialConfig.auto_tier_content_types ?? ['story'],
    publish_hours: initialConfig.publish_hours ?? DEFAULT_HOURS,
    platforms: initialConfig.platforms ?? ['instagram'],
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [hoursDraft, setHoursDraft] = useState(config.publish_hours?.join(', ') ?? '')

  const total =
    (config.reels_per_day ?? 0) +
    (config.posts_per_day ?? 0) +
    (config.stories_per_day ?? 0) +
    (config.carrusels_per_day ?? 0)

  const updateNum = (key: keyof DailyGenerationConfig, value: number) => {
    setConfig({ ...config, [key]: Math.max(0, value) })
  }

  const toggleAuto = (type: string) => {
    const current = config.auto_tier_content_types ?? []
    setConfig({
      ...config,
      auto_tier_content_types: current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type],
    })
  }

  const togglePlatform = (p: string) => {
    const current = config.platforms ?? []
    setConfig({
      ...config,
      platforms: current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const hours = hoursDraft
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^\d{2}:\d{2}$/.test(s))

      const finalConfig = {
        ...config,
        publish_hours: hours.length > 0 ? hours : DEFAULT_HOURS,
      }

      const res = await fetch(`/api/clients/${clientId}/generation-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalConfig),
      })
      if (!res.ok) throw new Error(await res.text())
      setConfig(finalConfig)
      setSavedAt(new Date())
    } catch (err) {
      alert(`Error guardando: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Generación diaria</h2>
          <p className="mt-0.5 text-[11px] text-ink-400">
            El cron diario produce este volumen para este cliente. Las piezas marcadas como auto se publican sin tu OK si el AI judge las aprueba.
          </p>
        </div>
        <span className={cn(
          'rounded-full px-2.5 py-0.5 text-[10px] font-medium',
          total > 0 ? 'bg-green-50 text-green-700' : 'bg-ink-100 text-ink-500'
        )}>
          {total > 0 ? `${total} piezas/día` : 'desactivado'}
        </span>
      </div>

      <div className="space-y-5 p-5">
        {/* Counts */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'reels_per_day' as const, label: 'Reels' },
            { key: 'posts_per_day' as const, label: 'Posts' },
            { key: 'stories_per_day' as const, label: 'Stories' },
            { key: 'carrusels_per_day' as const, label: 'Carruseles' },
          ].map((c) => (
            <label key={c.key} className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-500">{c.label}/día</span>
              <input
                type="number"
                min={0}
                max={30}
                value={config[c.key] ?? 0}
                onChange={(e) => updateNum(c.key, parseInt(e.target.value) || 0)}
                className="w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </label>
          ))}
        </div>

        {/* Auto tier */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-ink-500">Tipos que auto-publican (si AI judge OK)</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_TYPES.map((t) => {
              const active = (config.auto_tier_content_types ?? []).includes(t.key)
              return (
                <button
                  key={t.key}
                  onClick={() => toggleAuto(t.key)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    active ? 'bg-green-600 text-white' : 'border border-ink-200 text-ink-500 hover:border-green-400'
                  )}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-ink-400">El resto te llega para aprobar manualmente. Aun en tipos auto, contenido sensible va a manual por seguridad del AI judge.</p>
        </div>

        {/* Platforms */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-ink-500">Plataformas</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => {
              const active = (config.platforms ?? []).includes(p)
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize',
                    active ? 'bg-ink-900 text-white' : 'border border-ink-200 text-ink-500 hover:border-ink-400'
                  )}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        {/* Publish hours */}
        <div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-500">Horas de publicación (HH:MM separadas por comas)</span>
            <input
              type="text"
              value={hoursDraft}
              onChange={(e) => setHoursDraft(e.target.value)}
              placeholder="09:00, 14:00, 20:00"
              className="w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <p className="mt-1.5 text-[10px] text-ink-400">El AI distribuye las piezas del día entre estas horas.</p>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between border-t border-ink-100 pt-4">
          <p className="text-[11px] text-ink-400">
            {savedAt ? `Guardado a las ${savedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Cambios sin guardar'}
          </p>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </div>
    </section>
  )
}
