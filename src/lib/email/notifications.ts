import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
}

function fromAddress() {
  return process.env.RESEND_FROM ?? 'hola@agencyos.app'
}

interface BaseTemplate {
  preheader?: string
  title: string
  intro: string
  cta?: { label: string; url: string }
  signature?: string
}

function renderEmail(t: BaseTemplate): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(t.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:Georgia,serif;color:#1a1a1a;">
  ${t.preheader ? `<span style="display:none;font-size:1px;color:#f5f5f4;">${escapeHtml(t.preheader)}</span>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <h1 style="margin:0 0 16px;font-weight:normal;font-size:24px;color:#1a1a1a;">${escapeHtml(t.title)}</h1>
          <p style="margin:0 0 20px;line-height:1.7;color:#444444;font-size:15px;">${t.intro}</p>
          ${t.cta ? `
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr><td style="background:#1a1a1a;border-radius:6px;">
                <a href="${escapeAttr(t.cta.url)}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">${escapeHtml(t.cta.label)}</a>
              </td></tr>
            </table>
          ` : ''}
          ${t.signature ? `<p style="margin:32px 0 0;color:#666666;font-size:13px;line-height:1.6;">${t.signature}</p>` : ''}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#999999;">
        Publiko · agencia de redes sociales
      </p>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
  )
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}

interface SendArgs {
  to: string
  subject: string
  template: BaseTemplate
  /** Adjuntos (content en base64). */
  attachments?: { filename: string; content: string }[]
}

export async function sendClientEmail(args: SendArgs): Promise<{ id?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY no configurado, skip envío')
    return { error: 'no-api-key' }
  }
  try {
    const result = await getResend().emails.send({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      html: renderEmail(args.template),
      ...(args.attachments?.length ? { attachments: args.attachments } : {}),
    })
    return { id: result.data?.id }
  } catch (err) {
    console.error('[email] envío falló', err)
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ============================================================================
// Casos específicos
// ============================================================================

export function notifyClientNewWeeklyContent(args: {
  to: string
  businessName: string
  ideaCount: number
  portalUrl: string
}) {
  return sendClientEmail({
    to: args.to,
    subject: `Nuevo plan semanal listo — ${args.businessName}`,
    template: {
      preheader: `${args.ideaCount} ideas nuevas en tu calendario.`,
      title: `Tu plan de la semana está listo`,
      intro: `Hemos preparado <strong>${args.ideaCount} ideas nuevas</strong> para ${escapeHtml(args.businessName)}.<br><br>Échales un vistazo en tu portal — si alguna necesita tu input (una historia, una anécdota, una foto), te avisaremos.`,
      cta: { label: 'Ver en mi portal →', url: args.portalUrl },
      signature: 'Equipo Publiko',
    },
  })
}

export function notifyClientHumanInputNeeded(args: {
  to: string
  businessName: string
  conceptSummary: string
  portalUrl: string
}) {
  return sendClientEmail({
    to: args.to,
    subject: `Necesitamos tu input — ${args.businessName}`,
    template: {
      preheader: 'Una idea de esta semana requiere tu historia.',
      title: 'Tu historia para esta idea',
      intro: `Estamos preparando una pieza que solo tú puedes contar bien:<br><br><em>"${escapeHtml(args.conceptSummary)}"</em><br><br>Cuéntanos en 2 líneas o un audio cómo lo vivirías tú — desde el portal.`,
      cta: { label: 'Compartir mi input →', url: args.portalUrl },
      signature: 'Equipo Publiko',
    },
  })
}
