import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getAuthClient } from '../../services/authClient'
import { useAppStore } from '../../stores/useAppStore'

const AuthContext = createContext<Session | null>(null)

export const useSession = () => useContext(AuthContext)

export function useWorkspaceRole() {
  const metadata = useSession()?.user.app_metadata
  if (metadata?.workspace_admin === true) return 'admin'
  return 'contributor'
}

export function useWorkspaceLevel(): 'videira' | 'cacho' | 'vinho' {
  const level = useSession()?.user.app_metadata.workspace_level
  return level === 'cacho' || level === 'vinho' ? level : 'videira'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const userId = useRef<string | undefined>(undefined)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    getAuthClient().then(client => {
      if (!active) return
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return
        if (userId.current !== nextSession?.user.id) {
          useAppStore.getState().clearWorkspace()
          userId.current = nextSession?.user.id
        }
        setSession(nextSession)
      })
      unsubscribe = () => data.subscription.unsubscribe()
    }).catch(() => {
      if (active) setFailed(true)
    })
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [attempt])

  if (failed) {
    return (
      <main className="route-loading">
        <p role="alert">Não foi possível conectar ao serviço de autenticação.</p>
        <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>
          Tentar novamente
        </button>
      </main>
    )
  }
  if (session === undefined) return <div className="route-loading">A verificar a sessão…</div>
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
}
