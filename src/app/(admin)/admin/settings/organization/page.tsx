import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthContext, orgMismatch } from '@/lib/auth/guards'
import { UsersManager } from '@/components/admin/UsersManager'

async function updateOrganization(formData: FormData) {
  'use server'
  const ctx = await getAuthContext()
  if (!ctx || ctx.role !== 'admin' || !ctx.organizationId) throw new Error('No autorizado')

  const orgId = formData.get('org_id') as string
  if (orgMismatch(ctx, orgId)) throw new Error('No autorizado')

  const name = ((formData.get('name') as string | null)?.trim()) ?? ''
  const slug = ((formData.get('slug') as string | null)?.trim() ?? '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (!name || !slug) redirect('/admin/settings/organization?error=required')

  const svc = await createServiceClient()
  const { error } = await svc
    .from('organizations')
    .update({ name, slug })
    .eq('id', ctx.organizationId)

  if (error) redirect('/admin/settings/organization?error=save')
  redirect('/admin/settings/organization?saved=true')
}

interface Props {
  searchParams: Promise<{ error?: string; saved?: string }>
}

const inputClass =
  'mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

export default async function OrganizationSettingsPage({ searchParams }: Props) {
  const { error, saved } = await searchParams

  // createClient (anon + RLS): la org y los miembros llegan ya filtrados
  // por las policies multi-org.
  const supabase = await createClient()
  const [{ data: org }, { data: members }] = await Promise.all([
    supabase.from('organizations').select('id, name, slug, plan, created_at').limit(1).maybeSingle(),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .order('created_at', { ascending: false }),
  ])

  if (!org) redirect('/setup')

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="font-serif text-3xl text-ink-900">Organización</h1>
      <p className="mt-1 text-sm text-ink-500">
        Nombre, identidad y miembros de tu organización. Cada organización está completamente aislada de las demás.
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error === 'required' ? 'El nombre y el slug son obligatorios.' : 'Error al guardar. Comprueba que el slug no esté duplicado.'}
        </div>
      )}
      {saved && (
        <div className="mt-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Organización actualizada.
        </div>
      )}

      <form action={updateOrganization} className="mt-8 rounded-xl border border-ink-200 bg-white p-5">
        <input type="hidden" name="org_id" value={org.id} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink-700">Nombre *</label>
            <input name="name" required defaultValue={org.name} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700">Slug *</label>
            <input name="slug" required defaultValue={org.slug} className={inputClass} />
            <p className="mt-1 text-[11px] text-ink-400">Identificador único, solo minúsculas y guiones</p>
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
        >
          Guardar
        </button>
      </form>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-ink-900">Miembros</h2>
        <p className="mt-1 text-sm text-ink-500">
          Al invitar a un miembro se genera una contraseña temporal que debes hacerle llegar. Queda asignado a esta organización automáticamente.
        </p>
        <UsersManager initialUsers={members ?? []} />
      </section>
    </div>
  )
}
