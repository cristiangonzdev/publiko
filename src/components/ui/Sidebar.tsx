'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SignOutButton } from './SignOutButton'

interface NavItem {
  href: string
  label: string
  icon: string
}

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: '⬡' },
  { href: '/admin/clients', label: 'Clientes', icon: '◈' },
  { href: '/admin/pipeline', label: 'Pipeline CRM', icon: '◫' },
  { href: '/admin/tasks', label: 'Tareas', icon: '◱' },
  { href: '/admin/ideas', label: 'Ideas', icon: '◎' },
  { href: '/admin/review', label: 'Revisión', icon: '◇' },
  { href: '/admin/reviews', label: 'Reseñas', icon: '◉' },
  { href: '/admin/calendar', label: 'Calendario', icon: '▦' },
  { href: '/admin/reports', label: 'Informes', icon: '▤' },
  { href: '/admin/invoices', label: 'Facturación', icon: '▧' },
]

const editorNav: NavItem[] = [
  { href: '/editor', label: 'Mis tareas', icon: '⬡' },
  { href: '/editor/delivered', label: 'Entregados', icon: '◈' },
]

const grabadorNav: NavItem[] = [
  { href: '/grabador', label: 'Mis tareas', icon: '⬡' },
  { href: '/grabador/history', label: 'Historial', icon: '◈' },
]

const clienteNav: NavItem[] = [
  { href: '/cliente', label: 'Mi contenido', icon: '⬡' },
  { href: '/cliente/calendario', label: 'Calendario', icon: '◎' },
  { href: '/cliente/metricas', label: 'Métricas', icon: '◇' },
  { href: '/cliente/assets', label: 'Banco de assets', icon: '◈' },
  { href: '/cliente/facturas', label: 'Facturas', icon: '▧' },
]

const navByRole: Record<string, NavItem[]> = {
  admin: adminNav,
  editor: editorNav,
  grabador: grabadorNav,
  cliente: clienteNav,
}

const labelByRole: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  grabador: 'Grabador',
  cliente: 'Portal',
}

interface SidebarProps {
  role: string
  email: string
}

export function Sidebar({ role, email }: SidebarProps) {
  const pathname = usePathname()
  const nav = navByRole[role] ?? adminNav
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  const navList = (
    <nav className="flex-1 overflow-y-auto py-3">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm transition-colors lg:py-2',
              active
                ? 'bg-ink-50 font-medium text-ink-900'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const header = (
    <div className="flex h-14 items-center border-b border-ink-200 px-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-brand">Agency OS</span>
      <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
        {labelByRole[role]}
      </span>
    </div>
  )

  const footer = (
    <div className="border-t border-ink-200 p-4">
      <p className="truncate text-xs text-ink-500">{email}</p>
      <div className="mt-2">
        <SignOutButton />
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-ink-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
          className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-700 hover:bg-ink-50 active:bg-ink-100"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand">Agency OS</span>
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
            {labelByRole[role]}
          </span>
        </div>
        <div className="w-10" aria-hidden />
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-ink-200 px-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-brand">Agency OS</span>
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
                  {labelByRole[role]}
                </span>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
                className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-500 hover:bg-ink-50 active:bg-ink-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {navList}
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-56 flex-col border-r border-ink-200 bg-white lg:flex">
        {header}
        {navList}
        {footer}
      </aside>
    </>
  )
}
