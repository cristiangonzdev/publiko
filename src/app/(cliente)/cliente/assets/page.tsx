import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/getUser'
import { AssetUploader } from '@/components/cliente/AssetUploader'

export default async function ClienteAssetsPage() {
  const { user } = await getAuthUser()
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('client_user_id', user.id)
    .single()

  const { data: assets } = client
    ? await supabase
        .from('assets')
        .select('id, file_name, file_type, public_url, asset_category, created_at')
        .eq('client_id', client.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="p-4 md:p-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Portal</div>
        <h1 className="mt-1 font-serif text-3xl text-ink-900">Mis assets</h1>
        <p className="mt-1 text-sm text-ink-500">Sube fotos y vídeos propios para usar en tu contenido.</p>
      </div>

      {client && <AssetUploader clientId={client.id} />}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {!assets?.length && (
          <p className="col-span-4 py-8 text-center text-sm text-ink-400">Sin assets subidos aún.</p>
        )}
        {assets?.map((asset) => (
          <div key={asset.id} className="rounded-lg border border-ink-200 bg-white overflow-hidden">
            {asset.public_url && asset.file_type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.public_url}
                alt={asset.file_name}
                className="h-32 w-full object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center bg-ink-50 text-3xl">
                {asset.file_type.startsWith('video/') ? '🎬' : '📄'}
              </div>
            )}
            <div className="p-2">
              <p className="text-xs text-ink-700 truncate">{asset.file_name}</p>
              <p className="text-[10px] text-ink-400 mt-0.5">
                {new Date(asset.created_at).toLocaleDateString('es-ES')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
