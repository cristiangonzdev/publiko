'use client'

import { useState } from 'react'
import { toast } from 'sonner'

const CONTENT_TYPES = [
  { value: 'reel', label: 'Reel' },
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' },
  { value: 'carrusel', label: 'Carrusel' },
] as const

interface Props {
  clientId: string
  onClose: () => void
  onCreated: (idea: Record<string, unknown>) => void
}

export function AddIdeaModal({ clientId, onClose, onCreated }: Props) {
  const [contentType, setContentType] = useState<'reel' | 'post' | 'story' | 'carrusel'>('reel')
  const [concept, setConcept] = useState('')
  const [hook, setHook] = useState('')
  const [audio, setAudio] = useState('')
  const [whyItWorks, setWhyItWorks] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const buildInput = () => {
    const parts: string[] = []
    if (concept.trim()) parts.push(`CONCEPTO: ${concept.trim()}`)
    if (hook.trim()) parts.push(`HOOK (primeros segundos): ${hook.trim()}`)
    if (audio.trim()) parts.push(`AUDIO/MÚSICA: ${audio.trim()}`)
    if (whyItWorks.trim()) parts.push(`POR QUÉ FUNCIONA: ${whyItWorks.trim()}`)
    if (referenceUrl.trim()) parts.push(`URL REFERENCIA: ${referenceUrl.trim()}`)
    return parts.join('\n')
  }

  const isValid = concept.trim().length > 0

  const submit = async () => {
    if (!isValid) return
    setLoading(true)
    try {
      const res = await fetch('/api/ideas/human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          human_input: buildInput(),
          content_type: contentType,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { idea } = await res.json() as { idea: Record<string, unknown> }
      onCreated({ ...idea, status: 'suggested', content_type: contentType, content_origin: 'human' })
      toast.success('Idea creada y añadida a "Sugeridas"')
      onClose()
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="border-b border-ink-100 px-6 py-4">
          <h2 className="text-base font-semibold text-ink-900">Añadir idea de vídeo</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Describe lo que viste. Claude lo adaptará a la marca del cliente.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Format selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">Formato</label>
            <div className="flex gap-2 flex-wrap">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setContentType(t.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    contentType === t.value
                      ? 'bg-ink-900 text-white'
                      : 'border border-ink-200 text-ink-500 hover:border-ink-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Concept — required */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-600">
              Concepto del vídeo
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">obligatorio</span>
            </label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: El dueño del restaurante muestra cómo prepara el plato del día antes de abrir. Sin hablar, planos de manos, música lofi."
              rows={3}
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Hook */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">
              Hook — primeros 2-3 segundos
              <span className="ml-1.5 text-ink-400 font-normal">(opcional)</span>
            </label>
            <input
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="Ej: Texto en pantalla 'El secreto que nadie te cuenta sobre...'"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Audio */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">
              Audio / música
              <span className="ml-1.5 text-ink-400 font-normal">(opcional)</span>
            </label>
            <input
              value={audio}
              onChange={(e) => setAudio(e.target.value)}
              placeholder="Ej: Música lofi instrumental, sin voz. O: Trending audio de TikTok."
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Why it works */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">
              ¿Por qué funcionó?
              <span className="ml-1.5 text-ink-400 font-normal">(opcional pero útil para Claude)</span>
            </label>
            <input
              value={whyItWorks}
              onChange={(e) => setWhyItWorks(e.target.value)}
              placeholder="Ej: Genera curiosidad, muy cercano, muestra el proceso real. Tuvo 200k reproducciones."
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Reference URL */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">
              URL de referencia
              <span className="ml-1.5 text-ink-400 font-normal">(opcional, guardada como referencia)</span>
            </label>
            <input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/... o https://www.tiktok.com/..."
              type="url"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <p className="mt-1 text-[11px] text-ink-400">
              Claude adapta el concepto a la marca, no copia el vídeo.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!isValid || loading}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
          >
            {loading ? 'Generando…' : '✦ Convertir en idea'}
          </button>
        </div>
      </div>
    </div>
  )
}
