/**
 * Tests de RLS multi-org contra el Supabase real.
 *
 *   node --env-file=.env.local scripts/test-rls.mjs
 *
 * Crea DOS organizaciones de prueba (nunca toca la org seed ni datos
 * reales), cada una con admin + cliente + client + agency_settings +
 * invoice, y verifica el aislamiento con sesiones reales. Borra todo al
 * final (también si algo falla). Exit code 1 si algún assert falla.
 *
 * Requiere que las migrations 0015-0019 estén aplicadas.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY (usa --env-file=.env.local)')
  process.exit(1)
}

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } })
const TS = Date.now()
const PASSWORD = `TestRls!${TS}`

const results = []
function assert(name, cond, extra = '') {
  results.push({ name, ok: Boolean(cond) })
  console.log(`${cond ? '  ✅' : '  ❌'} ${name}${cond || !extra ? '' : ` — ${extra}`}`)
}

/** Estado creado, para cleanup en orden inverso de FKs. */
const created = { users: [], orgs: [] }

async function createOrgFixture(key, monthlyFee) {
  const slug = `test-org-${key}-${TS}`
  const { data: org, error: orgErr } = await svc
    .from('organizations')
    .insert({ name: `Test Org ${key.toUpperCase()} ${TS}`, slug })
    .select('id')
    .single()
  if (orgErr) throw new Error(`No se pudo crear la org ${key}: ${orgErr.message}`)
  created.orgs.push(org.id)

  async function createUser(role) {
    const email = `rls-test-${role}-${key}-${TS}@test.local`
    const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    created.users.push(data.user.id)
    const { error: pErr } = await svc.from('profiles').insert({
      id: data.user.id,
      full_name: `RLS Test ${role} ${key}`,
      email,
      role,
      organization_id: org.id,
      is_owner: role === 'admin',
    })
    if (pErr) throw new Error(`profile ${email}: ${pErr.message}`)
    return { id: data.user.id, email }
  }

  const admin = await createUser('admin')
  const clienteUser = await createUser('cliente')

  const { data: client, error: cErr } = await svc
    .from('clients')
    .insert({
      business_name: `Test Client ${key} ${TS}`,
      slug: `test-client-${key}-${TS}`,
      contact_name: 'RLS Test',
      status: 'active',
      is_active: true,
      monthly_fee: monthlyFee,
      organization_id: org.id,
      client_user_id: clienteUser.id,
    })
    .select('id')
    .single()
  if (cErr) throw new Error(`client ${key}: ${cErr.message}`)

  const { error: sErr } = await svc.from('agency_settings').insert({
    agency_name: `Test Agency ${key}`,
    nif: `TEST-${key}-${TS}`,
    organization_id: org.id,
  })
  if (sErr) throw new Error(`agency_settings ${key}: ${sErr.message}`)

  const { data: invoice, error: iErr } = await svc
    .from('invoices')
    .insert({
      client_id: client.id,
      organization_id: org.id,
      invoice_number: `TEST-${key.toUpperCase()}-${TS}`,
      amount: monthlyFee,
      invoice_type: 'extra',
      status: 'pending',
    })
    .select('id')
    .single()
  if (iErr) throw new Error(`invoice ${key}: ${iErr.message}`)

  return { orgId: org.id, admin, clienteUser, clientId: client.id, invoiceId: invoice.id, monthlyFee }
}

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}

async function cleanup() {
  console.log('\nLimpiando fixtures…')
  for (const table of ['invoices', 'agency_settings', 'clients']) {
    if (created.orgs.length) await svc.from(table).delete().in('organization_id', created.orgs)
  }
  if (created.users.length) await svc.from('profiles').delete().in('id', created.users)
  for (const uid of created.users) await svc.auth.admin.deleteUser(uid)
  if (created.orgs.length) await svc.from('organizations').delete().in('id', created.orgs)

  const { data: leftovers } = await svc.from('organizations').select('id').like('slug', `test-org-%-${TS}`)
  if (leftovers?.length) console.error(`⚠️ Quedaron ${leftovers.length} orgs de prueba sin borrar`)
  else console.log('Cleanup completo ✅')
}

