import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/ui/Sidebar'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, email } = await getAuthUser()
  if (role !== 'admin') redirect('/dashboard')

  return (
    <div className="flex h-screen bg-ink-50">
      <Sidebar role="admin" email={email} />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
