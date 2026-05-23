'use client'

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
  { href: '/admin/atascado', label: 'Atascado', icon: '⚠' },
  { href: '/admin/users', label: 'Usuarios', icon: '◑' },
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

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-ink-200 bg-white">
      <div className="flex h-14 items-center border-b border-ink-200 px-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand">Agency OS</span>
        <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
          {labelByRole[role]}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-ink-50 font-medium text-ink-900'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-ink-200 p-4">
        <p className="truncate text-xs text-ink-500">{email}</p>
        <div className="mt-2">
          <SignOutButton />
        </div>
      </div>
    </aside>
  )
}
