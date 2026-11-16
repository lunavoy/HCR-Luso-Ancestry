import { Component, lazy, Suspense, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { actionsFor, profiles, type House, type Profile, type Resident, type villageRepository } from './data'
import type { Performance } from './VillageScene'
import './village.css'

const Scene = lazy(() => import('./VillageScene'))

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p role="status">3D indisponível. Consulte os moradores abaixo.</p> : this.props.children
  }
}

const rewards = [
  [10, 'Criar um personagem e vinculá-lo à casa'],
  [50, 'Atribuir uma atividade adulta'],
  [100, 'Colher e lavar roupa'],
] as const

export function VillageProgress({ validated, pending }: { validated: number; pending: number }) {
  const next = rewards.find(([level]) => validated < level)
  return <div className="village-progress" aria-label="Progresso da vila">
    <div><strong>{validated} validadas</strong> · {pending} pendentes</div>
    <progress aria-label="Linhas validadas" value={Math.min(validated, 100)} max={100} />
    <span>{next ? `${next[0]} linhas · ${next[1]}` : 'Todas as recompensas liberadas'}</span>
    <Link to="/documents">Corrigir linhas do acervo</Link>
  </div>
}

const dates = [
  ['birth', 'Nascimento'], ['baptism', 'Batismo'], ['death', 'Óbito'],
] as const

function displayDate(value?: string) {
  return value?.split('-').reverse().join('/') || 'Sem data'
}

function inputValue(data: FormData, field: string) {
  return String(data.get(field) ?? '').trim() || undefined
}

