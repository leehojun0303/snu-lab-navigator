import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://leehojun0303.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lab-username',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json(405,{error:'method_not_allowed'})
  const supabaseUrl=Deno.env.get('SUPABASE_URL')??''
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SERVICE_ROLE_KEY')??''
  const geminiKey=Deno.env.get('GEMINI_API_KEY')??''
  if(!supabaseUrl||!serviceKey||!geminiKey)return json(500,{error:'server_not_configured'})

  // The app intentionally uses a simple ID-only account model. Do not require
  // a Supabase Auth bearer token here; verify that the submitted ID is a
  // registered lab account instead. This preserves the requested ability to
  // recover an account from any browser/device using only its ID. Note that
  // this is not suitable for sensitive/private account data.
  const username=String(req.headers.get('x-lab-username')||'').trim().toLowerCase()
  if(!/^[a-z0-9_.-]{3,40}$/.test(username))return json(401,{error:'missing_or_invalid_account_id'})

  const service=createClient(supabaseUrl,serviceKey)
  const {data:account,error:accountError}=await service.from('lab_accounts').select('username').eq('username',username).maybeSingle()
  if(accountError)return json(500,{error:accountError.message})
  if(!account)return json(403,{error:'account_not_registered'})

  const input=await req.json().catch(()=>({}))
  const model=String(input.model||'gemini-3.1-flash-lite').replace(/^models\//,'')
  const body=input.body
  if(!body||typeof body!=='object')return json(400,{error:'missing_gemini_body'})
  const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':geminiKey},body:JSON.stringify(body)})
  const payload=await upstream.text()
  return new Response(payload,{status:upstream.status,headers:{...corsHeaders,'Content-Type':'application/json'}})
})
