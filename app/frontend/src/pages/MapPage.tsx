import { useEffect, useMemo, useRef, useState } from 'react'
import { geoContains, geoMercator, geoPath } from 'd3-geo'
import type { FormEvent, MouseEvent } from 'react'
import type { Feature, FeatureCollection } from 'geojson'
import { apiDataService } from '../services/dataService'
import type { MapAreaStat, MapStats, PersonAreaStat, PersonMapStats } from '../types/domain'
import { useSession } from '../components/auth/AuthProvider'
import { readProgress, villageRepository, type House, type Precision } from '../village/data'
import { HouseView, VillageProgress } from '../village/HouseView'

type MapLayer = 'acervo' | 'pessoas' | 'eventos'

const LAYER_LABELS: Record<MapLayer, string> = {
  acervo: 'Acervo documental',
  pessoas: 'Pessoas',
  eventos: 'Eventos históricos',
}

type Area = { code: string; name: string }

type View =
  | { kind: 'portugal' }
  | { kind: 'distritos' }
  | { kind: 'concelhos'; distrito: Area }
  | { kind: 'freguesias'; distrito: Area; concelho: Area }

interface TooltipState {
  x: number
  y: number
  title: string
  subtitle?: string
  stat?: MapAreaStat
  personStat?: PersonAreaStat
}

const GEO_BASE = '/geo'
const cache = new Map<string, Promise<FeatureCollection>>()

function loadGeo(url: string): Promise<FeatureCollection> {
  let pending = cache.get(url)
  if (!pending) {
    pending = fetch(`${GEO_BASE}/${url}`).then(res => {
      if (!res.ok) throw new Error(`Falha ao carregar ${url}`)
      return res.json() as Promise<FeatureCollection>
    })
    cache.set(url, pending)
  }
  return pending
}

function geoUrl(view: View): string {
  switch (view.kind) {
    case 'portugal': return 'portugal.geojson'
    case 'distritos': return 'distritos.geojson'
    case 'concelhos': return 'concelhos.geojson'
    case 'freguesias': return `freguesias/${view.concelho.code}.geojson`
  }
}

function statsKey(view: View, props: Record<string, unknown> | null): string | null {
  if (!props) return null
  switch (view.kind) {
    case 'portugal': return null // cor única = agregado nacional
    case 'distritos': return String(props.code ?? '') || null
    case 'concelhos': return String(props.code ?? '') || null
    case 'freguesias': return String(props.code ?? '') || null
  }
}

function areaStat(stats: MapStats | null, view: View, props: Record<string, unknown> | null): MapAreaStat | undefined {
  if (!stats) return undefined
  if (view.kind === 'portugal') {
    // Agregado nacional = soma dos distritos.
    const all = Object.values(stats.distritos)
    if (!all.length) return undefined
    return { documents: all.reduce((s, a) => s + a.documents, 0), done: all.reduce((s, a) => s + a.done, 0) }
  }
  const key = statsKey(view, props)
  if (!key) return undefined
  const bucket = view.kind === 'freguesias' ? stats.freguesias
    : view.kind === 'concelhos' ? stats.concelhos
    : stats.distritos
  return bucket[key]
}

// Âmbar (0%) → verde (100%); sem dados = cinza.
function personAreaStat(stats: PersonMapStats | null, view: View, props: Record<string, unknown> | null): PersonAreaStat | undefined {
  if (!stats) return undefined
  const key = statsKey(view, props)
  if (view.kind === 'portugal') {
    const pick = (level: 'freguesias' | 'concelhos' | 'distritos') =>
      Object.values(stats[level]).reduce(
        (acc, s) => ({ persons: acc.persons + s.persons, events: acc.events + s.events }),
        { persons: 0, events: 0 })
    // Nacional: usa distritos (já agregados).
    return pick('distritos')
  }
  if (!key) return undefined
  const bucket = view.kind === 'freguesias' ? stats.freguesias
    : view.kind === 'concelhos' ? stats.concelhos
    : stats.distritos
  return bucket[key]
}

