/**
 * Helpers de zona horaria. La agencia opera en Europe/Madrid pero el servidor
 * (Vercel) corre en UTC. `publish_hours` y las horas que ve el admin son hora
 * de Madrid; aquí las convertimos a UTC correctamente respetando el horario de
 * verano, sin depender del TZ del proceso.
 */
const TZ = 'Europe/Madrid'

/** Offset de Madrid (minutos respecto a UTC) para una fecha dada. */
export function madridOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUTC - date.getTime()) / 60000)
}

/**
 * Convierte una hora de pared "HH:MM" de Madrid del día de `base` (en Madrid)
 * a un ISO UTC. Si la hora ya pasó, empuja al día siguiente.
 */
export function madridWallTimeToUtcISO(hhmm: string, base: Date = new Date()): string {
  const [hhRaw, mmRaw] = (hhmm ?? '').split(':')
  const hh = parseInt(hhRaw, 10)
  const mm = parseInt(mmRaw, 10)
  const h = isNaN(hh) ? 12 : hh
  const m = isNaN(mm) ? 0 : mm

  // Día (año/mes/día) tal como se ve en Madrid para `base`.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(base)
  const [y, mo, d] = ymd.split('-').map((n) => parseInt(n, 10))

  const offset = madridOffsetMinutes(base)
  let utcMs = Date.UTC(y, mo - 1, d, h, m, 0) - offset * 60000
  if (utcMs < Date.now()) utcMs += 24 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

/** Formatea una fecha en hora de Madrid (para vistas server-side). */
export function formatMadrid(
  iso: string | Date,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' },
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...opts }).format(d)
}

/** Devuelve YYYY-MM-DD del día en Madrid (para agrupar calendarios). */
export function madridDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}
