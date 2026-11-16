import { Check, ChevronLeft, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiDataService } from '../services/dataService'
import type { RecordDetail, RecordMention, Scribe } from '../types/domain'
import { recordTypeOntologyLabels, regionTypeLabels } from '../utils/format'
import { contrastingText, regionColor } from '../utils/regionColors'

interface FieldDef { key: string; label: string }
interface FieldGroup { title: string; fields: FieldDef[] }

// Campos comuns a todos os tipos de assento (record_content).
const COMMON_FIELD_GROUPS: FieldGroup[] = [
  { title: 'Registro', fields: [
    { key: 'event_datetime', label: 'Data/hora do ato' },
  ]},
  { title: 'Escritor e local', fields: [
    { key: 'scribe_name', label: 'Padre que escreveu o registro' },
    { key: 'parish', label: 'Paróquia / igreja' },
    { key: 'place', label: 'Localidade do ato' },
  ]},
]

const BAPTISM_FIELD_GROUPS: FieldGroup[] = [
  { title: 'Batizado', fields: [
    { key: 'baptized_given_name', label: 'Nome do batizado' },
    { key: 'baptized_gender', label: 'Sexo mencionado' },
    { key: 'legitimacy_status', label: 'Legitimidade (legítimo, natural…)' },
    { key: 'birth_datetime', label: 'Data/hora de nascimento' },
    { key: 'birth_place', label: 'Local de nascimento' },
  ]},
  { title: 'Pai', fields: [
    { key: 'father_name', label: 'Nome completo' },
    { key: 'father_origin', label: 'Naturalidade / origem' },
    { key: 'father_residence', label: 'Residência' },
    { key: 'father_occupation', label: 'Profissão / ocupação' },
    { key: 'father_civil_status', label: 'Estado civil' },
  ]},
  { title: 'Mãe', fields: [
    { key: 'mother_name', label: 'Nome completo' },
    { key: 'mother_origin', label: 'Naturalidade / origem' },
    { key: 'mother_residence', label: 'Residência' },
    { key: 'mother_occupation', label: 'Profissão / ocupação' },
    { key: 'mother_civil_status', label: 'Estado civil' },
  ]},
  { title: 'Família e avós', fields: [
    { key: 'family_residence', label: 'Residência da família' },
    { key: 'parents_marriage_place', label: 'Local do casamento dos pais' },
    { key: 'paternal_grandfather', label: 'Avô paterno' },
    { key: 'paternal_grandmother', label: 'Avó paterna' },
    { key: 'paternal_grandfather_origin', label: 'Naturalidade do avô paterno' },
    { key: 'paternal_grandmother_origin', label: 'Naturalidade da avó paterna' },
    { key: 'maternal_grandfather', label: 'Avô materno' },
    { key: 'maternal_grandmother', label: 'Avó materna' },
    { key: 'maternal_grandfather_origin', label: 'Naturalidade do avô materno' },
    { key: 'maternal_grandmother_origin', label: 'Naturalidade da avó materna' },
  ]},
  { title: 'Padrinhos e testemunhas', fields: [
    { key: 'godfather_name', label: 'Padrinho' },
    { key: 'godfather_civil_status', label: 'Estado civil do padrinho' },
    { key: 'godmother_name', label: 'Madrinha' },
    { key: 'godmother_civil_status', label: 'Estado civil da madrinha' },
    { key: 'witness_a', label: 'Testemunha A' },
    { key: 'witness_a_civil_status', label: 'Estado civil da testemunha A' },
    { key: 'witness_b', label: 'Testemunha B' },
    { key: 'witness_b_civil_status', label: 'Estado civil da testemunha B' },
  ]},
  { title: 'Outros', fields: [
    { key: 'additional_people', label: 'Outras pessoas mencionadas' },
    { key: 'additional_information', label: 'Informações adicionais' },
  ]},
]

