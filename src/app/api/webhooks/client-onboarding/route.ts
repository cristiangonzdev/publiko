import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClientFolder } from '@/lib/drive'
import { notifyAdmin } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { client_id } = await request.json() as { client_id: string }
  const supabase = await createServiceClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, drive_folder_id')
    .eq('id', client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  if (!client.drive_folder_id && process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      const folderId = await createClientFolder(client.business_name)
      await supabase
        .from('clients')
        .update({ drive_folder_id: folderId, updated_at: new Date().toISOString() })
        .eq('id', client_id)

      await notifyAdmin(
        `🆕 <b>Onboarding completado</b>\n\n${client.business_name}\nCarpeta Drive creada ✅`,
      )
    } catch {
      await notifyAdmin(
        `🆕 <b>Onboarding completado</b>\n\n${client.business_name}\n⚠️ Error creando carpeta Drive`,
      )
    }
  } else {
    await notifyAdmin(
      `🆕 <b>Onboarding completado</b>\n\n${client.business_name}`,
    )
  }

  return NextResponse.json({ ok: true })
}
