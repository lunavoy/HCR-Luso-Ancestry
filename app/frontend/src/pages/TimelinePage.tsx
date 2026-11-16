import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiDataService } from '../services/dataService'
import type {
  PersonDetail, PersonLane, PersonStats, PersonSummary, Place,
} from '../types/domain'

const STATUS_LABELS: Record<string, string> = {
  vivo: 'Vivo',
  presumido: 'Presumido vivo',
  falecido: 'Falecido',
  desconhecido: 'Desconhecido',
}

const ROLE_FILTERS = [
  { value: '', label: 'Todos os papéis' },
  { value: 'referred', label: 'Referido' },
  { value: 'spouse_a', label: 'Cônjuge A' },
  { value: 'spouse_b', label: 'Cônjuge B' },
  { value: 'father', label: 'Pai' },
  { value: 'mother', label: 'Mãe' },
  { value: 'godfather', label: 'Padrinho' },
  { value: 'godmother', label: 'Madrinha' },
  { value: 'witness', label: 'Testemunha' },
]

function formatYearRange(start?: number | null, end?: number | null, estimated?: boolean): string {
  if (start == null && end == null) return 'datas desconhecidas'
  const suffix = estimated ? ' (estimado)' : ''
  if (start != null && end != null) return `${start} – ${end}${suffix}`
  if (start != null) return `desde ${start}${suffix}`
  return `até ${end}${suffix}`
}

