import { lazy, Suspense } from 'react'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { WorkspaceLayout } from './components/layout/WorkspaceLayout'
import { useAppStore } from './stores/useAppStore'

const OverviewPage = lazy(() => import('./pages/OverviewPage').then(module => ({ default: module.OverviewPage })))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage').then(module => ({ default: module.CollectionsPage })))
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage').then(module => ({ default: module.CollectionDetailPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(module => ({ default: module.DocumentsPage })))
const DocumentDetailPage = lazy(() => import('./pages/DocumentDetailPage').then(module => ({ default: module.DocumentDetailPage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then(module => ({ default: module.ImportPage })))
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage').then(module => ({ default: module.PlaceholderPage })))
const ViewerPage = lazy(() => import('./pages/ViewerPage').then(module => ({ default: module.ViewerPage })))

export default function App() {
  const loadWorkspace = useAppStore(state => state.loadWorkspace)

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  return (
    <Suspense fallback={<div className="route-loading">A preparar o espaço de trabalho…</div>}>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:collectionId" element={<CollectionDetailPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:documentId" element={<DocumentDetailPage />} />
          <Route path="import/:documentId" element={<ImportPage />} />
          <Route path="viewer/:pageId" element={<ViewerPage />} />
          <Route path="annotations" element={<PlaceholderPage page="annotations" />} />
          <Route path="models" element={<PlaceholderPage page="models" />} />
          <Route path="experiments" element={<PlaceholderPage page="experiments" />} />
          <Route path="settings" element={<PlaceholderPage page="settings" />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
