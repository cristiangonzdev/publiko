const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function send(chatId: string, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => null)
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
}
