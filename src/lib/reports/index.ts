import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
}

interface WeeklyReportData {
  businessName: string
  contactEmail: string
  weekStart: string
  weekEnd: string
  postsPublished: number
  totalReach: number
  totalLikes: number
  totalSaves: number
  avgEngagementRate: number | null
  aiSummary: string | null
  aiRecommendations: string | null
  topPost?: { copy: string; platform: string; reach: number }
}

export async function sendWeeklyReportEmail(data: WeeklyReportData): Promise<{ id?: string }> {
  const weekLabel = `${new Date(data.weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} – ${new Date(data.weekEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 28px; font-weight: normal; margin: 0 0 8px; }
    .label { font-family: Arial, sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #888; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .metric { background: #f9f9f7; border-radius: 8px; padding: 16px; }
    .metric-value { font-size: 28px; font-weight: normal; margin: 4px 0; }
    .metric-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .section { margin: 32px 0; }
    .divider { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
    p { line-height: 1.7; color: #444; }
    .footer { font-size: 11px; color: #aaa; margin-top: 48px; font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  <div class="label">Informe semanal · Agency OS</div>
  <h1>${data.businessName}</h1>
  <p style="color:#888; font-size:14px;">${weekLabel}</p>

  <hr class="divider">

  <table style="width:100%; border-collapse:collapse; margin:24px 0;">
    <tr>
      <td style="padding:12px; background:#f9f9f7; border-radius:8px; text-align:center; width:25%">
        <div style="font-size:28px;">${data.postsPublished}</div>
        <div style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">Posts</div>
      </td>
      <td style="padding:4px;"></td>
      <td style="padding:12px; background:#f9f9f7; border-radius:8px; text-align:center; width:25%">
        <div style="font-size:28px;">${data.totalReach.toLocaleString('es-ES')}</div>
        <div style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">Alcance</div>
      </td>
      <td style="padding:4px;"></td>
      <td style="padding:12px; background:#f9f9f7; border-radius:8px; text-align:center; width:25%">
        <div style="font-size:28px;">${data.totalLikes.toLocaleString('es-ES')}</div>
        <div style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">Likes</div>
      </td>
      <td style="padding:4px;"></td>
      <td style="padding:12px; background:#f9f9f7; border-radius:8px; text-align:center; width:25%">
        <div style="font-size:28px;">${data.avgEngagementRate != null ? (data.avgEngagementRate * 100).toFixed(1) + '%' : '—'}</div>
        <div style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">Engagement</div>
      </td>
    </tr>
  </table>

  ${data.topPost ? `
  <div class="section">
    <div class="label">Top post de la semana</div>
    <div style="background:#f9f9f7; border-radius:8px; padding:16px; margin-top:12px;">
      <div style="font-size:10px; color:#888; text-transform:uppercase; margin-bottom:8px;">${data.topPost.platform} · ${data.topPost.reach.toLocaleString('es-ES')} alcance</div>
      <p style="margin:0; font-style:italic; color:#555;">"${data.topPost.copy.substring(0, 200)}${data.topPost.copy.length > 200 ? '…' : ''}"</p>
    </div>
  </div>
  ` : ''}

  ${data.aiSummary ? `
  <div class="section">
    <div class="label">Resumen de la semana</div>
    <p style="margin-top:12px;">${data.aiSummary}</p>
  </div>
  ` : ''}

  ${data.aiRecommendations ? `
  <div class="section">
    <div class="label">Recomendaciones para la próxima semana</div>
    <p style="margin-top:12px;">${data.aiRecommendations}</p>
  </div>
  ` : ''}

  <hr class="divider">
  <p class="footer">
    Este informe ha sido generado automáticamente por Agency OS.<br>
    Para ver el detalle completo, accede a tu portal.
  </p>
</body>
</html>
`

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM ?? 'hola@agencyos.app',
    to: data.contactEmail,
    subject: `Informe semanal — ${data.businessName} (${weekLabel})`,
    html,
  })

  return { id: result.data?.id }
}
