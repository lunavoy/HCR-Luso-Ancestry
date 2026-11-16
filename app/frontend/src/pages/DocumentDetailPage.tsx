import { ArrowLeft, Feather, Grid2X2, Import, List, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { StatusBadge } from '../components/ui/StatusBadge'
import { apiDataService } from '../services/dataService'
import { useAppStore } from '../stores/useAppStore'
import type { ScribeMapEntry } from '../types/domain'
import { formatBytes } from '../utils/format'

import { useWorkspaceRole } from '../components/auth/AuthProvider'

const KIND_ORDER: Record<string, number> = { Região: 0, 'Sub-região': 1, Registro: 2 }

export function DocumentDetailPage() {
  const admin = useWorkspaceRole() === 'admin'
  const [search] = useSearchParams()
  const review = search.get('review') === 'lines'
  const { documentId } = useParams()
  const document = useAppStore(state => state.documents.find(item => item.id === documentId))
  const allPages = useAppStore(state => state.pages)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [showDetails, setShowDetails] = useState(false)
  const [scribeMap, setScribeMap] = useState<ScribeMapEntry[]>([])
  const pages = useMemo(() => allPages.filter(page => page.documentId === documentId), [allPages, documentId])
  const visible = pages.filter(page => page.originalFilename.toLowerCase().includes(query.toLowerCase()) || String(page.pageNumber).includes(query))

  useEffect(() => {
    if (!showDetails || !documentId) return
    apiDataService.getDocumentScribeMap(documentId).then(setScribeMap).catch(() => setScribeMap([]))
  }, [showDetails, documentId])

  const scribeGroups = useMemo(() => {
    const byPage = new Map<string, ScribeMapEntry[]>()
    for (const entry of [...scribeMap].sort((a, b) =>
      (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9))) {
      const list = byPage.get(entry.page_label) ?? []
      list.push(entry)
      byPage.set(entry.page_label, list)
    }
    return [...byPage.entries()]
  }, [scribeMap])

  if (!document) return <main className="page-shell"><h1>Livro não encontrado</h1></main>

  return (
    <main className="page-shell">
      <Link className="back-link" to={review ? '/line-review' : admin ? `/collections/${document.collectionId}` : '/documents'}><ArrowLeft size={15} /> {admin && !review ? 'Coleção' : 'Voltar aos livros'}</Link>
      <section className="page-heading heading-with-action"><div><p className="eyebrow">{document.archivalReference}</p><h1>{document.title}</h1><p>{pages.length} páginas preservadas com os nomes de ficheiro originais.</p></div>{admin && <Link className="primary-button" to={`/import/${document.id}`}><Import size={16} /> Importar imagens</Link>}</section>

      {admin && <section className="section-block document-details">
        <label className="detail-switch">
          <input checked={showDetails} onChange={event => setShowDetails(event.target.checked)} type="checkbox" />
          <span>Exibir informações detalhadas sobre o documento</span>
        </label>
        {showDetails && (
          <div className="scribe-map">
            <p className="scribe-map-intro">
              <Feather size={14} /> Escriba atribuído a cada região — informação de nível intermediário,
              útil para historiadores e genealogistas.
            </p>
            {!scribeGroups.length && <p className="confirm-empty">Nenhuma região delimitada neste livro ainda — segmente páginas no editor.</p>}
            {scribeGroups.map(([pageLabel, entries]) => (
              <div className="scribe-page-group" key={pageLabel}>
                <h3>{pageLabel}</h3>
                <table className="scribe-table">
                  <thead><tr><th>Região</th><th>Tipo</th><th>Escriba</th><th>Função</th></tr></thead>
                  <tbody>
                    {entries.map(entry => (
                      <tr key={entry.region_id}>
                        <td>{entry.label}</td>
                        <td>{entry.kind}</td>
                        <td>{entry.scribe_name ?? '—'}</td>
                        <td>{entry.scribe_role ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>}

      <div className="filter-bar"><label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar número ou nome do ficheiro" /></label><div className="segmented-control"><button className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} title="Grade" type="button"><Grid2X2 size={16} /></button><button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} title="Lista" type="button"><List size={16} /></button></div><span className="filter-count">{visible.length} páginas</span></div>
      <div className={`pages-browser ${view}`}>
        {visible.map(page => (
          <Link className="page-card" key={page.id} to={`/viewer/${page.id}${review ? '?review=lines' : ''}`}>
            <div className="page-card-image"><img src={page.imageUrl} alt={`Placeholder da página ${page.pageNumber}`} /><span className="page-number">{String(page.pageNumber).padStart(2, '0')}</span></div>
            <div className="page-card-info"><strong>{page.originalFilename}</strong><span>{page.width} × {page.height} px · {formatBytes(page.fileSize)}</span><StatusBadge status={page.status} /></div>
          </Link>
        ))}
      </div>
    </main>
  )
}
