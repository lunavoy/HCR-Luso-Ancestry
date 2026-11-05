import { BookOpen, ChevronRight, FileImage, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAppStore } from '../stores/useAppStore'

export function DocumentsPage() {
  const documents = useAppStore(state => state.documents)
  const pages = useAppStore(state => state.pages)
  const collections = useAppStore(state => state.collections)
  const [query, setQuery] = useState('')
  const visible = documents.filter(document => document.title.toLowerCase().includes(query.toLowerCase()) || document.archivalReference.toLowerCase().includes(query.toLowerCase()))

  return (
    <main className="page-shell">
      <section className="page-heading"><p className="eyebrow">Hierarquia documental</p><h1>Documentos</h1><p>Explore os livros e abra páginas no espaço de anotação.</p></section>
      <div className="filter-bar"><label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar título ou referência arquivística" /></label><span className="filter-count">{visible.length} livros</span></div>
      <div className="document-list">
        {visible.map(document => {
          const documentPages = pages.filter(page => page.documentId === document.id)
          return (
            <article className="document-row" key={document.id}>
              <div className="document-icon"><BookOpen size={21} /></div>
              <div><span className="overline">{document.archivalReference}</span><h3>{document.title}</h3><p>{(() => { const collection = collections.find(item => item.id === document.collectionId); return collection ? `${collection.parish}, ${collection.municipality}` : '' })()}</p></div>
              <div className="document-pages"><FileImage size={16} /><strong>{documentPages.length}</strong><span>páginas</span></div>
              <StatusBadge status={document.status} />
              <Link className="row-open" to={`/documents/${document.id}`}>Abrir <ChevronRight size={16} /></Link>
            </article>
          )
        })}
      </div>
    </main>
  )
}