const MARRIAGE_FIELD_GROUPS: FieldGroup[] = [
  { title: 'Cônjuge A', fields: [
    { key: 'spouse_a_name', label: 'Nome' },
    { key: 'spouse_a_father_name', label: 'Filho(a) de' },
    { key: 'spouse_a_mother_name', label: 'e de' },
    { key: 'spouse_a_birth_date', label: 'Data de nascimento' },
  ]},
  { title: 'Cônjuge B', fields: [
    { key: 'spouse_b_name', label: 'Nome' },
    { key: 'spouse_b_father_name', label: 'Filho(a) de' },
    { key: 'spouse_b_mother_name', label: 'e de' },
    { key: 'spouse_b_birth_date', label: 'Data de nascimento' },
  ]},
  { title: 'Testemunhas e outros', fields: [
    { key: 'witness_a', label: 'Testemunha A' },
    { key: 'witness_b', label: 'Testemunha B' },
    { key: 'dispensations', label: 'Dispensas' },
    { key: 'regime', label: 'Regime de bens' },
    { key: 'additional_information', label: 'Informações adicionais' },
  ]},
]

const DEATH_FIELD_GROUPS: FieldGroup[] = [
  { title: 'Falecido', fields: [
    { key: 'deceased_name', label: 'Nome do falecido' },
    { key: 'deceased_age', label: 'Idade' },
    { key: 'deceased_birth_date', label: 'Data de nascimento' },
    { key: 'deceased_birth_place', label: 'Local de nascimento' },
  ]},
  { title: 'Óbito e sepultura', fields: [
    { key: 'burial_datetime', label: 'Data/hora do enterro' },
    { key: 'burial_place', label: 'Local do enterro' },
    { key: 'cause_of_death', label: 'Causa da morte' },
  ]},
  { title: 'Informante', fields: [
    { key: 'informant_name', label: 'Nome do informante' },
    { key: 'informant_relation', label: 'Grau de parentesco' },
    { key: 'sacraments', label: 'Sacramentos recebidos' },
    { key: 'additional_information', label: 'Informações adicionais' },
  ]},
]

const FIELD_GROUPS_BY_TYPE: Record<string, FieldGroup[]> = {
  baptism: [...COMMON_FIELD_GROUPS, ...BAPTISM_FIELD_GROUPS],
  marriage: [...COMMON_FIELD_GROUPS, ...MARRIAGE_FIELD_GROUPS],
  death: [...COMMON_FIELD_GROUPS, ...DEATH_FIELD_GROUPS],
}

const ALL_FIELD_GROUPS = [
  ...COMMON_FIELD_GROUPS, ...BAPTISM_FIELD_GROUPS,
  ...MARRIAGE_FIELD_GROUPS, ...DEATH_FIELD_GROUPS,
]

const FIELD_LABELS = new Map(ALL_FIELD_GROUPS.flatMap(group => group.fields.map(field => [field.key, field.label] as const)))

// Campos obrigatórios por tipo: sem eles o registro não passa na validação.
const REQUIRED_BY_TYPE: Record<string, { key: string; label: string; alternatives?: string[] }[]> = {
  baptism: [
    { key: 'event_datetime', label: 'Data do batismo' },
    { key: 'baptized_given_name', label: 'Nome do batizado' },
    { key: 'parish', label: 'Igreja ou paróquia', alternatives: ['place'] },
  ],
  marriage: [
    { key: 'event_datetime', label: 'Data do casamento' },
    { key: 'spouse_a_name', label: 'Nome de um dos noivos', alternatives: ['spouse_b_name'] },
    { key: 'parish', label: 'Igreja ou paróquia', alternatives: ['place'] },
  ],
  death: [
    { key: 'event_datetime', label: 'Data do óbito' },
    { key: 'deceased_name', label: 'Nome do falecido' },
    { key: 'parish', label: 'Igreja ou paróquia', alternatives: ['place'] },
  ],
}

interface Token {
  gid: number
  lineId: string
  tokenIndex: number
  start: number
  end: number
  text: string
}
interface LineView { key: string; lineId: string; raw: string; tokens: Token[] }
interface SectionView { key: string; regionType: string; role: string; lines: LineView[] }

interface MentionSeg {
  lineId: string
  tokenStart: number
  tokenEnd: number
  charStart: number
  charEnd: number
  text: string
}
interface Mention { key: string; field: string; seq: number; segments: MentionSeg[] }

function tokenize(lineId: string, raw: string, startGid: number): { tokens: Token[]; nextGid: number } {
  const tokens: Token[] = []
  const pattern = /\S+/g
  let match: RegExpExecArray | null
  let gid = startGid
  while ((match = pattern.exec(raw)) !== null) {
    tokens.push({ gid, lineId, tokenIndex: tokens.length, start: match.index, end: match.index + match[0].length, text: match[0] })
    gid += 1
  }
  return { tokens, nextGid: gid }
}

