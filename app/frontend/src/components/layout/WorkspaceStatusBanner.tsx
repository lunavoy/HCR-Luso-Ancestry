import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export function WorkspaceStatusBanner() {
  const status = useAppStore(state => state.workspaceStatus)
  const error = useAppStore(state => state.workspaceError)
  const loadWorkspace = useAppStore(state => state.loadWorkspace)

  if (status === 'loading') return <div className="workspace-banner" role="status"><RefreshCw className="spin" size={15} /> A carregar coleções do Supabase…</div>
  if (status !== 'error') return null
  return (
    <div className="workspace-banner is-error" role="alert">
      <AlertTriangle size={15} />
      <span><strong>Não foi possível carregar o acervo.</strong> {error}</span>
      <button className="secondary-button" onClick={() => void loadWorkspace()} type="button"><RefreshCw size={14} /> Tentar novamente</button>
    </div>
  )
}
