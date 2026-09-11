import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://leehojun0303.github.io',
  'Access-Control-Allow-Headers': 'content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers: {...corsHeaders, 'Content-Type': 'application/json'}})

const repo = Deno.env.get('GITHUB_REPO') || 'leehojun0303/snu-lab-navigator'
const token = Deno.env.get('GITHUB_TOKEN') || ''
const path = 'data/account-registry.json'

async function github(pathname: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return response
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders})
  if (req.method !== 'POST') return json(405, {error: 'method_not_allowed'})
  if (!token) return json(503, {error: 'registry_not_configured'})

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return json(500, {error: 'server_not_configured'})

  const input = await req.json().catch(() => ({}))
  const username = String(input.username || '').trim().toLowerCase()
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) return json(400, {error: 'invalid_username'})

  const admin = createClient(supabaseUrl, serviceKey)
  const {data: account, error: accountError} = await admin.from('lab_accounts').select('username,created_at').eq('username', username).maybeSingle()
  if (accountError) return json(500, {error: accountError.message})
  if (!account) return json(404, {error: 'account_not_found'})

  let existing: {entries?: Array<{username: string, created_at: string}>} = {entries: []}
  let sha = ''
  const get = await github(path)
  if (get.ok) {
    const payload = await get.json()
    sha = payload.sha || ''
    try { existing = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(payload.content || '').replace(/\n/g, '')), c => c.charCodeAt(0)))) } catch (_) { existing = {entries: []} }
  } else if (get.status !== 404) {
    return json(502, {error: `github_get_${get.status}`})
  }

  const entries = Array.isArray(existing.entries) ? existing.entries.filter(x => x && /^[a-z0-9_.-]{3,40}$/.test(String(x.username || ''))) : []
  const already = entries.some(x => x.username === username)
  if (!already) entries.push({username, created_at: String(account.created_at)})
  entries.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.username.localeCompare(b.username))

  const body = JSON.stringify({updated_at: new Date().toISOString(), entries}, null, 2) + '\n'
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(body)))
  const put = await github(path, {
    method: 'PUT',
    body: JSON.stringify({
      message: already ? `Refresh account registry for ${username}` : `Register new lab navigator ID ${username}`,
      content: encoded,
      ...(sha ? {sha} : {}),
      branch: 'main',
    }),
  })
  if (!put.ok) return json(502, {error: `github_put_${put.status}`})

  return json(200, {ok: true, username, registered: true})
})
