// Uso:
//   node scripts/list-gmb-locations.mjs
//
// Necesita en .env.local (o exportadas):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN_GMB   (con scope https://www.googleapis.com/auth/business.manage)
//
// Te imprime tus accounts y todas las locations de cada uno, con sus IDs listos
// para pegar en clients.gmb_account_id y clients.gmb_location_id.

import { readFileSync, existsSync } from 'node:fs'

function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  const content = readFileSync('.env.local', 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (process.env[key]) continue
    const value = raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    process.env[key] = value
  }
}

loadEnvLocal()

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN_GMB } = process.env

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN_GMB) {
  console.error('❌ Faltan env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN_GMB')
  console.error('   Añádelas a .env.local o expórtalas antes de ejecutar.')
  process.exit(1)
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN_GMB,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth refresh failed: ${JSON.stringify(data)}`)
  }
  return data.access_token
}

async function get(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  if (!res.ok) throw new Error(`${url} → ${JSON.stringify(data)}`)
  return data
}

const token = await getAccessToken()
console.log('✓ Access token obtenido\n')

const accountsRes = await get(
  'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
  token,
)
const accounts = accountsRes.accounts ?? []

if (accounts.length === 0) {
  console.log('Sin accounts. ¿El refresh token tiene scope business.manage y la cuenta tiene perfiles vinculados?')
  process.exit(0)
}

for (const account of accounts) {
  console.log('━'.repeat(70))
  console.log(`ACCOUNT  ${account.name}`)
  console.log(`         ${account.accountName ?? '(sin nombre)'}  ·  ${account.type ?? ''}`)
  console.log('━'.repeat(70))

  try {
    const locsRes = await get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
      token,
    )
    const locations = locsRes.locations ?? []
    if (locations.length === 0) {
      console.log('  (sin locations)\n')
      continue
    }

    for (const loc of locations) {
      const addr = loc.storefrontAddress?.addressLines?.join(', ') ?? ''
      const locality = loc.storefrontAddress?.locality ?? ''
      console.log(`  📍 ${loc.title ?? '(sin título)'}`)
      console.log(`     gmb_account_id   = ${account.name}`)
      console.log(`     gmb_location_id  = ${loc.name}`)
      if (addr || locality) console.log(`     ${addr}${addr && locality ? ', ' : ''}${locality}`)
      console.log()
    }
  } catch (err) {
    console.error(`  Error listando locations: ${err.message}\n`)
  }
}

console.log('━'.repeat(70))
console.log('Listo. Copia los IDs a clients.gmb_account_id y clients.gmb_location_id en Supabase.')
