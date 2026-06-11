import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Bootstrap de instalaciones limpias: solo aparece si organizations está
 * vacía. En prod nunca se ejecuta (la migration 0018 hace seed de la org
 * "Logika Digital" y backfillea todos los datos existentes a ella).
 */
async function createFirstOrganization(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = await createServiceClient()
  const { count } = await svc.from('organizations').select('id', { count: 'exact', head: true })
  if ((count ?? 0) > 0) redirect('/')

  const name = ((formData.get('name') as string | null)?.trim()) || 'Logika Digital'
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const { data: org, error } = await svc
    .from('organizations')
    .insert({ name, slug })
    .select('id')
    .single()
  if (error || !org) redirect('/setup?error=true')

  // El usuario que hace el setup queda como admin y owner de la org.
  await svc
    .from('profiles')
    .update({ organization_id: org.id, role: 'admin', is_owner: true, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  redirect('/admin')
}

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function SetupPage({ searchParams }: Props) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = await createServiceClient()
  const { count } = await svc.from('organizations').select('id', { count: 'exact', head: true })
  if ((count ?? 0) > 0) redirect('/')

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Configuración inicial</div>
        <h1 className="mt-1 font-serif text-2xl text-ink-900">Crea tu organización</h1>
        <p className="mt-2 text-sm text-ink-500">
          No hay ninguna organización todavía. Crea la primera: tu usuario quedará como administrador y propietario.
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error al crear la organización. Comprueba que el nombre no esté duplicado.
          </div>
        )}

        <form action={createFirstOrganization} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700">Nombre de la organización</label>
            <input
              name="name"
              defaultValue="Logika Digital"
              required
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
          >
            Crear organización →
          </button>
        </form>
      </div>
    </div>
  )
}
