import { Archive, ChevronDown, Filter, Plus, Search, X } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiDataService } from '../services/dataService'
import { useAppStore } from '../stores/useAppStore'
import type { CreateCollectionInput, RecordType } from '../types/domain'
import { formatDate, recordTypeLabels } from '../utils/format'

const emptyForm: CreateCollectionInput = {
  title: '',
  recordType: 'batismo',
  startYear: 1900,
  endYear: 1910,
  parish: '',
  municipality: '',
  district: '',
  notes: '',
  sourceUrl: '',
}

export function CollectionsPage() {
  const collections = useAppStore(state => state.collections)
  const addCollection = useAppStore(state => state.addCollection)
  const workspaceStatus = useAppStore(state => state.workspaceStatus)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [recordType, setRecordType] = useState<'all' | RecordType>('all')
  const [parish, setParish] = useState('all')
  const [municipality, setMunicipality] = useState('all')
  const [district, setDistrict] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [manualTitle, setManualTitle] = useState(false)
  const [error, setError] = useState('')

  const generatedTitle = `Livro de ${recordTypeLabels[form.recordType]} (${form.startYear}–${form.endYear}) - ${form.parish || 'Freguesia'}, ${form.municipality || 'Concelho'}, ${form.district || 'Distrito'}`
  const visibleCollections = useMemo(() => collections.filter(collection => {
    const normalizedQuery = query.toLocaleLowerCase('pt')
    const matchesQuery = [collection.title, collection.parish, collection.municipality, collection.district].some(value => value.toLocaleLowerCase('pt').includes(normalizedQuery))
    return matchesQuery
      && (recordType === 'all' || collection.recordType === recordType)
      && (parish === 'all' || collection.parish === parish)
      && (municipality === 'all' || collection.municipality === municipality)
      && (district === 'all' || collection.district === district)
  }), [collections, district, municipality, parish, query, recordType])

  const updateForm = <K extends keyof CreateCollectionInput>(key: K, value: CreateCollectionInput[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const createCollection = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const collection = await apiDataService.createCollection({
        ...form, title: manualTitle ? form.title : generatedTitle,
      })
      addCollection(collection)
      setDialogOpen(false)
      setForm(emptyForm)
      setManualTitle(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a coleção.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="page-heading heading-with-action">
        <div><p className="eyebrow">Acervo documental</p><h1>Coleções</h1><p>Organize livros por proveniência, tipologia e período histórico.</p></div>
        <button className="primary-button" onClick={() => setDialogOpen(true)} type="button"><Plus size={17} /> Criar coleção</button>
      </section>
      <div className="filter-bar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar coleção, freguesia ou concelho" /></label>
        <label className="select-field"><Filter size={16} /><select value={recordType} onChange={event => setRecordType(event.target.value as typeof recordType)}><option value="all">Todos os tipos</option><option value="batismo">Batismos</option><option value="casamento">Casamentos</option><option value="obito">Óbitos</option></select><ChevronDown size={14} /></label>
        <label className="select-field compact"><select aria-label="Filtrar por freguesia" value={parish} onChange={event => setParish(event.target.value)}><option value="all">Freguesias</option>{[...new Set(collections.map(collection => collection.parish))].map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <label className="select-field compact"><select aria-label="Filtrar por concelho" value={municipality} onChange={event => setMunicipality(event.target.value)}><option value="all">Concelhos</option>{[...new Set(collections.map(collection => collection.municipality))].map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <label className="select-field compact"><select aria-label="Filtrar por distrito" value={district} onChange={event => setDistrict(event.target.value)}><option value="all">Distritos</option>{[...new Set(collections.map(collection => collection.district))].map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <span className="filter-count">{visibleCollections.length} {visibleCollections.length === 1 ? 'coleção' : 'coleções'}</span>
      </div>

      <div className="data-table collection-table">
        <div className="table-header"><span>Coleção</span><span>Localização</span><span>Conteúdo</span><span>Atualizada</span><span /></div>
        {visibleCollections.map(collection => (
          <Link className="table-row" key={collection.id} to={`/collections/${collection.id}`}>
            <div className="collection-cell"><span className="row-icon"><Archive size={18} /></span><div><strong>{collection.title}</strong><small>{recordTypeLabels[collection.recordType]} · {collection.startYear}–{collection.endYear}</small></div></div>
            <div><strong>{collection.parish}, {collection.municipality}</strong><small>{collection.district}</small></div>
            <div><strong>{collection.documentIds.length} livros</strong><small>{collection.pageCount} páginas</small></div>
            <div><strong>{formatDate(collection.updatedAt)}</strong><small>{collection.pageCount} páginas</small></div>
            <span className="row-action">Abrir <ChevronDown size={15} /></span>
          </Link>
        ))}
        {workspaceStatus === 'ready' && visibleCollections.length === 0 && (
          <EmptyState icon={<Archive size={22} />} title={collections.length ? 'Nenhuma coleção corresponde aos filtros' : 'Ainda não há coleções'} description={collections.length ? 'Limpe a pesquisa ou os filtros.' : 'Crie a primeira coleção para começar a importar páginas.'} />
        )}
      </div>

      {dialogOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setDialogOpen(false)}>
          <form className="dialog collection-dialog" onSubmit={createCollection}>
            <div className="dialog-header"><div><span className="eyebrow">Nova estrutura documental</span><h2>Criar coleção</h2></div><button className="icon-button bare" onClick={() => setDialogOpen(false)} type="button"><X size={19} /></button></div>
            <div className="form-grid">
              <label><span>Tipo de registro</span><select value={form.recordType} onChange={event => updateForm('recordType', event.target.value as RecordType)}><option value="batismo">Batismos</option><option value="casamento">Casamentos</option><option value="obito">Óbitos</option></select></label>
              <div className="field-pair"><label><span>Período inicial</span><input type="number" value={form.startYear} onChange={event => updateForm('startYear', Number(event.target.value))} /></label><label><span>Período final</span><input type="number" value={form.endYear} onChange={event => updateForm('endYear', Number(event.target.value))} /></label></div>
              <label><span>Freguesia</span><input required value={form.parish} onChange={event => updateForm('parish', event.target.value)} placeholder="Ex.: Tinhela" /></label>
              <label><span>Concelho</span><input required value={form.municipality} onChange={event => updateForm('municipality', event.target.value)} placeholder="Ex.: Valpaços" /></label>
              <label><span>Distrito</span><input required value={form.district} onChange={event => updateForm('district', event.target.value)} placeholder="Ex.: Vila Real" /></label>
              <label><span>URL de origem</span><input type="url" value={form.sourceUrl} onChange={event => updateForm('sourceUrl', event.target.value)} placeholder="https://…" /></label>
              <label className="full-field"><span>Título da coleção</span><input value={manualTitle ? form.title : generatedTitle} onFocus={() => { setManualTitle(true); setForm(current => ({ ...current, title: generatedTitle })) }} onChange={event => updateForm('title', event.target.value)} /><small>Gerado automaticamente. Pode ser editado.</small></label>
              <label className="full-field"><span>Observações</span><textarea value={form.notes} onChange={event => updateForm('notes', event.target.value)} rows={3} /></label>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="dialog-footer"><button className="secondary-button" onClick={() => setDialogOpen(false)} type="button">Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'A criar…' : 'Criar coleção'}</button></div>
          </form>
        </div>
      )}
    </main>
  )
}
