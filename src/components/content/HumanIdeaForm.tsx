'use client'

import { useState } from 'react'

interface Props {
  clients: Array<{ id: string; business_name: string }>
}

export function HumanIdeaForm({ clients }: Props) {
  const [clientId, setClientId] = useState('')
  const [humanInput, setHumanInput] = useState('')
  const [contentType, setContentType] = useState<'reel' | 'post' | 'story' | 'carrusel'>('reel')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ concept: string; full_description: string; id: string } | null>(null)

  const submit = async () => {
    if (!clientId || !humanInput.trim()) {
      alert('Selecciona un cliente y escribe la idea')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ideas/human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, human_input: humanInput, content_type: contentType }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { idea: { id: string; concept: string; full_description: string } }
      setResult(data.idea)
      setHumanInput('')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-1.5">Cliente</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        >
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.business_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700 mb-1.5">Formato sugerido</label>
        <div className="flex gap-2">
          {(['reel', 'post', 'story', 'carrusel'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setContentType(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                contentType === type
                  ? 'bg-ink-900 text-white'
                  : 'border border-ink-200 text-ink-600 hover:border-ink-400'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-700 mb-1.5">
          La idea en bruto
        </label>
        <textarea
          rows={6}
          value={humanInput}
          onChange={(e) => setHumanInput(e.target.value)}
          placeholder={`Escribe la historia, el ángulo o la idea tal como la tienes en mente.\n\nEjemplo: "Kenny me contó que abrió el restaurante en pandemia cuando todo el mundo le dijo que estaba loco. Tres semanas después tenía lista de espera."`}
          className="w-full rounded-lg border border-ink-200 px-4 py-3 text-sm text-ink-700 placeholder-ink-300 focus:border-brand focus:outline-none resize-none"
        />
        <p className="mt-1 text-xs text-ink-400">La IA usará esto junto al Brand Brain para generar un guión estructurado.</p>
      </div>

      <button
        onClick={submit}
        disabled={loading || !clientId || !humanInput.trim()}
        className="w-full rounded-md bg-brand py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '✦ Generando idea…' : '✦ Generar idea estructurada'}
      </button>

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Idea generada</p>
            <span className="text-[10px] text-green-500">Guardada en ideas pendientes ✓</span>
          </div>
          <h3 className="mt-2 font-medium text-ink-900">{result.concept}</h3>
          <p className="mt-2 text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">{result.full_description}</p>
        </div>
      )}
    </div>
  )
}
