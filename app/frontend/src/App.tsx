import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { WorkspaceLayout } from './components/layout/WorkspaceLayout'
import { AuthPage } from './pages/AuthPage'

const OverviewPage = lazy(() => import('./pages/OverviewPage').then(module => ({ default: module.OverviewPage })))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage').then(module => ({ default: module.CollectionsPage })))
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage').then(module => ({ default: module.CollectionDetailPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then(module => ({ default: module.DocumentsPage })))
const DocumentDetailPage = lazy(() => import('./pages/DocumentDetailPage').then(module => ({ default: module.DocumentDetailPage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then(module => ({ default: module.ImportPage })))
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage').then(module => ({ default: module.PlaceholderPage })))
const ViewerPage = lazy(() => import('./pages/ViewerPage').then(module => ({ default: module.ViewerPage })))
const ValidationPage = lazy(() => import('./pages/ValidationPage').then(module => ({ default: module.ValidationPage })))
const MapPage = lazy(() => import('./pages/MapPage').then(module => ({ default: module.MapPage })))
const PlacesPage = lazy(() => import('./pages/PlacesPage').then(module => ({ default: module.PlacesPage })))
const ScribesPage = lazy(() => import('./pages/ScribesPage').then(module => ({ default: module.ScribesPage })))
const TimelinePage = lazy(() => import('./pages/TimelinePage').then(module => ({ default: module.TimelinePage })))
const RecordDetailPage = lazy(() => import('./pages/RecordDetailPage').then(module => ({ default: module.RecordDetailPage })))
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })))

// Data router (createBrowserRouter): necessário para useBlocker — o aviso
// de "sair sem salvar" do editor de página depende dele.
export const router = createBrowserRouter([
  { path: 'login', element: <AuthPage key="login" /> },
  { path: 'cadastro', element: <AuthPage key="cadastro" register /> },
  {
    element: <WorkspaceLayout />,
    children: [
      { path: 'workspace', element: <OverviewPage /> },
      { path: 'collections', element: <CollectionsPage /> },
      { path: 'collections/:collectionId', element: <CollectionDetailPage /> },
      { path: 'line-review', element: <DocumentsPage review /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/:documentId', element: <DocumentDetailPage /> },
      { path: 'import/:documentId', element: <ImportPage /> },
      { path: 'viewer/:pageId', element: <ViewerPage /> },
      { path: 'records/:recordId', element: <RecordDetailPage /> },
      { path: 'validation', element: <ValidationPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'places', element: <PlacesPage /> },
      { path: 'scribes', element: <ScribesPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'models', element: <PlaceholderPage page="models" /> },
      { path: 'experiments', element: <PlaceholderPage page="experiments" /> },
      { path: 'settings', element: <PlaceholderPage page="settings" /> },
      { path: '*', element: <Navigate replace to="/workspace" /> },
    ],
  },
])
