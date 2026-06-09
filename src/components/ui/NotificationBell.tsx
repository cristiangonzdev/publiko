'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  task_id: string | null
  client_name: string | null
  created_at: string
  read_at: string | null
}

const TYPE_ICON: Record<string, string> = {
  brutos_ready:    '▶',
  deliverable_sent:'◆',
  review_rejected: '◈',
  task_assigned:   '◎',
}

const TYPE_COLOR: Record<string, string> = {
  brutos_ready:    'text-blue-600 bg-blue-50',
  deliverable_sent:'text-green-600 bg-green-50',
  review_rejected: 'text-orange-600 bg-orange-50',
  task_assigned:   'text-brand bg-brand/10',
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function NotificationBell() {
  const [open, setOpen]              = useState(false)
  const [notifs, setNotifs]          = useState<Notification[]>([])
  const [loading, setLoading]        = useState(false)
  const panelRef                     = useRef<HTMLDivElement>(null)

  const unread = notifs.filter((n) => !n.read_at).length

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const { notifications } = await res.json() as { notifications: Notification[] }
      setNotifs(notifications)
    } catch { /* silencioso */ }
  }, [])

  // Carga inicial + polling cada 60s. Se pausa cuando la pestaña está oculta
  // (no malgasta invocaciones de función/BD con tabs en segundo plano) y
  // refresca al volver a primer plano.
  useEffect(() => {
    void fetchNotifs()
    const id = setInterval(() => {
      if (!document.hidden) void fetchNotifs()
    }, 60_000)
    const onVisible = () => {
      if (!document.hidden) void fetchNotifs()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchNotifs])

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markAllRead = async () => {
    setLoading(true)
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    setLoading(false)
  }

  const handleOpen = () => {
    setOpen((v) => !v)
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Botón campana */}
      <button
        onClick={handleOpen}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          open ? 'bg-ink-100 text-ink-900' : 'text-ink-400 hover:bg-ink-50 hover:text-ink-700'
        )}
        aria-label="Notificaciones"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-white shadow-2xl z-50">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">
              Notificaciones
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                  {unread} nueva{unread > 1 ? 's' : ''}
                </span>
              )}
            </p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-[11px] text-ink-400 hover:text-brand disabled:opacity-50"
              >
                Marcar leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-ink-50">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="text-2xl text-ink-200">◎</span>
                <p className="text-sm text-ink-400">Sin notificaciones</p>
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 px-4 py-3 transition-colors',
                    !n.read_at ? 'bg-brand/5' : ''
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                    TYPE_COLOR[n.type] ?? 'text-ink-500 bg-ink-50'
                  )}>
                    {TYPE_ICON[n.type] ?? '·'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[12px] leading-snug', !n.read_at ? 'font-semibold text-ink-900' : 'font-medium text-ink-700')}>
                      {n.title}
                    </p>
                    {n.client_name && (
                      <p className="text-[10px] font-medium text-brand">{n.client_name}</p>
                    )}
                    {n.body && (
                      <p className="mt-0.5 text-[11px] text-ink-500 line-clamp-2">{n.body}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-ink-300 mt-0.5">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