export function HouseView({ house, repository, validated, onBack }: {
  house: House; repository: ReturnType<typeof villageRepository>; validated: number; onBack: () => void
}) {
  const [residents, setResidents] = useState(() => repository.getResidents(house.id))
  const [selected, setSelected] = useState<string>()
  const [inside, setInside] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [performance, setPerformance] = useState<Performance>()
  const [visible, setVisible] = useState(!document.hidden)
  const [error, setError] = useState('')
  const person = residents.find(item => item.id === selected)

  function select(id: string) {
    setSelected(id)
    setInspecting(true)
  }

  function toggleHouse() {
    setInside(value => !value)
    setInspecting(true)
    setPerformance(undefined)
  }

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  function save(resident: Resident) {
    try {
      setResidents(repository.saveResident(resident))
      setError('')
      return true
    } catch {
      setError('Não foi possível salvar o morador neste navegador.')
      return false
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (validated < 10) return
    const data = new FormData(event.currentTarget)
    const name = inputValue(data, 'name')
    if (!name) return
    const resident: Resident = {
      id: crypto.randomUUID(), houseId: house.id, name,
      locality: inputValue(data, 'locality') ?? house.locality,
      profile: data.get('profile') as Profile,
      birth: inputValue(data, 'birth'), baptism: inputValue(data, 'baptism'),
      source: inputValue(data, 'source'), occupation: inputValue(data, 'occupation'),
      occupationSource: inputValue(data, 'occupationSource'),
    }
    if (save(resident)) { setAdding(false); select(resident.id) }
  }

  const timeline = residents.flatMap(resident => dates.flatMap(([key, label]) => {
    const date = resident[key]
    return date ? [{ resident, key, label, date }] : []
  })).sort((a, b) => a.date.localeCompare(b.date))
  const actors = residents.slice(0, 4)
  if (person && !actors.includes(person)) actors[3] = person

  return <article className="village-house">
    <header className="village-house-heading">
      <button type="button" className="secondary-button" onClick={onBack}>← Voltar ao mapa</button>
      <div>
        <h1>{house.name}</h1>
        <p>{house.locality} · Localização {house.precision} · {house.latitude.toFixed(5)}, {house.longitude.toFixed(5)}</p>
        {house.example && <p>Família fictícia de demonstração</p>}
      </div>
    </header>
    <div className={`village-stage ${inspecting ? 'is-inspecting' : ''}`}>
      <div className="village-scene">
      <SceneBoundary><Suspense fallback={<p>A carregar a cena…</p>}>
        <Scene residents={actors} visible={visible} performance={performance} inside={inside} selected={selected}
          onHouse={toggleHouse} onPerson={select} />
      </Suspense></SceneBoundary>
      </div>
      <span className="village-scene-note">Cena e atividades ilustrativas da época</span>
      <div className="village-scene-controls">
        <button type="button" onClick={() => {
          setInside(false)
          setSelected(undefined)
          setPerformance(undefined)
          setInspecting(false)
        }}>Vista da vila</button>
        <button type="button" aria-pressed={inside} onClick={toggleHouse}>{inside ? 'Ver exterior' : 'Ver interior'}</button>
        <button type="button" aria-expanded={inspecting}
          onClick={() => setInspecting(value => !value)}>Moradores e linha do tempo</button>
      </div>
    <div className="village-detail">
      <button className="village-close" type="button" aria-label="Fechar painel da família" onClick={() => {
        setInspecting(false)
        setSelected(undefined)
      }}>×</button>
      <section>
        <h2>Moradores <span>({residents.length})</span></h2>
        <div className="village-residents">
          {residents.map(resident => <button key={resident.id} type="button" className="secondary-button"
            aria-pressed={resident.id === selected} onClick={() => select(resident.id)}>
            <strong>{resident.name}</strong><span>{profiles[resident.profile]}</span>
          </button>)}
        </div>
        <button type="button" className="secondary-button" disabled={validated < 10}
          aria-expanded={adding} onClick={() => setAdding(value => !value)}>Criar personagem</button>
        {validated < 10 && <p>Disponível a partir de 10 linhas validadas.</p>}
        {adding && validated >= 10 && <form className="village-form" onSubmit={add}>
          <label>Nome<input name="name" required /></label>
          <label>Perfil<select name="profile">{Object.entries(profiles).map(([value, name]) =>
            <option key={value} value={value}>{name}</option>)}</select></label>
          <label>Localidade<input name="locality" defaultValue={house.locality} /></label>
          <label>Nascimento<input name="birth" type="date" /></label>
          <label>Batismo<input name="baptism" type="date" /></label>
          <label>Fonte<input name="source" /></label>
          <label>Profissão registrada<input name="occupation" /></label>
          <label>Fonte da profissão<input name="occupationSource" /></label>
          <button className="primary-button" type="submit">Salvar na casa</button>
        </form>}
      </section>
      <section aria-label="Ficha do morador">
        <h2>{person?.name ?? 'Ficha do morador'}</h2>
        {person && <div key={person.id}>
          <p>{profiles[person.profile]} · {person.locality}</p>
          <dl className="village-facts">
            {dates.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{displayDate(person[key])}</dd></div>)}
            {person.source && <div><dt>Fonte</dt><dd>{person.source}</dd></div>}
            {person.deathSource && <div><dt>Fonte do óbito</dt><dd>{person.deathSource}</dd></div>}
            {person.occupation && <div><dt>Profissão</dt><dd>{person.occupation}</dd></div>}
            {person.occupationSource && <div><dt>Fonte da profissão</dt><dd>{person.occupationSource}</dd></div>}
          </dl>
          <details>
            <summary>{person.death ? 'Editar óbito' : 'Cadastrar óbito'}</summary>
            <form className="village-form" onSubmit={event => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              save({ ...person, death: inputValue(data, 'death'), deathSource: inputValue(data, 'deathSource') })
            }}>
              <label>Data do óbito<input name="death" type="date" defaultValue={person.death} required /></label>
              <label>Fonte do óbito<input name="deathSource" defaultValue={person.deathSource} /></label>
              <button type="submit" className="secondary-button">Salvar óbito</button>
            </form>
          </details>
          <div className="village-actions">
            {(person.profile === 'homem' || person.profile === 'mulher') && !person.activity &&
              <button type="button" className="secondary-button" disabled={validated < 50}
                onClick={() => save({ ...person, activity: true })}>
                {person.profile === 'homem' ? 'Atribuir fazendeiro' : 'Atribuir cuidar da casa'}{validated < 50 && ' · 50 linhas'}
              </button>}
            {actionsFor(person, validated).map(action => <button type="button" className="primary-button" key={action}
              onClick={() => {
                if (action === 'Arar' || action === 'Colher') setInside(false)
                if (action === 'Preparar comida' || action === 'Lavar roupa') setInside(true)
                setPerformance(previous => ({ personId: person.id, action, sequence: (previous?.sequence ?? 0) + 1 }))
              }}>{action}</button>)}
          </div>
          {performance?.personId === person.id && <p role="status">Interação ilustrativa · {performance.action}</p>}
        </div>}
      </section>
      <section className="village-timeline">
        <h2>Linha do tempo da família</h2>
        {timeline.length ? <ol>{timeline.map(({ resident, key, label, date }) =>
          <li key={`${resident.id}:${key}`}><time dateTime={date}>{displayDate(date)}</time> <strong>{label}</strong> · {resident.name}</li>)}</ol>
          : <p>Nenhum evento com data cadastrada.</p>}
      </section>
    </div>
    </div>
    {error && <p role="alert">{error}</p>}
  </article>
}
