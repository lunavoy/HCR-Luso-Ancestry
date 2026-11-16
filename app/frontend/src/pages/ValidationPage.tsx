import { ChevronRight, FileCheck, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiDataService } from '../services/dataService'
import type { PageSummary } from '../types/domain'
import { recordTypeOntologyLabels } from '../utils/format'

interface ValidationRow {
  key: string
  page: PageSummary
  record: { id: string; record_type?: string; record_label?: string; display_label?: string }
}

export function ValidationPage() {
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    apiDataService.listPageSummary()
      .then(setPages)
      .catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar as validações.'))
      .finally(() => setLoading(false))
  }, [])

  // Só registros de páginas com todas as linhas revistas entram na fila
  // de validação — palavras não bloqueiam (o treino usa linha+texto).
  const rows = useMemo<ValidationRow[]>(() => pages
    .filter(page => page.status === 'complete')
    .flatMap(page => (page.records ?? []).map((record, index) => ({
      key: `${page.page_id}-${record.id}-${index}`,
      page,
      record,
    }))), [pages])

  const visible = useMemo(() => rows.filter(({ page, record }) => {
    const text = `${page.document_title ?? ''} ${page.filename ?? ''} Pág. ${page.page_number ?? ''} ${record.record_label ?? ''}`.toLowerCase()
    return text.includes(query.toLowerCase())
  }), [rows, query])

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Segunda etapa: dados estruturados</p>
        <h1>Validação</h1>
        <p>Registros de páginas com todas as linhas revistas. Aqui você marca na transcrição o que cada trecho significa — nome, data, local — e isso treina a IA de sintaxe.</p>
      </section>
      <div className="filter-bar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar livro, página ou arquivo" /></label>
        <span className="filter-count">{visible.length} registros prontos para validar</span>
      </div>
      {error && <p className="saved-toast">{error}</p>}
      {loading && <p className="filter-count">A carregar…</p>}
      <div className="document-list">
        {visible.map(({ key, page, record }) => (
          <article className="document-row" key={key}>
            <div className="document-icon"><FileCheck size={21} /></div>
            <div>
              <span className="overline">{page.document_title} · Pág. {page.page_number ?? '?'}{page.filename ? ` · ${page.filename}` : ''}</span>
              <h3>{record.display_label ?? `${recordTypeOntologyLabels[record.record_type ?? ''] ?? record.record_type ?? 'Registro'}${record.record_label ? ` — ${record.record_label}` : ''}`}</h3>
              <p>{page.lines_done}/{page.lines_total} linhas revistas{page.words_done < page.words_total ? ` · ${page.words_done}/${page.words_total} palavras` : ''}</p>
            </div>
            <span className="status-badge status-verified">Linhas revistas</span>
            <div className="row-actions">
              <Link
                className="secondary-button"
                title="Abrir a validação dos dados estruturados deste registro"
                to={`/records/${record.id}`}
              >Validar dados</Link>
              <Link className="row-open" to={`/viewer/${page.page_id}`}>Abrir <ChevronRight size={16} /></Link>
            </div>
          </article>
        ))}
        {!loading && !visible.length && <p className="filter-count">Nenhum registro pronto para validar — confirme todas as linhas de uma página primeiro.</p>}
      </div>
    </main>
  )
}
