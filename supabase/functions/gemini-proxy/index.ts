import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://leehojun0303.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
  if (!supabaseUrl || !serviceKey || !geminiKey) return json(500, { error: 'server_not_configured' })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'missing_auth' })
  const service = createClient(supabaseUrl, serviceKey)
  const token = authHeader.slice('Bearer '.length)
  const { data: { user }, error: authError } = await service.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'invalid_auth' })

  const input = await req.json().catch(() => ({}))
  const model = String(input.model || 'gemini-3.1-flash-lite').replace(/^models\//, '')
  const body = input.body
  if (!body || typeof body !== 'object') return json(400, { error: 'missing_gemini_body' })

  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify(body),
  })
  const payload = await upstream.text()
  return new Response(payload, { status: upstream.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
