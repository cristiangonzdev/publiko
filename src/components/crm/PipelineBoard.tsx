'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'border-ink-200 bg-ink-50' },
  { key: 'proposal_sent', label: 'Propuesta', color: 'border-blue-200 bg-blue-50' },
  { key: 'negotiation', label: 'Negociación', color: 'border-yellow-200 bg-yellow-50' },
  { key: 'active', label: 'Activo', color: 'border-green-200 bg-green-50' },
  { key: 'paused', label: 'Pausado', color: 'border-orange-200 bg-orange-50' },
] as const

interface Client {
  id: string
  business_name: string
  status: string
  monthly_fee: number
  contact_name: string
  pipeline_notes: string | null
  updated_at: string
}

interface Props {
  initialClients: Client[]
}

export function PipelineBoard({ initialClients }: Props) {
  const [clients, setClients] = useState(initialClients)
  const [dragging, setDragging] = useState<string | null>(null)

  const moveClient = async (clientId: string, newStatus: string) => {
    setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, status: newStatus } : c))
    await fetch(`/api/clients/${clientId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  const handleDrop = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault()
    if (dragging) moveClient(dragging, stageKey)
    setDragging(null)
  }

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-6 sm:mx-0 sm:gap-4 sm:px-0">
      {STAGES.map((stage) => {
        const stageClients = clients.filter((c) => c.status === stage.key)
        const stageMRR = stageClients.reduce((sum, c) => sum + (c.monthly_fee ?? 0), 0)
        return (
          <div
            key={stage.key}
            className="w-[240px] flex-shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, stage.key)}
          >
            <div className={cn('mb-3 rounded-t-md border-b-2 px-3 py-2', stage.color)}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-700">{stage.label}</span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-ink-500">
                  {stageClients.length}
                </span>
              </div>
              {stageMRR > 0 && (
                <p className="mt-0.5 text-[10px] text-ink-500">{stageMRR.toLocaleString('es-ES')} €/mes</p>
              )}
            </div>

            <div className="space-y-2">
              {stageClients.map((client) => (
                <div
                  key={client.id}
                  draggable
                  onDragStart={() => setDragging(client.id)}
                  onDragEnd={() => setDragging(null)}
                  className={cn(
                    'cursor-grab rounded-lg border border-ink-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow',
                    dragging === client.id && 'opacity-50'
                  )}
                >
                  <Link href={`/admin/clients/${client.id}`} className="block">
                    <p className="text-sm font-medium text-ink-900 hover:text-brand">{client.business_name}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">{client.contact_name}</p>
                    {client.monthly_fee > 0 && (
                      <p className="mt-1 text-xs font-medium text-green-600">{client.monthly_fee.toLocaleString('es-ES')} €/mes</p>
                    )}
                    {client.pipeline_notes && (
                      <p className="mt-1.5 text-[11px] text-ink-400 line-clamp-2 italic">{client.pipeline_notes}</p>
                    )}
                  </Link>
                  <div className="mt-2 flex gap-1">
                    {STAGES.filter((s) => s.key !== stage.key).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => moveClient(client.id, s.key)}
                        title={`Mover a ${s.label}`}
                        className="flex-1 rounded bg-ink-50 py-0.5 text-[9px] text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {stageClients.length === 0 && (
                <div className="rounded-lg border border-dashed border-ink-200 py-6 text-center text-[11px] text-ink-300">
                  Sin clientes
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
