'use client'

import { useState } from 'react'

type UserRole = 'admin' | 'editor' | 'grabador' | 'cliente'

interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

interface Props {
  initialUsers: Profile[]
}

const roleBadge: Record<UserRole, string> = {
  admin:    'bg-purple-50 text-purple-700',
  editor:   'bg-blue-50 text-blue-700',
  grabador: 'bg-orange-50 text-orange-700',
  cliente:  'bg-green-50 text-green-700',
}

export function UsersManager({ initialUsers }: Props) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', role: 'editor' as UserRole })
  const [creating, setCreating] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const data = await res.json() as { ok?: boolean; password?: string; userId?: string; error?: string }
    if (data.ok && data.password && data.userId) {
      setTempPassword(data.password)
      setUsers(prev => [{
        id: data.userId!,
        full_name: createForm.full_name,
        email: createForm.email,
        role: createForm.role,
        is_active: true,
        created_at: new Date().toISOString(),
      }, ...prev])
      setCreateForm({ full_name: '', email: '', role: 'editor' })
    } else {
      setCreateError(data.error ?? 'Error al crear el usuario.')
    }
    setCreating(false)
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }

  async function handleToggleActive(userId: string, currentActive: boolean) {
    const method = currentActive ? 'DELETE' : 'PATCH'
    const body = currentActive ? undefined : JSON.stringify({ is_active: true })
    const res = await fetch(`/api/users/${userId}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink-900">Usuarios</h1>
        <button
          onClick={() => { setShowCreate(true); setTempPassword(null) }}
          className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
        >
          + Invitar usuario
        </button>
      </div>

      {/* Modal crear usuario */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {tempPassword ? (
              <div>
                <h2 className="font-serif text-xl text-ink-900">Usuario creado</h2>
                <p className="mt-2 text-sm text-ink-600">
                  Comparte estas credenciales con el nuevo usuario. La contraseña no se puede recuperar después.
                </p>
                <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-4 font-mono text-sm">
                  <p className="text-ink-500">Email: <span className="text-ink-900">{createForm.email || users[0]?.email}</span></p>
                  <p className="mt-1 text-ink-500">Contraseña: <span className="text-ink-900 font-semibold">{tempPassword}</span></p>
                </div>
                <button
                  onClick={() => { setShowCreate(false); setTempPassword(null) }}
                  className="mt-4 w-full rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
                >
                  Listo, ya la he copiado
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl text-ink-900">Nuevo usuario</h2>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-ink-400 hover:text-ink-700">✕</button>
                </div>
                <div className="mt-4 space-y-4">
                  {[
                    { name: 'full_name', label: 'Nombre completo', type: 'text' },
                    { name: 'email', label: 'Email', type: 'email' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-sm font-medium text-ink-700">{f.label}</label>
                      <input
                        type={f.type}
                        required
                        value={createForm[f.name as 'full_name' | 'email']}
                        onChange={e => setCreateForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-ink-700">Rol</label>
                    <select
                      value={createForm.role}
                      onChange={e => setCreateForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                      className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="editor">Editor</option>
                      <option value="grabador">Grabador</option>
                      <option value="cliente">Cliente (portal)</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {createError && (
                    <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="mt-5 w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
                >
                  {creating ? 'Creando…' : 'Crear usuario'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="mt-8 overflow-hidden rounded-lg border border-ink-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              {['Nombre', 'Email', 'Rol', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!users.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">Sin usuarios.</td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.id} className={u.is_active ? 'hover:bg-ink-50' : 'bg-ink-50 opacity-60'}>
                <td className="px-4 py-3 font-medium text-ink-900">{u.full_name}</td>
                <td className="px-4 py-3 text-ink-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer ${roleBadge[u.role]}`}
                  >
                    <option value="admin">admin</option>
                    <option value="editor">editor</option>
                    <option value="grabador">grabador</option>
                    <option value="cliente">cliente</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-ink-400'}`}>
                    {u.is_active ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(u.id, u.is_active)}
                    className={`text-xs hover:underline ${u.is_active ? 'text-red-500' : 'text-green-600'}`}
                  >
                    {u.is_active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
