import { createClient, type SupabaseClient } from '@supabase/supabase-js'
let client: SupabaseClient
export async function initSession() {
  const response=await fetch('/api/strategist?op=config',{cache:'no-store'})
  const config=await response.json()
  if(!response.ok) throw new Error(config.error || 'Unable to connect to Strategist.')
  client=createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'immuvi-auth',storage:window.localStorage}})
  const {data:{session}}=await client.auth.getSession()
  if(!session) throw new SessionError('Sign in with your Immuvi account to open Strategist.')
  return api('session')
}
export class SessionError extends Error {}
export async function api(op:string,query:Record<string,string>={},body?:unknown,signal?:AbortSignal):Promise<any> {
  const {data:{session}}=await client.auth.getSession()
  if(!session) throw new SessionError('Your session has expired. Sign in to Immuvi again.')
  const response=await fetch(`/api/strategist?${new URLSearchParams({op,...query})}`,{
    method:body===undefined?'GET':'POST',cache:'no-store',signal,
    headers:{Authorization:`Bearer ${session.access_token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body),
  })
  const data=await response.json()
  if(response.status===401)throw new SessionError(data.error)
  if(!response.ok)throw new Error(data.error || `Request failed (${response.status})`)
  return data
}
