import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'

export default async function ClientePage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, current_followers')
    .eq('client_user_id', user.id)
    .single()

  const { data: posts } = client
    ? await supabase
        .from('posts')
        .select('id, copy, platform, status, published_at, scheduled_at')
        .eq('client_id', client.id)
        .order('scheduled_at', { ascending: false })
        .limit(10)
    : { data: [] }

  return (
    <div className="p-8">
      <h1 className="font-serif text-3xl text-ink-900">
        {client?.business_name ?? 'Mi contenido'}
      </h1>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Instagram', value: (client?.current_followers as Record<string, number>)?.instagram ?? '—' },
          { label: 'Facebook', value: (client?.current_followers as Record<string, number>)?.facebook ?? '—' },
          { label: 'TikTok', value: (client?.current_followers as Record<string, number>)?.tiktok ?? '—' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-ink-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{s.label}</p>
            <p className="mt-1 font-serif text-2xl text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Contenido reciente</h2>
        <div className="mt-4 space-y-3">
          {!posts?.length && <p className="text-sm text-ink-400">Sin publicaciones aún.</p>}
          {posts?.map((post) => (
            <div key={post.id} className="rounded-lg border border-ink-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-500 uppercase">{post.platform}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  post.status === 'published' ? 'bg-green-50 text-green-700' :
                  post.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : 'bg-ink-100 text-ink-500'
                }`}>{post.status}</span>
              </div>
              <p className="mt-2 text-sm text-ink-700 line-clamp-2">{post.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