function colorFor(stat: MapAreaStat | undefined): string {
  if (!stat || !stat.documents) return '#dbe2ea'
  const pct = stat.done / stat.documents
  const hue = 45 + 95 * pct
  const sat = 78 - 18 * pct
  const light = 86 - 46 * pct
  return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`
}

// Camada Pessoas/Eventos: cor sequencial por contagem (0 = cinza).
function personColorFor(stat: PersonAreaStat | undefined, metric: 'persons' | 'events'): string {
  const value = stat?.[metric] ?? 0
  if (!value) return '#dbe2ea'
  const max = metric === 'persons' ? 50 : 200
  const t = Math.min(1, Math.log1p(value) / Math.log1p(max))
  const light = 88 - 55 * t
  return `hsl(210, ${45 + 35 * t}%, ${light}%)`
}

export function MapPage() {
  const user = useSession()?.user.id ?? 'visitor'
  const [demo, setDemo] = useState<number>()
  const demonstration = demo !== undefined
  const repository = useMemo(() => villageRepository(demonstration ? `${user}:demo` : user), [user, demonstration])
  const progress = demo === undefined ? readProgress(user) : { validated: demo, pending: 0 }
  const [house, setHouse] = useState<House>()
  const [picking, setPicking] = useState(false)
  const [point, setPoint] = useState<{ longitude: number; latitude: number; locality: string }>()
  const [parishOnly, setParishOnly] = useState(false)
  const [houseError, setHouseError] = useState('')
  const [view, setView] = useState<View>({ kind: 'portugal' })
  const [geo, setGeo] = useState<FeatureCollection | null>(null)
  const [stats, setStats] = useState<MapStats | null>(null)
  const [personStats, setPersonStats] = useState<PersonMapStats | null>(null)
  const [layer, setLayer] = useState<MapLayer>('acervo')
  const [error, setError] = useState('')
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiDataService.getMapStats()
      .then(setStats)
      .catch(() => setStats({ freguesias: {}, concelhos: {}, distritos: {} }))
    apiDataService.getPersonMapStats()
      .then(setPersonStats)
      .catch(() => setPersonStats({ freguesias: {}, concelhos: {}, distritos: {} }))
  }, [])

  const url = geoUrl(view)
  useEffect(() => {
    let alive = true
    setGeo(null)
    setError('')
    loadGeo(url)
      .then(data => {
        if (!alive) return
        // concelhos: mostra só os do distrito selecionado
        const features = view.kind === 'concelhos'
          ? data.features.filter(f =>
              String((f.properties as Record<string, unknown>)?.distrito ?? '') === view.distrito.code)
          : data.features
        setGeo({ type: 'FeatureCollection', features } as FeatureCollection)
      })
      .catch(err => alive && setError(err instanceof Error ? err.message : 'Falha ao carregar o mapa.'))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, view.kind])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [house])

  const projection = useMemo(() => {
    if (!geo || !size.w || !size.h) return null
    return geoMercator().fitExtent([[24, 24], [size.w - 24, size.h - 24]], geo)
  }, [geo, size])

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection])
  const southwest = projection?.invert?.([0, size.h])
  const northeast = projection?.invert?.([size.w, 0])
  const houses = southwest && northeast && geo
    ? repository.listHouses([southwest[0], southwest[1], northeast[0], northeast[1]])
      .filter(item => geoContains(geo, [item.longitude, item.latitude]))
    : []

  const features = geo?.features ?? []

  // Totais do nível atual (para o cabeçalho).
  const viewTotals = useMemo((): MapAreaStat | undefined => {
    if (!stats) return undefined
    if (view.kind === 'portugal') return areaStat(stats, view, null)
    if (view.kind === 'distritos') return undefined // distritos não têm pai único
    if (view.kind === 'concelhos') {
      // soma dos concelhos do distrito exibido
      const codes = new Set(features.map(f => String((f.properties as any)?.code ?? '')))
      let documents = 0, done = 0
      for (const code of codes) {
        const s = stats.concelhos[code]
        if (s) { documents += s.documents; done += s.done }
      }
      return documents ? { documents, done } : undefined
    }
    // freguesias: soma das freguesias do concelho
    let documents = 0, done = 0
    for (const f of features) {
      const s = stats.freguesias[String((f.properties as any)?.code ?? '')]
      if (s) { documents += s.documents; done += s.done }
    }
    return documents ? { documents, done } : undefined
  }, [stats, view, features])

  // Totais da camada pessoas/eventos no nível atual.
  const personTotals = useMemo((): PersonAreaStat | undefined => {
    if (!personStats) return undefined
    if (view.kind === 'portugal') return personAreaStat(personStats, view, null)
    if (view.kind === 'distritos') {
      // distritos não têm pai — soma os códigos visíveis
      const codes = new Set(features.map(f => String((f.properties as any)?.code ?? '')))
      let persons = 0, events = 0
      for (const code of codes) {
        const s = personStats.distritos[code]
        if (s) { persons += s.persons; events += s.events }
      }
      return persons || events ? { persons, events } : undefined
    }
    const bucket = view.kind === 'freguesias' ? personStats.freguesias
      : view.kind === 'concelhos' ? personStats.concelhos
      : personStats.distritos
    let persons = 0, events = 0
    for (const f of features) {
      const s = bucket[String((f.properties as any)?.code ?? '')]
      if (s) { persons += s.persons; events += s.events }
    }
    return persons || events ? { persons, events } : undefined
  }, [personStats, view, features])

  const crumbs: { label: string; go: () => void }[] = [
    { label: 'Portugal', go: () => setView({ kind: 'portugal' }) },
  ]
  if (view.kind !== 'portugal') crumbs.push({ label: 'Distritos', go: () => setView({ kind: 'distritos' }) })
  if (view.kind === 'concelhos' || view.kind === 'freguesias') {
    crumbs.push({ label: view.distrito.name, go: () => setView({ kind: 'concelhos', distrito: view.distrito }) })
  }
  if (view.kind === 'freguesias') {
    crumbs.push({ label: view.concelho.name, go: () => {} })
  }

  const title = view.kind === 'portugal' ? 'Portugal'
    : view.kind === 'distritos' ? 'Distritos'
    : view.kind === 'concelhos' ? `Concelhos de ${view.distrito.name}`
    : `Freguesias de ${view.concelho.name}`

  const onFeatureClick = (feature: Feature) => {
    const props = (feature.properties ?? {}) as Record<string, unknown>
    const code = String(props.code ?? '')
    const name = String(props.name ?? code)
    if (view.kind === 'portugal') {
      setView({ kind: 'distritos' })
    } else if (view.kind === 'distritos') {
      setView({ kind: 'concelhos', distrito: { code, name } })
    } else if (view.kind === 'concelhos') {
      setView({ kind: 'freguesias', distrito: view.distrito, concelho: { code, name } })
    }
    // freguesias: nível folha — nada a descer
  }

  const onMove = (event: React.MouseEvent, feature: Feature) => {
    const props = (feature.properties ?? {}) as Record<string, unknown>
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const name = String(props.name ?? props.code ?? '')
    const subtitle = view.kind === 'freguesias'
      ? String(props.municipio ?? '')
      : view.kind === 'concelhos'
        ? String(props.distrito_name ?? '')
        : view.kind === 'distritos' ? String(props.nuts1 ?? '') : undefined
    setTooltip({
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14,
      title: name,
      subtitle: subtitle || undefined,
      stat: areaStat(stats, view, props),
      personStat: personAreaStat(personStats, view, props),
    })
  }

  function pick(event: MouseEvent<SVGSVGElement>) {
    if (!picking || !geo) return
    const rect = event.currentTarget.getBoundingClientRect()
    const coordinate = projection?.invert?.([event.clientX - rect.left, event.clientY - rect.top])
    if (!coordinate) return
    const area = geo.features.find(feature => geoContains(feature, coordinate))
    if (!area) return
    setPoint({ longitude: coordinate[0], latitude: coordinate[1], locality: String(area.properties?.name ?? '') })
    setParishOnly(false)
    setPicking(false)
  }

  function createHouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!point) return
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name')).trim()
    const locality = String(data.get('locality')).trim()
    const precision = data.get('precision') as Precision
    if (!name || !locality || (parishOnly && precision === 'documentada')) return
    const created = { ...point, locality, name, precision, id: crypto.randomUUID() }
    try {
      repository.createHouse(created)
      setPoint(undefined)
      setHouse(created)
      setHouseError('')
    } catch {
      setHouseError('Não foi possível salvar a casa neste navegador.')
    }
  }

  return (
    <div className="map-page">
      <div className="village-toolbar">
        <VillageProgress {...progress} />
        <label>Modo de demonstração <select value={demo ?? ''} onChange={event => {
          const level = event.target.value === '' ? undefined : Number(event.target.value)
          setDemo(level)
          if ((level !== undefined) === demonstration) return
          setHouse(undefined)
          setPoint(undefined)
          setPicking(false)
          setHouseError('')
        }}>
          <option value="">Progresso do acervo</option>
          {[0, 10, 50, 100].map(level => <option key={level} value={level}>{level} linhas simuladas</option>)}
        </select></label>
      </div>
      {house ? <HouseView key={house.id} house={house} repository={repository} validated={progress.validated}
        onBack={() => setHouse(undefined)} /> : <>
      <header className="map-header">
        <div>
          <p className="eyebrow">Mapa</p>
          <h1>{title}</h1>
        </div>
        <nav className="map-crumbs" aria-label="Navegação do mapa">
          {crumbs.map((crumb, index) => (
            <span key={crumb.label}>
              {index > 0 && <span className="map-crumb-sep">›</span>}
              <button
                className={index === crumbs.length - 1 ? 'is-current' : ''}
                onClick={crumb.go}
                type="button"
              >{crumb.label}</button>
            </span>
          ))}
        </nav>
        <div className="map-controls">
          <label className="select-field">
            <span className="field-caption">Camada</span>
            <select value={layer} onChange={e => setLayer(e.target.value as MapLayer)} aria-label="Camada do mapa">
              {(Object.keys(LAYER_LABELS) as MapLayer[]).map(key => (
                <option key={key} value={key}>{LAYER_LABELS[key]}</option>
              ))}
            </select>
          </label>
        </div>
        {layer === 'acervo' && viewTotals && (
          <div className="map-totals">
            <strong>{viewTotals.done}/{viewTotals.documents}</strong>
            <span>livros concluídos</span>
            <div className="map-total-bar">
              <i style={{ width: `${Math.round((viewTotals.done / viewTotals.documents) * 100)}%` }} />
            </div>
          </div>
        )}
        {layer !== 'acervo' && personTotals && (
          <div className="map-totals">
            <strong>{layer === 'pessoas' ? personTotals.persons : personTotals.events}</strong>
            <span>{layer === 'pessoas' ? 'pessoas documentadas' : 'eventos documentados'}</span>
            {layer === 'eventos' && personTotals.persons > 0 && (
              <span className="map-total-sub">{personTotals.persons} pessoas</span>
            )}
          </div>
        )}
      </header>

      <div className="village-toolbar">
        <button type="button" className="secondary-button" disabled={!projection} aria-pressed={picking} onClick={() => {
          setPoint(undefined)
          setPicking(value => !value)
          setTooltip(null)
        }}>{picking ? 'Cancelar escolha' : 'Criar casa no mapa'}</button>
        {picking && <p role="status">Escolha um ponto dentro da região exibida.</p>}
        {point && <form className="village-form" onSubmit={createHouse}>
          <label>Nome da casa<input name="name" required /></label>
          <label>Localidade<input name="locality" defaultValue={point.locality} required /></label>
          <label><span><input type="checkbox" checked={parishOnly} onChange={event => setParishOnly(event.target.checked)} /> O registro indica apenas a freguesia</span></label>
          <label>Localização<select name="precision" key={String(parishOnly)} defaultValue="aproximada">
            {!parishOnly && <option value="documentada">Documentada</option>}
            <option value="aproximada">Aproximada</option>
            <option value="ilustrativa">Ilustrativa</option>
          </select></label>
          <button type="submit" className="primary-button">Salvar casa</button>
          <button type="button" className="secondary-button" onClick={() => setPoint(undefined)}>Cancelar</button>
        </form>}
        {houseError && <p role="alert">{houseError}</p>}
        {!picking && !point && houses.some(item => item.example) && <span>Selecione o marcador da família Ribeiro para explorar a vila.</span>}
      </div>
      <div className={`map-canvas-wrap ${picking ? 'village-picking' : ''}`} ref={wrapRef}>
        {error && <div className="map-empty">{error}</div>}
        {!error && !geo && <div className="map-empty">A carregar mapa…</div>}
        {geo && path && size.w > 0 && (
          <svg className="pt-map" viewBox={`0 0 ${size.w} ${size.h}`} aria-label={title} onClick={pick}>
            <g key={`${view.kind}-${'distrito' in view ? view.distrito.code : ''}-${'concelho' in view ? view.concelho.code : ''}`}>
              {features.map((feature, index) => {
                const d = path(feature)
                if (!d) return null
                const props = (feature.properties ?? {}) as Record<string, unknown>
                const stat = areaStat(stats, view, props)
                const pstat = layer === 'acervo' ? undefined
                  : personAreaStat(personStats, view, props)
                const clickable = view.kind !== 'freguesias'
                return (
                  <path
                    className={`map-feature ${clickable ? 'is-clickable' : ''}`}
                    d={d}
                    fill={layer === 'acervo'
                      ? colorFor(stat)
                      : personColorFor(pstat, layer === 'pessoas' ? 'persons' : 'events')}
                    key={index}
                    onClick={() => !picking && clickable && onFeatureClick(feature)}
                    onMouseLeave={() => setTooltip(null)}
                    onMouseMove={event => !picking && onMove(event, feature)}
                    stroke="#ffffff"
                    strokeLinejoin="round"
                    strokeWidth={view.kind === 'freguesias' ? 0.4 : 0.8}
                  />
                )
              })}
            </g>
            {!picking && houses.map(item => {
              const position = projection?.([item.longitude, item.latitude])
              if (!position) return null
              const open = () => { setHouse(item); setPoint(undefined); setTooltip(null) }
              return <g key={item.id} className="village-marker" transform={`translate(${position.join(' ')})`}
                role="button" tabIndex={0} aria-label={item.name} onClick={open}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() }
                }}>
                <title>{item.name} · Localização {item.precision}</title>
                <circle cy="-8" r="13" fill="currentColor" stroke="white" strokeWidth="1.5" />
                <path d="M-7-9 0-15 7-9v7H2v-5h-4v5h-5z" fill="white" />
              </g>
            })}
          </svg>
        )}
        {tooltip && (
          <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <strong>{tooltip.title}</strong>
            {tooltip.subtitle && <span className="map-tooltip-sub">{tooltip.subtitle}</span>}
            {layer === 'acervo' && (tooltip.stat ? (
              <>
                <div className="map-tooltip-bar">
                  <i style={{ width: `${Math.round((tooltip.stat.done / tooltip.stat.documents) * 100)}%` }} />
                </div>
                <span className="map-tooltip-pct">
                  {tooltip.stat.done}/{tooltip.stat.documents} livros · {Math.round((tooltip.stat.done / tooltip.stat.documents) * 100)}%
                </span>
              </>
            ) : (
              <span className="map-tooltip-pct">Sem livros registrados</span>
            ))}
            {layer !== 'acervo' && (
              <span className="map-tooltip-pct">
                {tooltip.personStat && (tooltip.personStat.persons || tooltip.personStat.events)
                  ? `${tooltip.personStat.persons} pessoas · ${tooltip.personStat.events} eventos`
                  : 'Sem pessoas documentadas'}
              </span>
            )}
          </div>
        )}
      </div>

      <footer className="map-legend">
        {layer === 'acervo' ? (
          <>
            <span className="map-legend-item"><i className="map-swatch" style={{ background: '#dbe2ea' }} /> Sem dados</span>
            <span className="map-legend-item">
              <i className="map-swatch map-swatch-gradient" />
              0% → 100% livros concluídos
            </span>
          </>
        ) : (
          <>
            <span className="map-legend-item"><i className="map-swatch" style={{ background: '#dbe2ea' }} /> Sem dados</span>
            <span className="map-legend-item">
              <i className="map-swatch" style={{ background: personColorFor({ persons: 25, events: 100 }, layer === 'pessoas' ? 'persons' : 'events') }} />
              {layer === 'pessoas' ? 'mais pessoas documentadas' : 'mais eventos documentados'}
            </span>
            <span className="map-legend-note">Pessoas ligadas por nascimento ou por registo na localidade</span>
          </>
        )}
        <span className="map-legend-note">Clique numa região para descer um nível</span>
      </footer>
      </>}
    </div>
  )
}
