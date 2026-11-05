import { ArrowRight, BookOpen, CheckCircle2, Clock3, FileImage, ScanLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/useAppStore'
import { StatusBadge } from '../components/ui/StatusBadge'
import { formatDate } from '../utils/format'

export function OverviewPage() {
  const collections = useAppStore(state => state.collections)
  const documents = useAppStore(state => state.documents)
  const pages = useAppStore(state => state.pages)
  const recentPages = pages.slice(0, 4)

  return (
    <main className="page-shell overview-page">
      <section className="page-heading heading-with-action">
        <div>
          <p className="eyebrow">Espaço de investigação</p>
          <h1>Bom trabalho.</h1>
          <p>Continue a descrição dos livros paroquiais ou abra uma página recente.</p>
        </div>
        {pages[0] && <Link className="primary-button" to={`/viewer/${pages[0].id}`}>
          <ScanLine size={17} />
          Abrir editor
        </Link>}
      </section>

      <section className="work-summary" aria-label="Resumo do acervo">
        <div><BookOpen size={18} /><span><strong>{collections.length}</strong> coleção ativa</span></div>
        <div><FileImage size={18} /><span><strong>{documents.length}</strong> livros catalogados</span></div>
        <div><Clock3 size={18} /><span><strong>{pages.filter(page => page.status === 'partial').length}</strong> páginas em revisão</span></div>
        <div><CheckCircle2 size={18} /><span><strong>{pages.filter(page => page.status === 'reviewed').length}</strong> páginas revistas</span></div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Coleção em foco</h2>
            <p>Acesso direto à estrutura documental ativa.</p>
          </div>
          <Link className="text-link" to="/collections">Ver coleções <ArrowRight size={15} /></Link>
        </div>
        {collections.map(collection => (
          <Link className="focus-collection" key={collection.id} to={`/collections/${collection.id}`}>
            <div className="collection-monogram">{collection.recordType.slice(0, 2).toUpperCase()}</div>
            <div className="focus-collection-main">
              <span className="overline">{collection.recordType} · {collection.startYear}–{collection.endYear}</span>
              <h3>{collection.title}</h3>
              <p>{collection.parish} · {collection.municipality} · {collection.district}</p>
            </div>
            <div className="focus-meta"><strong>{collection.documentIds.length}</strong><span>livros</span></div>
            <div className="focus-meta"><strong>{collection.pageCount}</strong><span>páginas</span></div>
            <ArrowRight className="focus-arrow" size={20} />
          </Link>
        ))}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Páginas recentes</h2>
            <p>Últimos documentos abertos nesta sessão.</p>
          </div>
          <Link className="text-link" to="/documents">Todos os documentos <ArrowRight size={15} /></Link>
        </div>
        <div className="recent-pages">
          {recentPages.map(page => (
            <Link className="recent-page-row" key={page.id} to={`/viewer/${page.id}`}>
              <div className="page-thumb mini"><img src={page.imageUrl} alt="" /></div>
              <div className="recent-page-name">
                <strong>{page.originalFilename}</strong>
                <span>Batismos de {documents.find(document => document.id === page.documentId)?.startYear} · Página {page.pageNumber}</span>
              </div>
              <StatusBadge status={page.status} />
              <time>{formatDate(page.importedAt)}</time>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
