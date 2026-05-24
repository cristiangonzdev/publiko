'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SignOutButton } from './SignOutButton'
import { NotificationBell } from './NotificationBell'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  alert?: boolean
}

// Iconos SVG inline — consistentes, sin emoji
function IconDashboard()  { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IconClients()    { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m0 0a4 4 0 118 0m-8 0A4 4 0 019 12a4 4 0 014 4"/></svg> }
function IconPipeline()   { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18"/></svg> }
function IconTasks()      { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> }
function IconIdeas()      { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg> }
function IconReview()     { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> }
function IconStar()       { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg> }
function IconCalendar()   { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function IconChart()      { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> }
function IconInvoice()    { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg> }
function IconAlert()      { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> }
function IconUsers()      { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg> }
function IconKanban()     { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="5" height="14" rx="1"/><rect x="10" y="3" width="5" height="9" rx="1"/><rect x="17" y="3" width="5" height="11" rx="1"/></svg> }
function IconHistory()    { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> }
function IconMetrics()    { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-8-5v5M8 3v1m8-1v1M4 20h16"/></svg> }
function IconAssets()     { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> }
function IconContent()    { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4"/></svg> }

const adminNav: NavItem[] = [
  { href: '/admin',           label: 'Dashboard',           icon: <IconDashboard /> },
  { href: '/admin/clients',   label: 'Clientes',            icon: <IconClients /> },
  { href: '/admin/pipeline',  label: 'Pipeline CRM',        icon: <IconPipeline /> },
  { href: '/admin/tasks',     label: 'Tareas',              icon: <IconTasks /> },
  { href: '/admin/ideas',     label: 'Ideas',               icon: <IconIdeas /> },
  { href: '/admin/review',    label: 'Revisión contenido',  icon: <IconReview /> },
  { href: '/admin/reviews',   label: 'Reseñas Google',      icon: <IconStar /> },
  { href: '/admin/calendar',  label: 'Calendario',          icon: <IconCalendar /> },
  { href: '/admin/reports',   label: 'Informes',            icon: <IconChart /> },
  { href: '/admin/invoices',  label: 'Facturación',         icon: <IconInvoice /> },
  { href: '/admin/atascado',  label: 'Atascado',            icon: <IconAlert />, alert: true },
  { href: '/admin/users',     label: 'Equipo',              icon: <IconUsers /> },
]

const editorNav: NavItem[] = [
  { href: '/editor',            label: 'Mis tareas',    icon: <IconKanban /> },
  { href: '/editor/calendario', label: 'Calendario',    icon: <IconCalendar /> },
  { href: '/editor/delivered',  label: 'Entregados',    icon: <IconHistory /> },
]

const grabadorNav: NavItem[] = [
  { href: '/grabador',            label: 'Mis grabaciones', icon: <IconTasks /> },
  { href: '/grabador/calendario', label: 'Calendario',      icon: <IconCalendar /> },
  { href: '/grabador/history',    label: 'Historial',       icon: <IconHistory /> },
]

const clienteNav: NavItem[] = [
  { href: '/cliente',            label: 'Mi contenido',   icon: <IconContent /> },
  { href: '/cliente/calendario', label: 'Calendario',     icon: <IconCalendar /> },
  { href: '/cliente/metricas',   label: 'Métricas',       icon: <IconMetrics /> },
  { href: '/cliente/assets',     label: 'Banco de assets',icon: <IconAssets /> },
  { href: '/cliente/facturas',   label: 'Facturas',       icon: <IconInvoice /> },
]

const navByRole: Record<string, NavItem[]> = {
  admin:    adminNav,
  editor:   editorNav,
  grabador: grabadorNav,
  cliente:  clienteNav,
}

const roleMeta: Record<string, { label: string; dot: string }> = {
  admin:    { label: 'Admin',    dot: 'bg-brand' },
  editor:   { label: 'Editor',   dot: 'bg-violet-500' },
  grabador: { label: 'Grabador', dot: 'bg-amber-500' },
  cliente:  { label: 'Portal',   dot: 'bg-emerald-500' },
}

interface SidebarProps {
  role: string
  email: string
}

export function Sidebar({ role, email }: SidebarProps) {
  const pathname = usePathname()
  const nav      = navByRole[role] ?? adminNav
  const meta     = roleMeta[role] ?? roleMeta.admin

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-ink-200 bg-white">
      {/* Header */}
      <div className="flex h-14 items-center gap-2.5 border-b border-ink-200 px-4">
        <span className="text-xs font-bold uppercase tracking-widest text-brand">Agency OS</span>
        <span className="flex items-center gap-1 rounded-md bg-ink-50 px-2 py-0.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
          <span className="text-[10px] font-semibold text-ink-500">{meta.label}</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {nav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-ink-900 text-white font-medium'
                  : item.alert
                  ? 'text-red-500 hover:bg-red-50 hover:text-red-600'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
              )}
            >
              <span className={cn('flex-shrink-0', isActive ? 'text-white' : '')}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-ink-200 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-ink-400">{email}</p>
          </div>
          {role !== 'cliente' && <NotificationBell />}
        </div>
        <SignOutButton />
      </div>
    </aside>
  )
}
