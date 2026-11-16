import { ArrowLeft, BookOpen, ExternalLink, FileImage, Import, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiDataService } from '../services/dataService'
import { useAppStore } from '../stores/useAppStore'
import type { CreateDocumentInput, RecordType, Scribe } from '../types/domain'
import { recordTypeLabels } from '../utils/format'
import { StatusBadge } from '../components/ui/StatusBadge'

function ScribePicker({ selected, scribes, disabled, onChange }: {
  selected: string[]
  scribes: Scribe[]
  disabled?: boolean
  onChange: (ids: string[]) => void
}) {
  const names = scribes.filter(s => selected.includes(s.id)).map(s => s.name)
  return (
    <details className="scribe-picker">
      <summary className={names.length ? '' : 'is-empty'}>
        {names.length ? names.join(' · ') : 'Escribas: por identificar…'}
      </summary>
      <div className="scribe-picker-list">
        {scribes.map(scribe => (
          <label key={scribe.id} className="scribe-option">
            <input
              type="checkbox"
              checked={selected.includes(scribe.id)}
              disabled={disabled}
              onChange={event => onChange(
                event.target.checked
                  ? [...selected, scribe.id]
                  : selected.filter(id => id !== scribe.id),
              )}
            />
            <span>{scribe.name}</span>
          </label>
        ))}
        {!scribes.length && <small>Cadastre padres na página Padres primeiro.</small>}
      </div>
    </details>
  )
}

