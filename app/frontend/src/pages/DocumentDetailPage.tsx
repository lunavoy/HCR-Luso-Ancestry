import { ArrowLeft, Grid2X2, Import, List, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAppStore } from '../stores/useAppStore'
import { formatBytes } from '../utils/format'

export function DocumentDetailPage() {
  const { documentId } = useParams()
  const document = useAppStore(state => state.documents.find(item => item.id === documentId))
  const allPages = useAppStore(state => state.pages)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const pages = useMemo(() => allPages.filter(page => page.documentId === documentId), [allPages, documentId])
  const visible = pages.filter(page => page.originalFilename.toLowerCase().includes(query.toLowerCase()) || String(page.pageNumber).includes(query))

  if (!document) return <main className="page-shell"><h1>Livro não encontrado</h1></main>

  return (
    <main className="page-shell">
      <Link className="back-link" to={`/collections/${document.collectionId}`}><ArrowLeft size={15} /> Coleção</Link>
      <section className="page-heading heading-with-action"><div><p className="eyebrow">{document.archivalReference}</p><h1>{document.title}</h1><p>{pages.length} páginas preservadas com os nomes de ficheiro originais.</p></div><Link className="primary-button" to={`/import/${document.id}`}><Import size={16} /> Importar imagens</Link></section>
      <div className="filter-bar"><label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar número ou nome do ficheiro" /></label><div className="segmented-control"><button className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} title="Grade" type="button"><Grid2X2 size={16} /></button><button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} title="Lista" type="button"><List size={16} /></button></div><span className="filter-count">{visible.length} páginas</span></div>
      <div className={`pages-browser ${view}`}>
        {visible.map(page => (
          <Link className="page-card" key={page.id} to={`/viewer/${page.id}`}>
            <div className="page-card-image"><img src={page.imageUrl} alt={`Placeholder da página ${page.pageNumber}`} /><span className="page-number">{String(page.pageNumber).padStart(2, '0')}</span></div>
            <div className="page-card-info"><strong>{page.originalFilename}</strong><span>{page.width} × {page.height} px · {formatBytes(page.fileSize)}</span><StatusBadge status={page.status} /></div>
          </Link>
        ))}
      </div>
    </main>
  )
}