async function main() {
  console.log(`Creando fixtures (ts=${TS})…`)
  const A = await createOrgFixture('a', 111)
  const B = await createOrgFixture('b', 222)

  const adminA = await login(A.admin.email)
  const adminB = await login(B.admin.email)
  const clienteA = await login(A.clienteUser.email)

  console.log('\n— Aislamiento entre organizaciones —')
  {
    const { data } = await adminA.from('clients').select('id')
    const ids = (data ?? []).map((r) => r.id)
    assert('admin A ve su client', ids.includes(A.clientId))
    assert('admin A NO ve el client de B', !ids.includes(B.clientId))
  }
  {
    const { data } = await adminA.from('invoices').select('id').eq('id', B.invoiceId)
    assert('admin A NO lee la factura de B', (data ?? []).length === 0)
  }
  {
    const { data } = await adminA.from('agency_settings').select('id, organization_id')
    const orgs = (data ?? []).map((r) => r.organization_id)
    assert('admin A solo ve agency_settings de su org', orgs.every((o) => o === A.orgId) && orgs.length === 1)
  }
  {
    const { data } = await adminA
      .from('agency_settings')
      .update({ iban: 'HACKED' })
      .eq('organization_id', B.orgId)
      .select('id')
    assert('admin A no puede modificar settings de B (0 filas)', (data ?? []).length === 0)
  }
  {
    const { error } = await adminA.from('clients').insert({
      business_name: `Cross Org ${TS}`,
      slug: `cross-org-${TS}`,
      contact_name: 'x',
      organization_id: B.orgId,
    })
    assert('admin A no puede insertar un client en la org B (WITH CHECK)', Boolean(error))
  }
  {
    const { data } = await adminA.from('profiles').select('id')
    const ids = (data ?? []).map((r) => r.id)
    assert('admin A NO ve profiles de B', !ids.includes(B.admin.id) && !ids.includes(B.clienteUser.id))
  }
  {
    const { data } = await adminA.from('organizations').select('id')
    assert('admin A solo ve su organización', (data ?? []).length === 1 && data[0].id === A.orgId)
  }

  console.log('\n— Cliente: solo sus facturas —')
  {
    const { data: own } = await clienteA.from('invoices').select('id').eq('id', A.invoiceId)
    assert('cliente A lee su propia factura', (own ?? []).length === 1)
    const { data: foreign } = await clienteA.from('invoices').select('id').eq('id', B.invoiceId)
    assert('cliente A NO lee la factura de B', (foreign ?? []).length === 0)
  }

  console.log('\n— RPCs org-aware —')
  {
    const { data: mrrA, error: eA } = await adminA.rpc('get_mrr_total')
    const { data: mrrB, error: eB } = await adminB.rpc('get_mrr_total')
    assert('get_mrr_total funciona para admin', !eA && !eB)
    assert(`get_mrr_total de A = ${A.monthlyFee} (obtuvo ${mrrA})`, mrrA === A.monthlyFee)
    assert(`get_mrr_total de B = ${B.monthlyFee} (obtuvo ${mrrB})`, mrrB === B.monthlyFee)
  }
  {
    const { data: n1 } = await adminA.rpc('next_invoice_number')
    const { data: n2 } = await adminA.rpc('next_invoice_number')
    const { data: nB } = await adminB.rpc('next_invoice_number')
    const num = (s) => parseInt(String(s).split('-').pop(), 10)
    assert(`next_invoice_number consecutivo en A (${n1} → ${n2})`, n1 && n2 && num(n2) === num(n1) + 1)
    assert(`contador de B independiente (${nB})`, nB && num(nB) === 1)
  }

  console.log('\n— Anónimo —')
  {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } })
    const { data } = await anon.from('clients').select('id')
    assert('anónimo ve 0 clients', (data ?? []).length === 0)
    const { data: orgs } = await anon.from('organizations').select('id')
    assert('anónimo ve 0 organizations', (orgs ?? []).length === 0)
  }
}

try {
  await main()
} catch (err) {
  console.error('\n💥 Error en la ejecución:', err.message)
  results.push({ name: 'ejecución sin errores', ok: false })
} finally {
  try {
    await cleanup()
  } catch (err) {
    console.error('💥 Error en cleanup (revisar manualmente):', err.message)
    process.exitCode = 1
  }
}

const failed = results.filter((r) => !r.ok)
console.log(`\nResultado: ${results.length - failed.length}/${results.length} asserts OK`)
if (failed.length) {
  console.error(`FALLOS: ${failed.map((f) => f.name).join(' | ')}`)
  process.exitCode = 1
}
