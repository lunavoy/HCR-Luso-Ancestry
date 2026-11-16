import { Archive, ChevronDown, ChevronRight, Filter, Pencil, Plus, Search, X } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiDataService } from '../services/dataService'
import { useAppStore } from '../stores/useAppStore'
import type { Collection, CreateCollectionInput, Place, RecordType } from '../types/domain'
import { formatDate, recordTypeLabels } from '../utils/format'

const emptyForm: CreateCollectionInput = {
  title: '',
  recordType: 'batismo',
  startDate: '',
  endDate: '',
  parish: '',
  municipality: '',
  district: '',
  placeId: null,
  notes: '',
  sourceUrl: '',
}

const BANNER = '/collections-banner.jpg'

function formatPtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

export function CollectionsPage() {
  const collections = useAppStore(state => state.collections)
  const addCollection = useAppStore(state => state.addCollection)
  const updateCollection = useAppStore(state => state.updateCollection)
  const workspaceStatus = useAppStore(state => state.workspaceStatus)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [recordType, setRecordType] = useState<'all' | RecordType>('all')
  const [parish, setParish] = useState('all')
  const [municipality, setMunicipality] = useState('all')
  const [district, setDistrict] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [manualTitle, setManualTitle] = useState(false)
  const [error, setError] = useState('')
  const [extrasOpen, setExtrasOpen] = useState(false)

  // Buscador de freguesias (places) — autocomplete com concelho/distrito.
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<Place[]>([])
  const [placeOpen, setPlaceOpen] = useState(false)
  const placeBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dialogOpen) return
    const handle = setTimeout(() => {
      const q = placeQuery.trim()
      if (q.length < 2) { setPlaceResults([]); return }
      // freguesias atuais + históricas, ordenadas por nome no backend
      Promise.all([
        apiDataService.listPlaces(q, 'freguesia_atual', 30),
        apiDataService.listPlaces(q, 'freguesia', 30),
      ]).then(([current, historic]) => {
        const merged = [...current, ...historic]
          .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
          .slice(0, 30)
        setPlaceResults(merged)
        setPlaceOpen(true)
      }).catch(() => setPlaceResults([]))
    }, 200)
    return () => clearTimeout(handle)
  }, [placeQuery, dialogOpen])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (placeBoxRef.current && !placeBoxRef.current.contains(event.target as Node)) {
        setPlaceOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const generatedTitle = useMemo(() => {
    const start = formatPtDate(form.startDate) || 'início'
    const end = formatPtDate(form.endDate) || 'fim'
    return `Livro de ${recordTypeLabels[form.recordType]} (${start}–${end}) - ${form.parish || 'Freguesia'}, ${form.municipality || 'Concelho'}, ${form.district || 'Distrito'}`
  }, [form])

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

  const selectPlace = (place: Place) => {
    setForm(current => ({
      ...current,
      placeId: place.id,
      parish: place.name,
      municipality: place.concelho_name || place.parent_name || current.municipality,
      district: place.distrito_name || current.district,
    }))
    setPlaceQuery(place.name)
    setPlaceOpen(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setManualTitle(false)
    setPlaceQuery('')
    setPlaceResults([])
    setExtrasOpen(false)
    setDialogOpen(true)
  }

  const openEdit = (collection: Collection) => {
    setEditing(collection)
    setForm({
      title: collection.title,
      recordType: collection.recordType,
      startDate: collection.startDate ?? `${collection.startYear}-01-01`,
      endDate: collection.endDate ?? `${collection.endYear}-12-31`,
      parish: collection.parish,
      municipality: collection.municipality,
      district: collection.district,
      placeId: collection.placeId ?? null,
      notes: collection.notes,
      sourceUrl: collection.sourceUrl,
    })
    setManualTitle(true)
    setPlaceQuery(collection.parish)
    setPlaceResults([])
    setExtrasOpen(Boolean(collection.sourceUrl || collection.notes))
    setDialogOpen(true)
  }

  const createCollection = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        ...form, title: manualTitle ? form.title : generatedTitle,
      }
      if (editing) {
        // place_id só vai se o usuário escolher uma freguesia — senão
        // preserva o vínculo existente.
        if (!form.placeId) delete payload.placeId
        const collection = await apiDataService.updateCollection(editing.id, payload)
        updateCollection(collection)
      } else {
        const collection = await apiDataService.createCollection(payload)
        addCollection(collection)
      }
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      setManualTitle(false)
      setPlaceQuery('')
      setPlaceResults([])
      setExtrasOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível guardar a coleção.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="collections-banner" style={{ backgroundImage: `url(${BANNER})` }}>
        <div className="collections-banner-content">
          <div>
            <p className="eyebrow">Acervo documental</p>
            <h1>Coleções</h1>
            <p>Organize livros por proveniência, tipologia e período histórico.</p>
          </div>
          <button className="primary-button banner-button" onClick={openCreate} type="button"><Plus size={17} /> Adicionar coleção</button>
        </div>
      </section>
      <div className="filter-bar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar coleção, freguesia ou concelho" /></label>
        <label className="select-field"><Filter size={16} /><select value={recordType} onChange={event => setRecordType(event.target.value as typeof recordType)}><option value="all">Todos os tipos</option><option value="batismo">Batismos</option><option value="casamento">Casamentos</option><option value="obito">Óbitos</option></select><ChevronDown size={14} /></label>
        <label className="select-field compact"><select aria-label="Filtrar por freguesia" value={parish} onChange={event => setParish(event.target.value)}><option value="all">Freguesias</option>{[...new Set(collections.map(collection => collection.parish))].sort((a, b) => a.localeCompare(b, 'pt')).map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <label className="select-field compact"><select aria-label="Filtrar por concelho" value={municipality} onChange={event => setMunicipality(event.target.value)}><option value="all">Concelhos</option>{[...new Set(collections.map(collection => collection.municipality))].sort((a, b) => a.localeCompare(b, 'pt')).map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <label className="select-field compact"><select aria-label="Filtrar por distrito" value={district} onChange={event => setDistrict(event.target.value)}><option value="all">Distritos</option>{[...new Set(collections.map(collection => collection.district))].sort((a, b) => a.localeCompare(b, 'pt')).map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <span className="filter-count">{visibleCollections.length} {visibleCollections.length === 1 ? 'coleção' : 'coleções'}</span>
      </div>

      <div className="data-table collection-table">
        <div className="table-header"><span>Coleção</span><span>Localização</span><span>Conteúdo</span><span>Atualizada</span><span /></div>
        {visibleCollections.map(collection => (
          <Link className="table-row" key={collection.id} to={`/collections/${collection.id}`}>
            <div className="collection-cell"><span className="row-icon"><Archive size={18} /></span><div><strong>{collection.title}</strong><small>{recordTypeLabels[collection.recordType]}</small></div></div>
            <div><strong>{collection.parish}, {collection.municipality}</strong><small>{collection.district}</small></div>
            <div><strong>{collection.documentIds.length} livros</strong><small>{collection.pageCount} páginas</small></div>
            <div><strong>{formatDate(collection.updatedAt)}</strong><small>{collection.pageCount} páginas</small></div>
            <span className="row-actions">
              <button className="icon-button bare" title="Editar coleção" type="button"
                onClick={event => { event.preventDefault(); event.stopPropagation(); openEdit(collection) }}>
                <Pencil size={15} />
              </button>
              <span className="row-action">Abrir <ChevronDown size={15} /></span>
            </span>
          </Link>
        ))}
        {workspaceStatus === 'ready' && visibleCollections.length === 0 && (
          <EmptyState icon={<Archive size={22} />} title={collections.length ? 'Nenhuma coleção corresponde aos filtros' : 'Ainda não há coleções'} description={collections.length ? 'Limpe a pesquisa ou os filtros.' : 'Adicione a primeira coleção para começar a importar páginas.'} />
        )}
      </div>

      {dialogOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setDialogOpen(false)}>
          <form className="dialog collection-dialog" onSubmit={createCollection}>
            <div className="dialog-header"><div><span className="eyebrow">{editing ? 'Editar estrutura documental' : 'Nova estrutura documental'}</span><h2>{editing ? 'Editar coleção' : 'Adicionar coleção'}</h2></div><button className="icon-button bare" onClick={() => setDialogOpen(false)} type="button"><X size={19} /></button></div>
            <div className="form-grid">
              <label><span>Tipo de registro</span><select value={form.recordType} onChange={event => updateForm('recordType', event.target.value as RecordType)}><option value="batismo">Batismos</option><option value="casamento">Casamentos</option><option value="obito">Óbitos</option></select></label>
              <div className="field-pair">
                <label><span>Período inicial</span><input required type="date" value={form.startDate} onChange={event => updateForm('startDate', event.target.value)} /></label>
                <label><span>Período final</span><input required type="date" value={form.endDate} onChange={event => updateForm('endDate', event.target.value)} /></label>
              </div>
              <div className="full-field place-picker" ref={placeBoxRef}>
                <span>Freguesia</span>
                <input
                  type="search"
                  value={placeQuery}
                  onChange={event => { setPlaceQuery(event.target.value); setPlaceOpen(true) }}
                  onFocus={() => placeQuery.trim().length >= 2 && setPlaceOpen(true)}
                  placeholder="Pesquisar freguesia (ex.: Tinhela)…"
                  autoComplete="off"
                />
                {placeOpen && placeResults.length > 0 && (
                  <ul className="place-results">
                    {placeResults.map(place => (
                      <li key={place.id}>
                        <button type="button" onClick={() => selectPlace(place)}>
                          <strong>{place.name}</strong>
                          <small>{[place.concelho_name || place.parent_name, place.distrito_name].filter(Boolean).join(' · ')}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {placeOpen && placeQuery.trim().length >= 2 && placeResults.length === 0 && (
                  <p className="place-empty">Nenhuma freguesia encontrada.</p>
                )}
                <small>Ao escolher, concelho e distrito são preenchidos automaticamente.</small>
              </div>
              <label><span>Concelho</span><input required value={form.municipality} onChange={event => updateForm('municipality', event.target.value)} placeholder="Preenchido pela freguesia" /></label>
              <label><span>Distrito</span><input required value={form.district} onChange={event => updateForm('district', event.target.value)} placeholder="Preenchido pela freguesia" /></label>
              <label className="full-field"><span>Título da coleção</span><input value={manualTitle ? form.title : generatedTitle} onFocus={() => { setManualTitle(true); setForm(current => ({ ...current, title: generatedTitle })) }} onChange={event => updateForm('title', event.target.value)} /><small>Gerado automaticamente no formato «Livro de tipo (datas) – Freguesia, Concelho, Distrito». Pode ser editado.</small></label>
              <div className="full-field">
                <button className="extras-toggle" type="button" onClick={() => setExtrasOpen(open => !open)} aria-expanded={extrasOpen}>
                  {extrasOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  Mais informações <small>(opcional)</small>
                </button>
                {extrasOpen && (
                  <div className="extras-fields">
                    <label><span>URL do livro</span><input type="url" value={form.sourceUrl} onChange={event => updateForm('sourceUrl', event.target.value)} placeholder="https://…" /></label>
                    <label className="full-field"><span>Observações</span><textarea value={form.notes} onChange={event => updateForm('notes', event.target.value)} rows={3} /></label>
                  </div>
                )}
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="dialog-footer"><button className="secondary-button" onClick={() => setDialogOpen(false)} type="button">Cancelar</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'A guardar…' : editing ? 'Guardar alterações' : 'Adicionar coleção'}</button></div>
          </form>
        </div>
      )}
    </main>
  )
}
