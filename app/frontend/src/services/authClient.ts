import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let clientPromise: Promise<SupabaseClient> | undefined

async function configureClient() {
  const response = await fetch('/api/auth/config')
  if (!response.ok) throw new Error('O serviço de autenticação não está disponível.')
  const config = await response.json() as { url: string; publishableKey: string }
  return createClient(config.url, config.publishableKey)
}

export function getAuthClient() {
  clientPromise ??= configureClient().catch(error => {
    clientPromise = undefined
    throw error
  })
  return clientPromise
}
