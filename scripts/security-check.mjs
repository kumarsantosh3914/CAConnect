/**
 * Security regression check for CAConnect's anonymous, token-authenticated
 * surfaces: the document-upload route and the client portal.
 *
 * These are the places where authorisation is a token rather than RLS, which
 * makes them the highest-risk files in the codebase. Run this after any change
 * to those routes, their helpers, or the storage policies.
 *
 *   npm run dev          # in one terminal
 *   node scripts/security-check.mjs
 *
 * Reads .env.local and needs SUPABASE_SERVICE_ROLE_KEY. Creates and deletes
 * its own scratch CA account; leaves no fixtures behind.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim()})
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
const BASE = 'http://localhost:3000'

const tok = () => crypto.randomBytes(32).toString('base64url')
const results = []
function check(name, pass, detail='') {
  results.push({name, pass, detail})
  console.log(`  ${pass ? 'PASS' : '*** FAIL ***'}  ${name}${detail ? '  — ' + detail : ''}`)
}

async function post(token, { file, name='doc.pdf', type='application/pdf', itemId } = {}) {
  const fd = new FormData()
  fd.append('file', new File([file ?? new Uint8Array([0x25,0x50,0x44,0x46,0x2d])], name, { type }))
  if (itemId) fd.append('item_id', itemId)
  const r = await fetch(`${BASE}/api/upload/${token}`, { method:'POST', body: fd })
  let body = {}; try { body = await r.json() } catch {}
  return { status: r.status, body }
}

// Self-contained: this script creates its own CA and client, then removes
// them, so it can run against any environment without prior fixtures.
const scratchEmail = `sec-check-${Date.now()}@caconnect.test`
const { data: made, error: makeErr } = await admin.auth.admin.createUser({
  email: scratchEmail, password: 'SecCheckPass123!', email_confirm: true,
})
if (makeErr) { console.error('Could not create scratch CA:', makeErr.message); process.exit(1) }
const ca = made.user

// A firm for the scratch CA to own. Domain rows are firm-scoped now, so the
// fixture needs a firm and a membership, not just a user.
const { data: firm } = await admin
  .from('firms')
  .insert({ name: 'Security Check Firm', created_by: ca.id })
  .select('id').single()
await admin.from('firm_members').insert({ firm_id: firm.id, user_id: ca.id, role: 'owner' })

const { data: client } = await admin
  .from('clients')
  // PAN is set so the portal test can assert it never crosses the boundary.
  .insert({ firm_id: firm.id, created_by: ca.id, name: 'Security Check Client', pan: 'ABCDE1234F' })
  .select('id').single()

// Two requests: one live, one already expired, plus an item on each
const liveToken = tok(), expiredToken = tok(), otherToken = tok()
const mk = async (token, days) => {
  const exp = new Date(); exp.setDate(exp.getDate() + days)
  const { data: r } = await admin.from('document_requests').insert({
    firm_id: firm.id, created_by: ca.id, client_id: client.id, token, title: 'Sec test', expires_at: exp.toISOString()
  }).select('id').single()
  const { data: i } = await admin.from('document_request_items').insert({
    firm_id: firm.id, created_by: ca.id, request_id: r.id, label: 'Form 16', is_required: true
  }).select('id').single()
  return { requestId: r.id, itemId: i.id }
}
const live = await mk(liveToken, 30)
await mk(expiredToken, -1)
const other = await mk(otherToken, 30)

console.log('\n── TOKEN VALIDATION ──')
check('malformed token rejected', (await post('short')).status === 404)
check('sql-ish token rejected', (await post("' OR 1=1--")).status === 404)
check('encoded path traversal token rejected', (await post('..%2F..%2Fetc%2Fpasswd')).status === 404)
check('well-formed but unknown token rejected', (await post(tok())).status === 404)
const exp = await post(expiredToken)
check('expired token rejected with 410', exp.status === 410, `got ${exp.status}`)

console.log('\n── FILE VALIDATION ──')
const big = await post(liveToken, { file: new Uint8Array(11 * 1024 * 1024) })
check('oversized file rejected (11MB) with 413', big.status === 413, `got ${big.status}`)
const exe = await post(liveToken, { name:'evil.exe', type:'application/x-msdownload' })
check('executable MIME rejected', exe.status === 415, `got ${exe.status}`)
const html = await post(liveToken, { name:'x.html', type:'text/html' })
check('html MIME rejected', html.status === 415, `got ${html.status}`)
const empty = await post(liveToken, { file: new Uint8Array(0) })
check('empty file rejected', empty.status === 400, `got ${empty.status}`)

console.log('\n── CROSS-REQUEST ITEM BINDING ──')
const stolen = await post(liveToken, { itemId: other.itemId })
check("item_id from ANOTHER request rejected", stolen.status === 400, `got ${stolen.status}`)

console.log('\n── HAPPY PATH ──')
const ok = await post(liveToken, { name:'Form16.pdf', itemId: live.itemId })
check('valid upload accepted', ok.status === 200, `got ${ok.status}`)
check('request auto-completed when required items filled', ok.body.complete === true)

const { data: doc } = await admin.from('documents').select('*').eq('request_id', live.requestId).single()
check('document row owned by the FIRM, not the caller', doc?.firm_id === firm.id)
check('document row has no created_by (an anonymous client uploaded it)', doc?.created_by === null)
check('storage path namespaced under the firm id', doc?.storage_path?.startsWith(`${firm.id}/${client.id}/`), doc?.storage_path?.slice(0,40))
check('filename sanitised', doc?.file_name === 'Form16.pdf', doc?.file_name)

console.log('\n── FILENAME SANITISATION ──')
await post(liveToken, { name:'../../../etc/passwd.pdf' })
const { data: travDoc } = await admin.from('documents').select('file_name,storage_path').eq('request_id', live.requestId).order('created_at',{ascending:false}).limit(1).single()
check('traversal filename neutralised', !travDoc.file_name.includes('..') && !travDoc.storage_path.includes('..'), travDoc.file_name)

console.log('\n── ANONYMOUS DB ACCESS ──')
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const r1 = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/document_requests?select=token`, { headers:{apikey:anonKey, Authorization:'Bearer '+anonKey}})
const t1 = await r1.json()
check('anon cannot list document_requests (no token leak)', Array.isArray(t1) && t1.length === 0, JSON.stringify(t1).slice(0,60))
const r2 = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/documents?select=storage_path`, { headers:{apikey:anonKey, Authorization:'Bearer '+anonKey}})
const t2 = await r2.json()
check('anon cannot list documents', Array.isArray(t2) && t2.length === 0)

console.log('\n── PRIVATE STORAGE ──')
const pub = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-documents/${doc.storage_path}`)
check('uploaded file NOT publicly readable', pub.status !== 200, `got ${pub.status}`)

console.log('\n── RATE LIMITING ──')
const burst = await Promise.all(Array.from({length:26}, () => post(liveToken, { name:'burst.pdf' })))
check('burst of 26 uploads gets throttled', burst.some(r => r.status === 429), `statuses: ${[...new Set(burst.map(r=>r.status))].join(',')}`)

console.log('\n── CLIENT PORTAL: TOKEN VALIDATION ──')
const getPortal = async (t) => {
  const r = await fetch(`${BASE}/portal/${t}`)
  return { status: r.status, html: await r.text() }
}
const invalidCopy = (html) => html.includes('This link is not valid')

check('malformed portal token shows the invalid-link page', invalidCopy((await getPortal('short')).html))
check('unknown well-formed portal token shows the invalid-link page', invalidCopy((await getPortal(tok())).html))

// A second client in the SAME firm, with its own document. The portal's
// authorisation is the token, so the binding that matters is token -> client.
const { data: otherClient } = await admin
  .from('clients').insert({ firm_id: firm.id, created_by: ca.id, name: 'Other Client Of Same Firm' })
  .select('id').single()
const { data: otherDoc } = await admin.from('documents').insert({
  firm_id: firm.id, client_id: otherClient.id, storage_path: `${firm.id}/${otherClient.id}/other.pdf`,
  file_name: 'other.pdf', mime_type: 'application/pdf', size_bytes: 10, uploaded_by: 'ca',
}).select('id').single()

// Facts that must and must not cross the boundary.
await admin.from('fees').insert([
  { firm_id: firm.id, client_id: client.id, description: 'PORTAL-DRAFT-FEE', amount_paise: 500000, status: 'draft' },
  { firm_id: firm.id, client_id: client.id, description: 'PORTAL-INVOICED-FEE', amount_paise: 250000, status: 'invoiced' },
])
await admin.from('notices').insert({
  firm_id: firm.id, client_id: client.id, title: 'PORTAL-SECRET-NOTICE', notice_text: 'x',
  draft_response: 'PORTAL-SECRET-DRAFT',
})

const portalToken = tok()
const { data: portalRow } = await admin.from('client_portals').insert({
  firm_id: firm.id, created_by: ca.id, client_id: client.id, token: portalToken,
}).select('id').single()

console.log('\n── CLIENT PORTAL: WHAT IT MAY SHOW ──')
const page = await getPortal(portalToken)
check('active portal renders for the right client', page.html.includes('Security Check Client'), `status ${page.status}`)
check('portal shows an invoiced fee', page.html.includes('PORTAL-INVOICED-FEE'))
check('portal NEVER shows a draft fee', !page.html.includes('PORTAL-DRAFT-FEE'))
check('portal NEVER shows a notice', !page.html.includes('PORTAL-SECRET-NOTICE'))
check('portal NEVER shows an AI notice draft', !page.html.includes('PORTAL-SECRET-DRAFT'))
check("portal does not leak the client's PAN", !page.html.includes('ABCDE1234F'))

console.log('\n── CLIENT PORTAL: DOCUMENT BINDING ──')
const docFetch = async (t, id) => (await fetch(`${BASE}/api/portal/${t}/document/${id}`, { redirect: 'manual' })).status
check('portal serves its own client\'s document', [302,307].includes(await docFetch(portalToken, doc.id)))
check("portal REFUSES another client's document", (await docFetch(portalToken, otherDoc.id)) === 404)
check('portal document route rejects a garbage id', (await docFetch(portalToken, '00000000-0000-0000-0000-000000000000')) === 404)
check('unknown portal token cannot fetch any document', (await docFetch(tok(), doc.id)) === 404)

console.log('\n── CLIENT PORTAL: REVOCATION ──')
await admin.from('client_portals').update({ is_active: false }).eq('id', portalRow.id)
check('revoked portal shows the invalid-link page', invalidCopy((await getPortal(portalToken)).html))
check('revoked portal cannot fetch documents either', (await docFetch(portalToken, doc.id)) === 404)
await admin.from('client_portals').update({ is_active: true }).eq('id', portalRow.id)

console.log('\n── CLIENT PORTAL: ANONYMOUS DB ACCESS ──')
const r3 = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/client_portals?select=token`, { headers:{apikey:anonKey, Authorization:'Bearer '+anonKey}})
const t3 = await r3.json()
check('anon cannot list client_portals (no token leak)', Array.isArray(t3) && t3.length === 0, JSON.stringify(t3).slice(0,60))

console.log('\n── CLIENT PORTAL: CROSS-FIRM WRITE ──')
// A real second firm, and a signed-in session for our scratch CA. The hole
// being tested: firm_id comes from MY session, so only the client_id check in
// the policy stops me minting a portal onto a stranger's client.
const { data: firm2 } = await admin.from('firms').insert({ name: 'Other Firm' }).select('id').single()
const { data: client2 } = await admin.from('clients')
  .insert({ firm_id: firm2.id, name: 'Client Of Other Firm' }).select('id').single()

const session = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey, {auth:{persistSession:false}})
const { error: signInErr } = await session.auth.signInWithPassword({ email: scratchEmail, password: 'SecCheckPass123!' })
check('scratch CA can sign in (session tests are meaningful)', !signInErr, signInErr?.message ?? '')

const { error: crossErr } = await session.from('client_portals')
  .insert({ firm_id: firm.id, client_id: client2.id, token: tok() })
check("RLS blocks minting a portal onto another firm's client", !!crossErr, crossErr?.code ?? 'NO ERROR — HOLE OPEN')

const { data: seenPortals } = await session.from('client_portals').select('token').eq('client_id', client2.id)
check("cannot read another firm's portal row", (seenPortals ?? []).length === 0)

await admin.from('firms').delete().eq('id', firm2.id)

// Cleanup: remove every artefact this run created, and nothing else.
const { data: ourDocs } = await admin.from('documents').select('storage_path').eq('firm_id', firm.id)
if (ourDocs?.length) await admin.storage.from('client-documents').remove(ourDocs.map(d => d.storage_path))
await admin.from('firms').delete().eq('id', firm.id) // cascades to clients, requests, documents
await admin.auth.admin.deleteUser(ca.id)

const failed = results.filter(r => !r.pass)
console.log(`\n${'='.repeat(60)}`)
console.log(`${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILURES:')
  failed.forEach(f => console.log('  - ' + f.name + ' ' + f.detail))
  process.exit(1)
}
