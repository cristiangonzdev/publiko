import { logError } from '@/lib/observability'

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function send(chatId: string, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return
  try {
    const res = await fetch(`${BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      // El canal de alertas no debe romper el flujo principal, pero el fallo
      // sí se registra (antes se tragaba en silencio).
      logError('telegram.send', new Error(`Telegram ${res.status}: ${await res.text().catch(() => '')}`))
    }
  } catch (err) {
    logError('telegram.send', err)
  }
}

export async function notifyAdmin(text: string) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!chatId) return
  await send(chatId, text)
}

export async function notifyUser(telegramChatId: string | null, text: string) {
  if (!telegramChatId) return
  await send(telegramChatId, text)
}

export const TG = {
  brutosPendientes: (businessName: string, concept: string, deadline: string | null) =>
    `📹 <b>Nueva tarea de grabación</b>\n\nCliente: ${businessName}\nConcepto: ${concept}${deadline ? `\nDeadline: ${deadline}` : ''}`,

  brutosListos: (businessName: string, concept: string) =>
    `✅ <b>Brutos listos</b>\n\nCliente: ${businessName}\nConcepto: ${concept}\n\nYa puedes empezar la edición.`,

  entregadoAdmin: (businessName: string, concept: string) =>
    `🎬 <b>Entregable listo para revisión</b>\n\nCliente: ${businessName}\nConcepto: ${concept}`,

  publicado: (businessName: string, concept: string) =>
    `✅ <b>Publicado</b>\n\n${businessName} — ${concept}`,

  falloPub: (businessName: string, concept: string, reason: string) =>
    `❌ <b>FALLO publicación</b>\n\n${businessName} — ${concept}\nError: ${reason}`,

  reintento: (businessName: string, concept: string, attempt: number, nextInMin: number, reason: string) =>
    `⚠️ <b>Publicación falló (intento ${attempt}/3)</b>\n\n${businessName} — ${concept}\nError: ${reason}\nReintento en ${nextInMin} min`,

  falloDefinitivo: (businessName: string, concept: string, reason: string, postUrl?: string) =>
    `🚨 <b>PUBLICACIÓN ABORTADA tras 3 intentos</b>\n\n${businessName} — ${concept}\nError: ${reason}${postUrl ? `\n\n${postUrl}` : ''}\n\nRequiere intervención manual.`,
}
