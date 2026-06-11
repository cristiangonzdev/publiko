import { createClient } from '@/lib/supabase/server'
import { UsersManager } from '@/components/admin/UsersManager'

export default async function UsersPage() {
  // createClient (anon + RLS): las policies multi-org devuelven solo los
  // profiles de la organización del admin.
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-8">
      <UsersManager initialUsers={users ?? []} />
    </div>
  )
}
