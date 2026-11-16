import { ChevronRight, LogOut, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/useAppStore'
import { getAuthClient } from '../../services/authClient'
import { useSession, useWorkspaceLevel, useWorkspaceRole } from '../auth/AuthProvider'

const labels: Record<string, string> = {
  collections: 'Coleções',
  documents: 'Documentos',
  annotations: 'Anotações',
  models: 'Modelos de IA',
  experiments: 'Experimentos de treinamento',
  settings: 'Configurações',
  admin: 'Administração',
  import: 'Importar imagens',
  viewer: 'Editor de página',
}

export function AppHeader() {
  const location = useLocation()
  const theme = useAppStore(state => state.theme)
  const toggleTheme = useAppStore(state => state.toggleTheme)
  const segments = location.pathname.split('/').filter(Boolean)
  const user = useSession()?.user
  const role = useWorkspaceRole()
  const level = useWorkspaceLevel()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)

  async function signOut() {
    setSigningOut(true)
    setSignOutError(false)
    try {
      const client = await getAuthClient()
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) setSignOutError(true)
    } catch {
      setSignOutError(true)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="app-header">
      <div className="breadcrumbs">
        <span>HTR Portuguese Historical</span>
        {segments.map((segment, index) => (
          <span className="breadcrumb-segment" key={`${segment}-${index}`}>
            <ChevronRight size={14} />
            <strong>{labels[segment] ?? (segment.startsWith('book-') ? 'Livro' : 'Detalhes')}</strong>
          </span>
        ))}
      </div>
      <div className="header-actions">
        <button className="theme-toggle" onClick={toggleTheme} title="Alternar tema" type="button">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
        <span className="auth-access">
          <span className="workspace-level-icon" aria-hidden="true" />
          {role === 'admin' ? 'Administrador · ' : ''}{{ videira: 'Videira', cacho: 'Cacho', vinho: 'Vinho' }[level]}
        </span>
        {signOutError && <span className="auth-error" role="alert">Não foi possível sair.</span>}
        <button className="theme-toggle" type="button" disabled={signingOut} onClick={signOut}
          title={user?.email}>
          <LogOut size={17} aria-hidden="true" />
          Sair
        </button>
      </div>
    </header>
  )
}
