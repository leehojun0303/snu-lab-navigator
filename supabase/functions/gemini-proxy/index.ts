import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://leehojun0303.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lab-username',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const cleanSecret=(value:string)=>value.trim().replace(/^['\"]+|['\"]+$/g,'').trim()

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json(405,{error:'method_not_allowed'})
  const supabaseUrl=cleanSecret(Deno.env.get('SUPABASE_URL')??'')
  const serviceKey=cleanSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SERVICE_ROLE_KEY')??'')
  const geminiKey=cleanSecret(Deno.env.get('GEMINI_API_KEY')??'')
  if(!supabaseUrl||!serviceKey||!geminiKey)return json(500,{error:'server_not_configured',detail:'GEMINI_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY is missing'})

  // ID-only account model. Supabase's platform JWT gate is disabled in
  // supabase/config.toml; authorization is performed here using the registered ID.
  const username=String(req.headers.get('x-lab-username')||'').trim().toLowerCase()
  if(!/^[a-z0-9_.-]{3,40}$/.test(username))return json(400,{error:'account_id_missing_or_invalid'})

  const service=createClient(supabaseUrl,serviceKey)
  const {data:account,error:accountError}=await service.from('lab_accounts').select('username').eq('username',username).maybeSingle()
  if(accountError)return json(500,{error:'account_lookup_failed',detail:accountError.message})
  if(!account)return json(403,{error:'account_not_registered'})

  const input=await req.json().catch(()=>({}))
  const model=String(input.model||'gemini-3.1-flash-lite').replace(/^models\//,'').trim()
  const body=input.body
  if(!body||typeof body!=='object')return json(400,{error:'missing_gemini_body'})

  const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':geminiKey},
    body:JSON.stringify(body)
  })
  const payload=await upstream.text()
  if(upstream.status===401){
    let detail='Gemini authentication failed. Check the deployed GEMINI_API_KEY in Supabase Edge Function secrets.'
    try{
      const parsed=JSON.parse(payload)
      const message=String(parsed?.error?.message||'').replace(/AIza[0-9A-Za-z_-]+|AQ\.[0-9A-Za-z._-]+/g,'[REDACTED]')
      if(message)detail=message
    }catch(_){/* keep generic */}
    return json(502,{error:'gemini_authentication_failed',detail})
  }
  if(upstream.status===404)return json(502,{error:'gemini_model_not_found',detail:`모델 ${model}을 찾지 못했습니다.`})
  if(upstream.status===403)return json(502,{error:'gemini_permission_denied',detail:'Gemini API key가 해당 API/프로젝트에서 허용되지 않았습니다.'})
  return new Response(payload,{status:upstream.status,headers:{...corsHeaders,'Content-Type':'application/json'}})
})