function mentionsFromRows(rows: RecordMention[]): Mention[] {
  const groups = new Map<string, Mention>()
  for (const row of rows) {
    let mention = groups.get(row.group_key)
    if (!mention) {
      mention = { key: row.group_key, field: row.field_name, seq: row.seq, segments: [] }
      groups.set(row.group_key, mention)
    }
    mention.segments.push({
      lineId: row.line_id ?? '',
      tokenStart: row.token_start ?? 0,
      tokenEnd: row.token_end ?? 0,
      charStart: row.char_start ?? 0,
      charEnd: row.char_end ?? 0,
      text: row.text,
    })
  }
  return [...groups.values()].sort((a, b) => a.seq - b.seq)
}

export function RecordDetailPage() {
  const { recordId } = useParams()
  const [detail, setDetail] = useState<RecordDetail | null>(null)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ anchor: number; focus: number } | null>(null)
  const [shiftGids, setShiftGids] = useState<Set<number>>(new Set())
  const [scribes, setScribes] = useState<Scribe[]>([])
  const dragGid = useRef<number | null>(null)

  useEffect(() => {
    apiDataService.listScribes().then(setScribes).catch(() => setScribes([]))
  }, [])

  const assignRecordScribe = async (scribeId: string | null) => {
    if (!recordId || !detail) return
    const previous = detail.record.scribe_id ?? null
    setDetail({ ...detail, record: { ...detail.record, scribe_id: scribeId } })
    try {
      await apiDataService.updateRecord(recordId, { scribeId })
    } catch {
      setDetail({ ...detail, record: { ...detail.record, scribe_id: previous } })
    }
  }

  useEffect(() => {
    if (!recordId) return
    setLoading(true)
    apiDataService.getRecord(recordId)
      .then(data => {
        setDetail(data)
        setMentions(mentionsFromRows(data.mentions ?? []))
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar o registro.'))
      .finally(() => setLoading(false))
  }, [recordId])

  // Fim do arraste: solta o botão do mouse em qualquer lugar da janela.
  useEffect(() => {
    const up = () => { dragGid.current = null }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // Transcrição → seções → linhas → tokens (palavras) na ordem de leitura.
  const view = useMemo(() => {
    const sections: SectionView[] = []
    const allTokens: Token[] = []
    const rawByLine = new Map<string, string>()
    let gid = 0
    ;(detail?.transcription.sections ?? []).forEach((section, sectionIndex) => {
      const lines: LineView[] = []
      section.lines.forEach((line, lineIndex) => {
        rawByLine.set(line.line_id, line.text)
        const { tokens, nextGid } = tokenize(line.line_id, line.text, gid)
        gid = nextGid
        allTokens.push(...tokens)
        lines.push({ key: `${sectionIndex}-${lineIndex}`, lineId: line.line_id, raw: line.text, tokens })
      })
      sections.push({ key: `s${sectionIndex}`, regionType: section.region_type, role: section.role, lines })
    })
    const tokenByKey = new Map<string, Token>()
    for (const token of allTokens) tokenByKey.set(`${token.lineId}:${token.tokenIndex}`, token)
    return { sections, allTokens, rawByLine, tokenByKey }
  }, [detail])

  // tokenKey → campo atribuído (para colorir a transcrição).
  const tokenField = useMemo(() => {
    const map = new Map<string, { field: string; mentionKey: string }>()
    for (const mention of mentions) {
      for (const segment of mention.segments) {
        for (let index = segment.tokenStart; index <= segment.tokenEnd; index += 1) {
          map.set(`${segment.lineId}:${index}`, { field: mention.field, mentionKey: mention.key })
        }
      }
    }
    return map
  }, [mentions])

  const pendingGids = useMemo(() => {
    const gids = new Set(shiftGids)
    if (pending) {
      const lo = Math.min(pending.anchor, pending.focus)
      const hi = Math.max(pending.anchor, pending.focus)
      for (const token of view.allTokens.slice(lo, hi + 1)) gids.add(token.gid)
    }
    return gids
  }, [pending, shiftGids, view])

  const hasPending = pending !== null || shiftGids.size > 0

  const fieldValues = useMemo(() => {
    const values: Record<string, string[]> = {}
    const seen = new Map<string, Set<string>>()
    for (const mention of mentions) {
      const text = mention.segments.map(segment => segment.text).filter(Boolean).join(' ').trim()
      if (!text) continue
      const bucket = values[mention.field] ?? (values[mention.field] = [])
      // Dedupe normalizado (NFC + minúsculas): "José" e "Jose+acento" são
      // a mesma palavra — o nome repetido em título e parágrafo conta 1x.
      const keys = seen.get(mention.field) ?? new Set<string>()
      seen.set(mention.field, keys)
      const norm = text.normalize('NFC').toLocaleLowerCase('pt-PT')
      if (!keys.has(norm)) {
        keys.add(norm)
        bucket.push(text)
      }
    }
    return Object.fromEntries(Object.entries(values).map(([key, texts]) => [key, texts.join(' ')]))
  }, [mentions])

  if (loading) return <main className="page-shell"><p className="filter-count">A carregar…</p></main>
  if (!detail) return <main className="page-shell"><p className="filter-count">{error || 'Registro não encontrado.'}</p></main>

  const record = detail.record
  const typeLabel = recordTypeOntologyLabels[record.record_type] ?? record.record_type
  const fieldGroups = FIELD_GROUPS_BY_TYPE[record.record_type] ?? COMMON_FIELD_GROUPS
  const requiredDefs = REQUIRED_BY_TYPE[record.record_type] ?? []
  const missingRequired = requiredDefs.filter(item => {
    const keys = [item.key, ...(item.alternatives ?? [])]
    return !keys.some(key => (fieldValues[key] ?? '').trim())
  })

  const onTokenMouseDown = (event: MouseEvent, gid: number) => {
    if (event.shiftKey) {
      // Shift+clique: acumula/remove palavras soltas da seleção pendente.
      setShiftGids(current => {
        const next = new Set(current)
        if (next.has(gid)) next.delete(gid)
        else next.add(gid)
        return next
      })
      return
    }
    dragGid.current = gid
    setPending({ anchor: gid, focus: gid })
  }
  const onTokenMouseEnter = (gid: number) => {
    if (dragGid.current !== null) setPending({ anchor: dragGid.current, focus: gid })
  }

  // Botão direito: remove a palavra da atribuição; sem atribuição, cancela
  // a seleção pendente.
  const onTokenContextMenu = (event: MouseEvent, token: Token) => {
    event.preventDefault()
    if (event.shiftKey) {
      // Shift+botão direito: tira a palavra da seleção acumulada.
      setShiftGids(current => {
        if (!current.has(token.gid)) return current
        const next = new Set(current)
        next.delete(token.gid)
        return next
      })
      return
    }
    const assigned = tokenField.get(`${token.lineId}:${token.tokenIndex}`)
    if (assigned) {
      removeWordFromMention(assigned.mentionKey, token.lineId, token.tokenIndex)
      return
    }
    if (pendingGids.has(token.gid)) {
      setPending(null)
      setShiftGids(new Set())
    }
  }

  const rebuildSegment = (lineId: string, tokenStart: number, tokenEnd: number): MentionSeg | null => {
    if (tokenEnd < tokenStart) return null
    const first = view.tokenByKey.get(`${lineId}:${tokenStart}`)
    const last = view.tokenByKey.get(`${lineId}:${tokenEnd}`)
    if (!first || !last) return null
    const raw = view.rawByLine.get(lineId) ?? ''
    return {
      lineId, tokenStart, tokenEnd,
      charStart: first.start, charEnd: last.end,
      text: raw.slice(first.start, last.end),
    }
  }

  const removeWordFromMention = (mentionKey: string, lineId: string, tokenIndex: number) => {
    setMentions(current => current
      .map(mention => {
        if (mention.key !== mentionKey) return mention
        const segments = mention.segments.flatMap(segment => {
          if (segment.lineId !== lineId || tokenIndex < segment.tokenStart || tokenIndex > segment.tokenEnd) {
            return [segment]
          }
          return [
            rebuildSegment(lineId, segment.tokenStart, tokenIndex - 1),
            rebuildSegment(lineId, tokenIndex + 1, segment.tokenEnd),
          ].filter((seg): seg is MentionSeg => seg !== null)
        })
        return { ...mention, segments }
      })
      .filter(mention => mention.segments.length > 0))
  }

  const assignPending = (field: string) => {
    if (!hasPending) return
    // Junta o intervalo do arraste com as palavras do Shift+clique.
    const gids = [...pendingGids].sort((a, b) => a - b)
    const tokens = gids.map(gid => view.allTokens[gid]).filter(Boolean)
    if (!tokens.length) return
    // Agrupa por linha e divide em sequências contíguas de palavras.
    const byLine = new Map<string, Token[]>()
    for (const token of tokens) {
      const list = byLine.get(token.lineId) ?? []
      list.push(token)
      byLine.set(token.lineId, list)
    }
    const segments: MentionSeg[] = []
    for (const [lineId, lineTokens] of byLine) {
      const sorted = [...lineTokens].sort((a, b) => a.tokenIndex - b.tokenIndex)
      let runStart = 0
      for (let index = 1; index <= sorted.length; index += 1) {
        const contiguous = index < sorted.length && sorted[index].tokenIndex === sorted[index - 1].tokenIndex + 1
        if (!contiguous) {
          const segment = rebuildSegment(lineId, sorted[runStart].tokenIndex, sorted[index - 1].tokenIndex)
          if (segment) segments.push(segment)
          runStart = index
        }
      }
    }
    setMentions(current => [...current, {
      key: `m${Date.now().toString(36)}${current.length}`,
      field,
      seq: current.length,
      segments,
    }])
    setPending(null)
    setShiftGids(new Set())
  }

  const removeMention = (key: string) => {
    setMentions(current => current.filter(mention => mention.key !== key))
  }

  const save = async (markVerified: boolean) => {
    if (!recordId) return
    if (missingRequired.length) {
      setError(`Faltam campos obrigatórios: ${missingRequired.map(item => item.label).join(', ')}.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      let seq = 0
      const rows = mentions.flatMap(mention => mention.segments.map(segment => ({
        group_key: mention.key,
        field_name: mention.field,
        line_id: segment.lineId,
        token_start: segment.tokenStart,
        token_end: segment.tokenEnd,
        char_start: segment.charStart,
        char_end: segment.charEnd,
        text: segment.text,
        seq: (seq += 1),
      })))
      await apiDataService.saveRecordMentions(recordId, rows, markVerified)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
      const fresh = await apiDataService.getRecord(recordId)
      setDetail(fresh)
      setMentions(mentionsFromRows(fresh.mentions ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell record-detail">
      <section className="page-heading">
        <p className="eyebrow">
          <Link to="/validation"><ChevronLeft size={13} style={{ verticalAlign: '-2px' }} /> Validação</Link>
          {' · '}{detail.document?.title}
        </p>
        <h1>{record.display_label ?? `${typeLabel}${record.record_label ? ` — ${record.record_label}` : ''}`}</h1>
        <p>Arraste sobre as palavras ou use Shift+clique para selecioná-las e escolha o campo correspondente. Cada marcação treina a IA de sintaxe.</p>
        <label className="record-scribe"><span>Escriba deste assento</span>
          <select value={record.scribe_id ?? ''} onChange={event => assignRecordScribe(event.target.value || null)}>
            <option value="">Por identificar…</option>
            {scribes.map(scribe => <option key={scribe.id} value={scribe.id}>{scribe.name}</option>)}
          </select>
          <small>Quem assinou este registro — permite marcar a troca de pároco dentro do livro.</small>
        </label>
      </section>

      <div className="record-required">
        {requiredDefs.map(item => {
          const keys = [item.key, ...(item.alternatives ?? [])]
          const ok = keys.some(key => (fieldValues[key] ?? '').trim())
          return <span key={item.key} className={`required-chip ${ok ? 'is-ok' : 'is-missing'}`}>{ok ? '✓' : '•'} {item.label}</span>
        })}
        {missingRequired.length > 0 && <span className="required-hint">obrigatórios para salvar</span>}
      </div>

      <div className="record-detail-grid">
        <section className="record-transcription validation-text">
          {view.sections.map(section => {
            const color = regionColor(section.regionType)
            const label = regionTypeLabels[section.regionType] ?? section.regionType
            return (
              <div className="record-section" key={section.key}>
                <header>
                  <span className="region-tag" style={{ background: color, color: contrastingText(color) }}>{label}</span>
                  {section.role !== 'body' && <span className="region-name">{section.role}</span>}
                </header>
                <ol>
                  {section.lines.map((line, lineIndex) => (
                    <li key={line.key}>
                      <span className="line-number">{lineIndex + 1}</span>
                      <span className="line-text">
                        {line.tokens.length === 0 && <span className="vtok">{line.raw || '(sem texto)'}</span>}
                        {line.tokens.map(token => {
                          const assigned = tokenField.get(`${token.lineId}:${token.tokenIndex}`)
                          const isPending = pendingGids.has(token.gid)
                          const style = assigned
                            ? { background: regionColor(assigned.field), color: contrastingText(regionColor(assigned.field)) }
                            : undefined
                          return (
                            <span
                              className={`vtok ${isPending ? 'is-pending' : ''} ${assigned ? 'is-assigned' : ''}`}
                              key={token.gid}
                              onContextMenu={event => onTokenContextMenu(event, token)}
                              onMouseDown={event => onTokenMouseDown(event, token.gid)}
                              onMouseEnter={() => onTokenMouseEnter(token.gid)}
                              style={style}
                              title={assigned
                                ? `${FIELD_LABELS.get(assigned.field) ?? assigned.field} — botão direito remove esta palavra`
                                : 'Botão direito cancela a seleção'}
                            >{token.text}</span>
                          )
                        })}
                        {' '}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
          {!view.sections.length && <p className="filter-count">Sem linhas associadas a este registro.</p>}
          {hasPending && <p className="validation-hint">Seleção ativa — escolha o campo no painel à direita.</p>}
        </section>

        <section className="record-form field-menu">
          <h2>Campos do registro</h2>
          <p className="validation-hint-static">Clique num campo para atribuir as palavras selecionadas.</p>
          {fieldGroups.map(group => (
            <fieldset className="record-field-group" key={group.title}>
              <legend>{group.title}</legend>
              {group.fields.map(field => {
                const value = fieldValues[field.key]
                const required = requiredDefs.some(item => item.key === field.key || item.alternatives?.includes(field.key))
                return (
                  <button
                    className={`field-assign ${value ? 'has-value' : ''}`}
                    disabled={!hasPending}
                    key={field.key}
                    onClick={() => assignPending(field.key)}
                    title={value || field.label}
                    type="button"
                  >
                    <span className="field-assign-label">{field.label}{required ? ' *' : ''}</span>
                    {value && <span className="field-assign-value">{value}</span>}
                  </button>
                )
              })}
            </fieldset>
          ))}

          {mentions.length > 0 && (
            <fieldset className="record-field-group">
              <legend>Atribuições ({mentions.length})</legend>
              {mentions.map(mention => (
                <div className="mention-row" key={mention.key}>
                  <span className="mention-field" style={{ background: regionColor(mention.field), color: contrastingText(regionColor(mention.field)) }}>
                    {FIELD_LABELS.get(mention.field) ?? mention.field}
                  </span>
                  <span className="mention-text" title={mention.segments.map(segment => segment.text).join(' ')}>
                    {mention.segments.map(segment => segment.text).join(' ')}
                  </span>
                  <button className="mention-remove" onClick={() => removeMention(mention.key)} title="Remover atribuição" type="button">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </fieldset>
          )}

          <div className="record-form-actions">
            <button className="save-button" disabled={saving || missingRequired.length > 0} onClick={() => void save(false)} type="button">
              <Check size={16} /> {saving ? 'A salvar…' : 'Salvar alterações'}
            </button>
            <button className="secondary-button" disabled={saving || missingRequired.length > 0} onClick={() => void save(true)} type="button">
              Salvar e verificar
            </button>
            {(detail.pages ?? []).map(page => (
              <Link
                className="secondary-button"
                key={page.id}
                to={`/viewer/${page.id}`}
              >Abrir Pág. {page.page_number ?? '?'}{page.filename ? ` · ${page.filename}` : ''}</Link>
            ))}
          </div>
          {saved && <p className="saved-toast" style={{ position: 'static' }}>Guardado — alimenta o treino da IA de sintaxe.</p>}
          {error && <p className="saved-toast" style={{ position: 'static' }}>{error}</p>}
        </section>
      </div>
    </main>
  )
}
