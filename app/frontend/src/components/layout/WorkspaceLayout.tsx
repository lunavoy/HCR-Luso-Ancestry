import { matchPath, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
import { WorkspaceStatusBanner } from './WorkspaceStatusBanner'
import { useAppStore } from '../../stores/useAppStore'
import { useSession, useWorkspaceRole } from '../auth/AuthProvider'

export function WorkspaceLayout() {
  const session = useSession()
  const location = useLocation()
  if (!session) {
    const from = location.pathname + location.search + location.hash
    return <Navigate to="/login" replace state={{ from }} />
  }
  return <AuthenticatedWorkspace key={session.user.id} />
}

function AuthenticatedWorkspace() {
  const theme = useAppStore(state => state.theme)
  const loadWorkspace = useAppStore(state => state.loadWorkspace)
  const location = useLocation()
  const viewerMode = location.pathname.startsWith('/viewer/')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  const role = useWorkspaceRole()
  if (role !== 'admin' && !['/documents', '/documents/:documentId', '/viewer/:pageId', '/line-review'].some(
    path => matchPath(path, location.pathname),
  )) return <Navigate to="/documents" replace />

  return (
    <div className={`workspace-shell ${viewerMode ? 'viewer-mode' : ''}`}>
      <AppSidebar />
      <div className="workspace-column">
        <AppHeader />
        {!viewerMode && <WorkspaceStatusBanner />}
        <Outlet />
      </div>
    </div>
  )
}
