import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
import { WorkspaceStatusBanner } from './WorkspaceStatusBanner'
import { useAppStore } from '../../stores/useAppStore'

export function WorkspaceLayout() {
  const theme = useAppStore(state => state.theme)
  const location = useLocation()
  const viewerMode = location.pathname.startsWith('/viewer/')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

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