export function TimelinePage() {
  const [stats, setStats] = useState<PersonStats | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [lanes, setLanes] = useState<PersonLane[]>([])
  const [from, setFrom] = useState(1880)
  const [to, setTo] = useState(1960)
  const [placeId, setPlaceId] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PersonDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiDataService.getPersonStats().then(setStats).catch(() => setStats(null))
    apiDataService.listPlaces('', 'freguesia').then(setPlaces).catch(() => setPlaces([]))
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      apiDataService.getPersonTimeline(from, to, placeId || undefined, query || undefined)
        .then(data => setLanes(data.persons))
        .catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar a timeline.'))
    }, 250)
    return () => clearTimeout(handle)
  }, [from, to, placeId, query])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    setDetailLoading(true)
    apiDataService.getPerson(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  const yearTicks = useMemo(() => {
    const step = to - from > 120 ? 20 : to - from > 60 ? 10 : 5
    const ticks: number[] = []
    for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y)
    return ticks
  }, [from, to])

  const visibleLanes = useMemo(() => {
    if (!roleFilter) return lanes
    return lanes.filter(lane => lane.events.some(e => e.role === roleFilter))
  }, [lanes, roleFilter])

  // Dimensões do SVG: margem esquerda para nomes, direita para eventos.
  const LABEL_W = 180
  const PAD = 16
  const ROW_H = 34
  const TOP_H = 34
  const W = 1180
  const plotW = W - LABEL_W - PAD * 2
  const H = TOP_H + visibleLanes.length * ROW_H + PAD
  const x = (year: number) => LABEL_W + PAD + ((year - from) / (to - from)) * plotW

  const selectPerson = (person: PersonSummary) => {
    setSelectedId(person.id === selectedId ? null : person.id)
  }

  return (
    <main className="page-shell timeline-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Genealogia</p>
          <h1>Timeline</h1>
          <p>Explore pessoas, famílias e acontecimentos ao longo do tempo — cada evento ligado ao documento que o comprova.</p>
        </div>
        {stats && (
          <div className="timeline-stats">
            <span className="stat-chip">{stats.persons} pessoas</span>
            <span className="stat-chip">{stats.with_birth} com nascimento</span>
            <span className="stat-chip">{stats.with_death} com óbito</span>
            <span className="stat-chip">{stats.documented_events} eventos documentados</span>
          </div>
        )}
      </section>

      <div className="filter-bar timeline-controls">
        <label className="select-field timeline-year">
          <span className="field-caption">De</span>
          <input type="number" value={from} min={1500} max={to - 1}
            onChange={e => setFrom(Math.min(Number(e.target.value), to - 1))} />
        </label>
        <label className="select-field timeline-year">
          <span className="field-caption">Até</span>
          <input type="number" value={to} min={from + 1} max={2100}
            onChange={e => setTo(Math.max(Number(e.target.value), from + 1))} />
        </label>
        <label className="search-field timeline-search">
          <input type="search" placeholder="Pesquisar pessoa…" value={query}
            onChange={e => setQuery(e.target.value)} />
        </label>
        <label className="select-field">
          <span className="field-caption">Localidade</span>
          <select value={placeId} onChange={e => setPlaceId(e.target.value)} aria-label="Filtrar por localidade">
            <option value="">Todas</option>
            {places.map(p => (
              <option key={p.id} value={p.id}>{p.parent_name ? `${p.name} — ${p.parent_name}` : p.name}</option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span className="field-caption">Papel</span>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label="Filtrar por papel">
            {ROLE_FILTERS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <span className="filter-count">{visibleLanes.length} pessoas</span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <section className="timeline-board">
        {visibleLanes.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma pessoa documentada neste período{placeId ? ' e localidade' : ''}.</p>
            <p className="filter-count">
              As pessoas aparecem aqui quando um registro for classificado e as menções
              de nome forem atribuídas no perfil do registro.
            </p>
          </div>
        ) : (
          <svg className="timeline-svg" viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label={`Timeline de ${visibleLanes.length} pessoas entre ${from} e ${to}`}>
            {/* eixo de anos */}
            {yearTicks.map(year => (
              <g key={year}>
                <line x1={x(year)} x2={x(year)} y1={TOP_H - 8} y2={H - PAD}
                  className="timeline-grid" />
                <text x={x(year)} y={TOP_H - 12} className="timeline-tick" textAnchor="middle">
                  {year}
                </text>
              </g>
            ))}
            {visibleLanes.map((lane, index) => {
              const y = TOP_H + index * ROW_H + ROW_H / 2
              const barY = y - 5
              const start = lane.lifespan_start ?? from
              const end = lane.lifespan_end ?? to
              const bx = x(Math.max(start, from))
              const bw = Math.max(2, x(Math.min(end, to)) - bx)
              const selected = lane.id === selectedId
              return (
                <g key={lane.id} className={`timeline-lane ${selected ? 'is-selected' : ''}`}
                  onClick={() => selectPerson(lane)} role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && selectPerson(lane)}>
                  <text x={LABEL_W - 10} y={y + 4} className="timeline-name" textAnchor="end">
                    {lane.name || '(sem nome)'}
                  </text>
                  {lane.lifespan_start != null && lane.lifespan_end != null && (
                    <rect x={bx} y={barY} width={bw} height={10} rx={5}
                      className={`timeline-bar ${lane.lifespan_estimated ? 'is-estimated' : ''}`} />
                  )}
                  {lane.events.map((event, ei) => event.year != null && (
                    <circle key={ei} cx={x(Math.min(Math.max(event.year, from), to))}
                      cy={y} r={4}
                      className={`timeline-event role-${event.role ?? 'other'}`}
                      onClick={e => { e.stopPropagation(); selectPerson(lane) }}>
                      <title>{`${lane.name}: ${event.role_label ?? event.record_type_label} — ${event.year}${event.place ? ` em ${event.place}` : ''}`}</title>
                    </circle>
                  ))}
                </g>
              )
            })}
          </svg>
        )}
      </section>

      {selectedId && (
        <aside className="timeline-detail">
          {detailLoading && <p className="filter-count">A carregar perfil…</p>}
          {detail && !detailLoading && (
            <>
              <header className="timeline-detail-head">
                <h2>{detail.name || '(sem nome)'}</h2>
                <button type="button" className="secondary-button"
                  onClick={() => setSelectedId(null)}>Fechar</button>
              </header>
              <dl className="person-facts">
                <div><dt>Nascimento</dt><dd>{detail.birth_date ?? 'desconhecido'}</dd></div>
                <div><dt>Óbito</dt><dd>{detail.death_date ?? 'não documentado'}</dd></div>
                <div><dt>Local de nascimento</dt>
                  <dd>{detail.birth_place_name || detail.birth_place || '—'}</dd></div>
                <div><dt>Situação</dt>
                  <dd>{STATUS_LABELS[detail.status] ?? detail.status}
                    {detail.lifespan_estimated && ' (estimada)'}</dd></div>
                <div><dt>Faixa vital</dt>
                  <dd>{formatYearRange(detail.lifespan_start, detail.lifespan_end,
                    detail.lifespan_estimated)}</dd></div>
                <div><dt>Aparições</dt><dd>{detail.appearances_count} registos</dd></div>
              </dl>
              {detail.notes && <p className="person-notes">{detail.notes}</p>}

              <h3>Eventos documentados</h3>
              {detail.events.length === 0 && (
                <p className="filter-count">Sem eventos — a pessoa ainda não tem
                  menções atribuídas em registros.</p>
              )}
              <ol className="person-events">
                {detail.events.map((event, index) => (
                  <li key={index} className={`person-event kind-${event.kind}`}>
                    <span className="person-event-year">
                      {event.year ?? 's/ data'}
                    </span>
                    <span className="person-event-body">
                      <strong>{event.label}</strong>
                      {event.place && <span className="person-event-place">{event.place}</span>}
                      {event.display_label && (
                        <span className="person-event-record">{event.display_label}</span>
                      )}
                      <span className="person-event-links">
                        {event.record_id && (
                          <Link to={`/records/${event.record_id}`}>Ver registo</Link>
                        )}
                        {event.pages?.map(page => (
                          <Link key={page.id} to={`/viewer/${page.id}`}>
                            {page.filename ?? `Página ${page.page_number ?? ''}`}
                          </Link>
                        ))}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      )}
    </main>
  )
}
