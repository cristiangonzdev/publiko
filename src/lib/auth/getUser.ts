import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  return {
    user,
    role: (profile?.role ?? 'cliente') as 'admin' | 'editor' | 'grabador' | 'cliente',
    fullName: profile?.full_name ?? user.email ?? '',
    email: profile?.email ?? user.email ?? '',
  }
}
