import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/ui/Sidebar'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function GrabadorLayout({ children }: { children: React.ReactNode }) {
  const { role, email } = await getAuthUser()
  if (role !== 'grabador' && role !== 'admin') redirect('/dashboard')

  return (
    <div className="flex h-screen bg-ink-50">
      <Sidebar role="grabador" email={email} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
