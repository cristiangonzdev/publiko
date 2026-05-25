import { createServiceClient } from '@/lib/supabase/server'
import { UsersManager } from '@/components/admin/UsersManager'

export default async function UsersPage() {
  const supabase = await createServiceClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <UsersManager initialUsers={users ?? []} />
    </div>
  )
}