export function CollectionDetailPage() {
  const { collectionId } = useParams()
  const collection = useAppStore(state => state.collections.find(item => item.id === collectionId))
  const allDocuments = useAppStore(state => state.documents)
  const pages = useAppStore(state => state.pages)
  const addDocument = useAppStore(state => state.addDocument)
  const workspaceStatus = useAppStore(state => state.workspaceStatus)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateDocumentInput>({
    collectionId: collectionId ?? '',
    title: '',
    recordType: 'batismo',
    startYear: 1900,
    endYear: 1900,
    archivalReference: '',
    sourceUrl: '',
    scribeId: null,
    scribeIds: [],
  })
  const [scribes, setScribes] = useState<Scribe[]>([])
  const [assigningScribe, setAssigningScribe] = useState('')

  useEffect(() => {
    apiDataService.listScribes().then(setScribes).catch(() => setScribes([]))
  }, [])
  const documents = useMemo(
    () => allDocuments.filter(document => document.collectionId === collectionId),
    [allDocuments, collectionId],
  )

  if (!collection) return <main className="page-shell"><h1>{workspaceStatus === 'loading' || workspaceStatus === 'idle' ? 'A carregar coleção…' : 'Coleção não encontrada'}</h1></main>

  const openDialog = () => {
    setForm(current => ({ ...current, collectionId: collection.id, recordType: collection.recordType, startYear: collection.startYear || current.startYear, endYear: collection.startYear || current.endYear }))
    setError('')
    setDialogOpen(true)
  }

  const updateForm = <K extends keyof CreateDocumentInput>(key: K, value: CreateDocumentInput[K]) =>
    setForm(current => ({ ...current, [key]: value }))

  const createDocument = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const document = await apiDataService.createDocument(form)
      addDocument(document)
      setDialogOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar o livro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell">
      <Link className="back-link" to="/collections"><ArrowLeft size={15} /> Coleções</Link>
      <section className="detail-hero">
        <div className="detail-symbol"><BookOpen size={27} /></div>
        <div className="detail-title"><p className="eyebrow">Coleção · {recordTypeLabels[collection.recordType] ?? collection.recordType}</p><h1>{collection.title}</h1><p>{collection.notes}</p><div className="metadata-line"><span>{collection.parish}</span><span>{collection.municipality}</span><span>{collection.district}</span>{collection.sourceUrl && <a href={collection.sourceUrl} target="_blank" rel="noreferrer">Fonte digital <ExternalLink size={13} /></a>}</div></div>
        <div className="detail-actions">{documents[0] && <Link className="secondary-button" to={`/import/${documents[0].id}`}><Import size={16} /> Importar imagens</Link>}<button className="primary-button" onClick={openDialog} type="button"><Plus size={16} /> Novo livro</button></div>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><h2>Livros da coleção</h2><p>{documents.length ? `${documents.length} volumes catalogados por ano.` : 'Cadastre um livro para poder importar as imagens das páginas.'}</p></div></div>
        <div className="book-grid">
          {documents.map(document => {
            const documentPages = pages.filter(page => page.documentId === document.id)
            return (
              <article className="book-card" key={document.id}>
                <div className="book-spine"><span>{document.startYear}</span></div>
                <div className="book-card-content">
                  <div className="book-card-top"><span className="overline">Livro paroquial</span><StatusBadge status={document.status} /></div>
                  <h3>{document.title}</h3>
                  <p className="archive-reference">{document.archivalReference}</p>
                  <div className="scribe-field"><span>Escribas / párocos que escreveram este livro</span>
                    <ScribePicker
                      selected={(document.scribes?.length
                        ? document.scribes.map(s => s.id)
                        : document.scribeId ? [document.scribeId] : [])}
                      scribes={scribes}
                      disabled={assigningScribe === document.id}
                      onChange={async ids => {
                        setAssigningScribe(document.id)
                        try {
                          await apiDataService.updateDocument(document.id, { scribeIds: ids })
                          const attached = scribes.filter(s => ids.includes(s.id))
                            .map((s, i) => ({ id: s.id, name: s.name, is_primary: i === 0 }))
                          useAppStore.setState(state => ({ documents: state.documents.map(item => item.id === document.id
                            ? { ...item, scribeId: ids[0] ?? null, scribes: attached }
                            : item) }))
                        } catch { /* mantém valor anterior */ }
                        setAssigningScribe('')
                      }}
                    />
                    <small>{document.scribes?.length
                      ? document.scribes.map(s => s.name).join(' · ')
                      : 'Um livro pode ter mais de um padre — marque todos que assinam nele.'}</small>
                  </div>
                  <div className="book-metrics"><span><FileImage size={15} /> {documentPages.length} páginas</span><span>{documentPages.filter(page => page.status === 'reviewed').length} revistas</span></div>
                  <div className="book-actions"><Link className="secondary-button" to={`/documents/${document.id}`}>Explorar páginas</Link>{documentPages[0] ? <Link className="icon-button always-visible" to={`/viewer/${documentPages[0].id}`} title="Abrir no editor"><ExternalLink size={16} /></Link> : <Link className="icon-button always-visible" to={`/import/${document.id}`} title="Importar imagens"><Import size={16} /></Link>}</div>
                </div>
              </article>
            )
          })}
        </div>
      </section>
      {dialogOpen && (
        <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setDialogOpen(false)} role="presentation">
          <form className="dialog" onSubmit={createDocument}>
            <div className="dialog-header"><div><p className="eyebrow">{collection.title}</p><h2>Cadastrar livro</h2></div><button className="icon-button bare" onClick={() => setDialogOpen(false)} type="button"><X size={18} /></button></div>
            <div className="form-grid">
              <label><span>Título</span><input required value={form.title} onChange={event => updateForm('title', event.target.value)} placeholder="Ex.: Batismos de 1911" /></label>
              <label><span>Tipo documental</span><select value={form.recordType} onChange={event => updateForm('recordType', event.target.value as RecordType)}><option value="batismo">Batismos</option><option value="casamento">Casamentos</option><option value="obito">Óbitos</option></select></label>
              <div className="field-pair"><label><span>Ano inicial</span><input type="number" value={form.startYear} onChange={event => updateForm('startYear', Number(event.target.value))} /></label><label><span>Ano final</span><input type="number" value={form.endYear} onChange={event => updateForm('endYear', Number(event.target.value))} /></label></div>
              <label><span>Referência arquivística</span><input required value={form.archivalReference} onChange={event => updateForm('archivalReference', event.target.value)} placeholder="PT/ADVRL/PRQ/…" /></label>
              <div className="full-field"><span className="field-caption">Escribas / párocos (opcional — marque todos que escrevem no livro)</span>
                <ScribePicker selected={form.scribeIds ?? (form.scribeId ? [form.scribeId] : [])} scribes={scribes}
                  onChange={ids => setForm(current => ({ ...current, scribeIds: ids, scribeId: ids[0] ?? null }))} />
              </div>
              <label className="full-field"><span>URL da fonte</span><input type="url" value={form.sourceUrl} onChange={event => updateForm('sourceUrl', event.target.value)} placeholder="https://…" /></label>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="dialog-footer"><button className="secondary-button" onClick={() => setDialogOpen(false)} type="button">Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'A cadastrar…' : 'Cadastrar livro'}</button></div>
          </form>
        </div>
      )}
    </main>
  )
}
