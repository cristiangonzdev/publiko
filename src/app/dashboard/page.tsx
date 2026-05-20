import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth/getUser'

const roleDestination: Record<string, string> = {
  admin: '/admin',
  editor: '/editor',
  grabador: '/grabador',
  cliente: '/cliente',
}

export default async function DashboardPage() {
  const { role } = await getAuthUser()
  redirect(roleDestination[role] ?? '/admin')
}
