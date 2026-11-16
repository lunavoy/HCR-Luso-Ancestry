import { Pencil, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiDataService } from '../services/dataService'
import type { Scribe } from '../types/domain'

interface ScribeForm {
  name: string
  aliases: string
  activeFrom: string
  activeTo: string
  notes: string
}

const emptyForm: ScribeForm = { name: '', aliases: '', activeFrom: '', activeTo: '', notes: '' }

function toForm(scribe: Scribe | null): ScribeForm {
  if (!scribe) return emptyForm
  return {
    name: scribe.name,
    aliases: (scribe.aliases ?? []).join(', '),
    activeFrom: scribe.active_from ?? '',
    activeTo: scribe.active_to ?? '',
    notes: scribe.notes ?? '',
  }
}

const era = (scribe: Scribe) => {
  if (!scribe.active_from && !scribe.active_to) return 'época por definir'
  return `${scribe.active_from ?? '…'} → ${scribe.active_to ?? '…'}`
}

export function ScribesPage() {
  const [scribes, setScribes] = useState<Scribe[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Scribe | 'new' | null>(null)
  const [form, setForm] = useState<ScribeForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = (q: string) => {
    setLoading(true)
    apiDataService.listScribes(q)
      .then(rows => setScribes([...rows].sort((a, b) =>
        (a.active_from ?? '9999').localeCompare(b.active_from ?? '9999') || a.name.localeCompare(b.name))))
      .catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar escribas.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => load(query), query ? 300 : 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const openEditor = (scribe: Scribe | 'new') => {
    setEditing(scribe)
    setForm(toForm(scribe === 'new' ? null : scribe))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      aliases: form.aliases.split(',').map(a => a.trim()).filter(Boolean),
      active_from: form.activeFrom || null,
      active_to: form.activeTo || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (editing === 'new') await apiDataService.createScribe(payload)
      else if (editing) await apiDataService.updateScribe(editing.id, payload)
      setEditing(null)
      load(query)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao guardar o escriba.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="page-heading heading-with-action">
        <div>
          <p className="eyebrow">Mãos e épocas</p>
          <h1>Padres / Escribas</h1>
          <p>Os celebrantes que redigiram os livros paroquiais. A época de cada um permite observar transições de pároco e dividir o treino da IA por punho.</p>
        </div>
        <button className="primary-button" onClick={() => openEditor('new')} type="button"><Plus size={17} /> Novo escriba</button>
      </section>

      <div className="filter-bar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar padre ou alias" /></label>
        <span className="filter-count">{scribes.length} escribas</span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="data-table">
        <div className="table-header places-header"><span>Escriba</span><span>Época de escrita</span><span>Livros</span><span>Notas</span><span /></div>
        {scribes.map(scribe => (
          <div className="table-row places-row" key={scribe.id}>
            <div>
              <strong>{scribe.name}</strong>
              <small>{scribe.aliases?.length ? `também: ${scribe.aliases.join(', ')}` : 'assina os registros'}</small>
            </div>
            <div><small>{era(scribe)}</small></div>
            <div><small>{scribe.document_count ?? 0} livro(s)</small></div>
            <div><small>{scribe.notes ?? '—'}</small></div>
            <div><button className="icon-button bare" onClick={() => openEditor(scribe)} title="Editar escriba" type="button"><Pencil size={15} /></button></div>
          </div>
        ))}
        {!loading && !scribes.length && (
          <div className="empty-state"><p>Nenhum escriba cadastrado. Cadastre os padres que assinam os livros da coleção.</p></div>
        )}
        {loading && <div className="empty-state"><p>A carregar…</p></div>}
      </div>

      {editing !== null && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setEditing(null)}>
          <form className="dialog" onSubmit={save}>
            <div className="dialog-header">
              <div><span className="eyebrow">{editing === 'new' ? 'Novo celebrante' : 'Editar escriba'}</span><h2>{editing === 'new' ? 'Cadastrar padre' : form.name}</h2></div>
              <button className="icon-button bare" onClick={() => setEditing(null)} type="button"><X size={19} /></button>
            </div>
            <p className="dialog-hint">Registre o período em que o padre escreveu nesta paróquia — é o que permite ver a transição de um celebrante para outro e agrupar o treino por punho.</p>
            <div className="form-grid">
              <label><span>Nome</span><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Padre Jaime Nideira Alves" /></label>
              <label><span>Outras formas do nome (vírgula)</span><input value={form.aliases} onChange={event => setForm({ ...form, aliases: event.target.value })} placeholder="Ex.: Jayme Nideira, P. Jaime" /></label>
              <label><span>Escreveu de</span><input type="date" value={form.activeFrom} onChange={event => setForm({ ...form, activeFrom: event.target.value })} /></label>
              <label><span>Escreveu até</span><input type="date" value={form.activeTo} onChange={event => setForm({ ...form, activeTo: event.target.value })} /></label>
              <label className="full-field"><span>Notas</span><textarea rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Cargo, ordem religiosa, observações sobre a letra…" /></label>
            </div>
            <div className="dialog-footer">
              <button className="secondary-button" onClick={() => setEditing(null)} type="button">Cancelar</button>
              <button className="primary-button" disabled={saving} type="submit">{saving ? 'A guardar…' : 'Guardar escriba'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
