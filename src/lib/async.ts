/**
 * Ejecuta `fn` sobre `items` con concurrencia acotada (sin dependencias).
 * Evita disparar cientos de llamadas a la vez (p.ej. Claude/Meta a 100 clientes
 * en el cron), que saturan rate limits y revientan el maxDuration de Vercel.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx], idx)
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  await Promise.all(workers)
  return results
}
