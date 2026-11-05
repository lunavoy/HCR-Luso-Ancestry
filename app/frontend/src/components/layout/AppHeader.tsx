import { ChevronRight, Moon, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/useAppStore'

const labels: Record<string, string> = {
  collections: 'Coleções',
  documents: 'Documentos',
  annotations: 'Anotações',
  models: 'Modelos de IA',
  experiments: 'Experimentos de treinamento',
  settings: 'Configurações',
  import: 'Importar imagens',
  viewer: 'Editor de página',
}

export function AppHeader() {
  const location = useLocation()
  const theme = useAppStore(state => state.theme)
  const toggleTheme = useAppStore(state => state.toggleTheme)
  const segments = location.pathname.split('/').filter(Boolean)

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
        <div className="user-avatar" title="Uso local, sem login">HTR</div>
      </div>
    </header>
  )
}
