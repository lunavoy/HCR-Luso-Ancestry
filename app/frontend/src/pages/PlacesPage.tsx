import { ChevronDown, Pencil, Plus, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { apiDataService } from '../services/dataService'
import type { Place } from '../types/domain'

const KIND_LABELS: Record<string, string> = {
  regiao_atual: 'Região autónoma',
  distrito_atual: 'Distrito',
  concelho_atual: 'Concelho',
  freguesia_atual: 'Freguesia atual',
  freguesia: 'Freguesia histórica',
  concelho: 'Concelho histórico',
  distrito: 'Distrito histórico',
  aldeia: 'Aldeia',
  lugar: 'Lugar',
  outro: 'Outro',
}

const KIND_OPTIONS = Object.keys(KIND_LABELS)

const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind

interface PlaceForm {
  name: string
  kind: string
  parentId: string
  parentName: string
  freguesiaCode: string
  concelhoCode: string
  distritoCode: string
  aliases: string
  validFrom: string
  validTo: string
  notes: string
}

const emptyForm: PlaceForm = {
  name: '', kind: 'lugar', parentId: '', parentName: '',
  freguesiaCode: '', concelhoCode: '', distritoCode: '',
  aliases: '', validFrom: '', validTo: '', notes: '',
}

function toForm(place: Place | null): PlaceForm {
  if (!place) return emptyForm
  return {
    name: place.name, kind: place.kind,
    parentId: place.parent_id ?? '', parentName: place.parent_name ?? '',
    freguesiaCode: place.freguesia_code ?? '',
    concelhoCode: place.concelho_code ?? '',
    distritoCode: place.distrito_code ?? '',
    aliases: (place.aliases ?? []).join(', '),
    validFrom: place.valid_from ?? '', validTo: place.valid_to ?? '',
    notes: place.notes ?? '',
  }
}

export function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Place | 'new' | null>(null)
  const [form, setForm] = useState<PlaceForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [parentResults, setParentResults] = useState<Place[]>([])
  const [parentOpen, setParentOpen] = useState(false)
  const parentBoxRef = useRef<HTMLDivElement>(null)

  const load = (q: string, k: string) => {
    setLoading(true)
    apiDataService.listPlaces(q, k)
      .then(setPlaces)
      .catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar lugares.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => load(query, kind), query ? 300 : 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind])

  // autocomplete do lugar-pai
  useEffect(() => {
    if (!parentOpen || editing === null) return
    if (!form.parentName.trim()) { setParentResults([]); return }
    const timer = window.setTimeout(() => {
      apiDataService.listPlaces(form.parentName, '').then(rows =>
        setParentResults(rows.filter(row => row.id !== (editing === 'new' ? '' : (editing as Place).id))))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [form.parentName, parentOpen, editing])

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!parentBoxRef.current?.contains(event.target as Node)) setParentOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])

  const openEditor = (place: Place | 'new') => {
    setEditing(place)
    setForm(toForm(place === 'new' ? null : place))
    setParentResults([])
    setParentOpen(false)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      parent_id: form.parentId || null,
      freguesia_code: form.freguesiaCode.trim() || null,
      concelho_code: form.concelhoCode.trim() || null,
      distrito_code: form.distritoCode.trim() || null,
      aliases: form.aliases.split(',').map(a => a.trim()).filter(Boolean),
      valid_from: form.validFrom || null,
      valid_to: form.validTo || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (editing === 'new') await apiDataService.createPlace(payload)
      else if (editing) await apiDataService.updatePlace(editing.id, payload)
      setEditing(null)
      load(query, kind)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao guardar o lugar.')
    } finally {
      setSaving(false)
    }
  }

  const validity = (place: Place) => {
    if (!place.valid_from && !place.valid_to) return '—'
    return `${place.valid_from ?? '…'} → ${place.valid_to ?? 'atual'}`
  }

  return (
    <main className="page-shell">
      <section className="page-heading heading-with-action">
        <div>
          <p className="eyebrow">Topónimos</p>
          <h1>Lugares</h1>
          <p>Freguesias, aldeias e lugares citados nos documentos — atuais e históricos. O código CAOP liga cada lugar à freguesia atual que o contém (usado no mapa).</p>
        </div>
        <button className="primary-button" onClick={() => openEditor('new')} type="button"><Plus size={17} /> Novo lugar</button>
      </section>

      <div className="filter-bar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar lugar ou alias (ex.: Monte de Arcas)" /></label>
        <label className="select-field"><select value={kind} onChange={event => setKind(event.target.value)} aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>{KIND_OPTIONS.map(k => <option key={k} value={k}>{kindLabel(k)}</option>)}</select><ChevronDown size={14} /></label>
        <span className="filter-count">{places.length} lugares</span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="data-table">
        <div className="table-header places-header"><span>Lugar</span><span>Dentro de</span><span>Códigos CAOP</span><span>Vigência</span><span /></div>
        {places.map(place => (
          <div className="table-row places-row" key={place.id}>
            <div>
              <strong>{place.name}</strong>
              <small>{kindLabel(place.kind)}{place.aliases?.length ? ` · também: ${place.aliases.join(', ')}` : ''}</small>
            </div>
            <div><small>{place.parent_name ?? '—'}</small></div>
            <div><small className="mono">{[place.freguesia_code, place.concelho_code, place.distrito_code].filter(Boolean).join(' · ') || '—'}</small></div>
            <div><small>{validity(place)}</small></div>
            <div><button className="icon-button bare" onClick={() => openEditor(place)} title="Editar lugar" type="button"><Pencil size={15} /></button></div>
          </div>
        ))}
        {!loading && !places.length && (
          <div className="empty-state"><p>Nenhum lugar encontrado. Cadastre um lugar histórico ou ajuste a busca.</p></div>
        )}
        {loading && <div className="empty-state"><p>A pesquisar…</p></div>}
      </div>

      {editing !== null && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setEditing(null)}>
          <form className="dialog" onSubmit={save}>
            <div className="dialog-header">
              <div><span className="eyebrow">{editing === 'new' ? 'Novo topónimo' : 'Editar lugar'}</span><h2>{editing === 'new' ? 'Cadastrar lugar' : form.name}</h2></div>
              <button className="icon-button bare" onClick={() => setEditing(null)} type="button"><X size={19} /></button>
            </div>
            <p className="dialog-hint">Para lugares históricos (freguesias extintas, aldeias anexadas), preencha os códigos CAOP da freguesia atual que os contém — é isso que posiciona o lugar no mapa.</p>
            <div className="form-grid">
              <label><span>Nome</span><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Monte de Arcas" /></label>
              <label><span>Tipo</span><select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value })}>{KIND_OPTIONS.map(k => <option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>
              <div className="full-field" ref={parentBoxRef} style={{ position: 'relative' }}>
                <span>Lugar pai (contido em)</span>
                <input
                  value={form.parentName}
                  onChange={event => { setForm({ ...form, parentName: event.target.value, parentId: '' }); setParentOpen(true) }}
                  onFocus={() => setParentOpen(true)}
                  placeholder="Buscar lugar-pai…"
                  autoComplete="off"
                />
                {parentOpen && parentResults.length > 0 && (
                  <div className="parent-suggest">
                    {parentResults.map(row => (
                      <button key={row.id} onClick={() => { setForm({ ...form, parentId: row.id, parentName: row.name }); setParentOpen(false) }} type="button">
                        {row.name} <small>{kindLabel(row.kind)}</small>
                      </button>
                    ))}
                  </div>
                )}
                {form.parentId && <small>Vinculado a: {form.parentName}</small>}
              </div>
              <label><span>Cód. freguesia (CAOP)</span><input value={form.freguesiaCode} onChange={event => setForm({ ...form, freguesiaCode: event.target.value })} placeholder="Ex.: 171235" /></label>
              <label><span>Cód. concelho (CAOP)</span><input value={form.concelhoCode} onChange={event => setForm({ ...form, concelhoCode: event.target.value })} placeholder="Ex.: 1712" /></label>
              <label><span>Cód. distrito (CAOP)</span><input value={form.distritoCode} onChange={event => setForm({ ...form, distritoCode: event.target.value })} placeholder="Ex.: 17" /></label>
              <label><span>Vigente de</span><input type="date" value={form.validFrom} onChange={event => setForm({ ...form, validFrom: event.target.value })} /></label>
              <label><span>Vigente até</span><input type="date" value={form.validTo} onChange={event => setForm({ ...form, validTo: event.target.value })} /></label>
              <label className="full-field"><span>Outras grafias (separadas por vírgula)</span><input value={form.aliases} onChange={event => setForm({ ...form, aliases: event.target.value })} placeholder="Ex.: TInhela, Tinella" /></label>
              <label className="full-field"><span>Notas</span><textarea rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Contexto histórico, fonte, observações…" /></label>
            </div>
            <div className="dialog-footer">
              <button className="secondary-button" onClick={() => setEditing(null)} type="button">Cancelar</button>
              <button className="primary-button" disabled={saving} type="submit">{saving ? 'A guardar…' : 'Guardar lugar'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
