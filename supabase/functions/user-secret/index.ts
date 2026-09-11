import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://leehojun0303.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

function base64(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function bytes(value: string) {
  const s = atob(value)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function cryptoKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encrypt(secret: string, plaintext: string) {
  const key = await cryptoKey(secret)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, new TextEncoder().encode(plaintext))
  return { cipherText: base64(new Uint8Array(cipher)), nonce: base64(nonce) }
}

async function decrypt(secret: string, cipherText: string, nonce: string) {
  const key = await cryptoKey(secret)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(nonce) }, key, bytes(cipherText))
  return new TextDecoder().decode(plain)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const encryptionSecret = Deno.env.get('GEMINI_KEY_ENCRYPTION_SECRET') ?? ''
  if (!supabaseUrl || !serviceKey || !encryptionSecret) return json(500, { error: 'server_not_configured' })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'missing_auth' })
  const client = createClient(supabaseUrl, serviceKey)
  const token = authHeader.slice('Bearer '.length)
  const { data: { user }, error: authError } = await client.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'invalid_auth' })

  const input = await req.json().catch(() => ({}))
  const action = String(input.action || '')
  if (action === 'set') {
    const apiKey = String(input.apiKey || '').trim()
    if (apiKey.length < 20) return json(400, { error: 'invalid_api_key' })
    const encrypted = await encrypt(encryptionSecret, apiKey)
    const { error } = await client.from('gemini_keys').upsert({
      user_id: user.id,
      cipher_text: encrypted.cipherText,
      nonce: encrypted.nonce,
      updated_at: new Date().toISOString(),
    })
    if (error) return json(500, { error: 'database_write_failed', detail: error.message })
    return json(200, { ok: true })
  }
  if (action === 'get') {
    const { data, error } = await client.from('gemini_keys').select('cipher_text, nonce').eq('user_id', user.id).maybeSingle()
    if (error) return json(500, { error: 'database_read_failed', detail: error.message })
    if (!data) return json(404, { error: 'no_key' })
    const apiKey = await decrypt(encryptionSecret, data.cipher_text, data.nonce)
    return json(200, { apiKey })
  }
  if (action === 'delete') {
    const { error } = await client.from('gemini_keys').delete().eq('user_id', user.id)
    if (error) return json(500, { error: 'database_delete_failed', detail: error.message })
    return json(200, { ok: true })
  }
  return json(400, { error: 'unknown_action' })
})
