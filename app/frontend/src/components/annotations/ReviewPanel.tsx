import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ListOrdered, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Annotation } from '../../types/domain'
import { annotationDisplayLabel, recordTypeOntologyLabels } from '../../utils/format'
import { StatusBadge } from '../ui/StatusBadge'

export interface ReviewItem {
  annotation: Annotation
  depth: number
  ancestors: string[]
}

const byOrder = (a: Annotation, b: Annotation) => a.readingOrder - b.readingOrder
const byTop = (a: Annotation, b: Annotation) =>
  Math.min(...a.polygon.map(p => p.y), Infinity) - Math.min(...b.polygon.map(p => p.y), Infinity)

/**
 * Fila de revisão da ontologia:
 * registros semânticos → suas linhas → palavras;
 * regiões → linhas sem registro → palavras.
 * Regiões sem texto (selos, carimbos, danos) aparecem para classificação.
 */
export function buildReviewQueue(annotations: Annotation[]): ReviewItem[] {
  const regions = annotations.filter(a => a.type === 'region').sort(byOrder)
  const lines = annotations.filter(a => a.type === 'line')
  const words = annotations.filter(a => a.type === 'word')
  const records = annotations.filter(a => a.type === 'record').sort(byTop)
  const wordsByLine = new Map<string, Annotation[]>()
  for (const word of words) {
    if (word.parentId) wordsByLine.set(word.parentId, [...(wordsByLine.get(word.parentId) ?? []), word])
  }
  for (const list of wordsByLine.values()) list.sort(byOrder)

  const recordOf = new Map<string, string>()
  for (const record of records) {
    const members = new Set(record.memberLineIds ?? [])
    for (const line of lines) if (line.recordId === record.id) members.add(line.id)
    for (const lineId of members) if (!recordOf.has(lineId)) recordOf.set(lineId, record.id)
  }

  const queue: ReviewItem[] = []
  const pushLine = (line: Annotation, depth: number, ancestors: string[]) => {
    queue.push({ annotation: line, depth, ancestors })
    for (const word of wordsByLine.get(line.id) ?? []) {
      queue.push({ annotation: word, depth: depth + 1, ancestors: [...ancestors, line.id] })
    }
  }

  for (const record of records) {
    queue.push({ annotation: record, depth: 0, ancestors: [] })
    const members = lines
      .filter(line => recordOf.get(line.id) === record.id)
      .sort(byTop)
    for (const line of members) pushLine(line, 1, [record.id])
  }

  const regionLines = new Map<string, Annotation[]>()
  for (const line of lines) {
    if (recordOf.has(line.id)) continue
    const regionId = line.parentId ?? ''
    regionLines.set(regionId, [...(regionLines.get(regionId) ?? []), line])
  }
  for (const region of regions) {
    queue.push({ annotation: region, depth: 0, ancestors: [] })
    for (const line of (regionLines.get(region.id) ?? []).sort(byTop)) {
      pushLine(line, 1, [region.id])
    }
    regionLines.delete(region.id)
  }
  // linhas órfãs (sem região ou registro conhecido)
  for (const leftovers of regionLines.values()) {
    for (const line of leftovers.sort(byTop)) pushLine(line, 0, [])
  }
  return queue
}

export function ReviewPanel({ annotations, selectedId, onSelect, onVerify, onDelete }: {
  annotations: Annotation[]
  selectedId?: string
  onSelect: (id: string) => void
  onVerify: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showTree, setShowTree] = useState(false)
  const [cursor, setCursor] = useState<{ id: string; pos: number }>()
  const queue = useMemo(() => buildReviewQueue(annotations), [annotations])
  const visible = queue.filter(item => item.ancestors.every(id => !collapsed[id]))
  const reviewable = queue
  const confirmed = reviewable.filter(item => item.annotation.status === 'verified').length
  const pending = reviewable.filter(item => item.annotation.status !== 'verified')
  const queuePos = useMemo(() => new Map(queue.map((item, index) => [item.annotation.id, index])), [queue])
  const cursorPos = cursor?.pos ?? -1
  const current = pending.find(item => (queuePos.get(item.annotation.id) ?? 0) > cursorPos) ?? pending[0]

  // Autoselect: o item atual da fila fica sempre selecionado no canvas/editor.
  useEffect(() => {
    if (current) onSelect(current.annotation.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.annotation.id])

  const act = (action: 'verify' | 'delete' | 'edit', id: string) => {
    if (action === 'verify') onVerify(id)
    else if (action === 'delete') onDelete(id)
    else { onSelect(id); return }
    // confirmar/excluir → avança para o próximo pendente depois deste item;
    // a posição é guardada porque um item excluído some da fila.
    // editar mantém o cursor, pois o item continua pendente.
    setCursor({ id, pos: queuePos.get(id) ?? cursorPos })
  }

  // Navegação manual entre pendentes: move o cursor para imediatamente antes
  // do item alvo, fazendo dele o atual.
  const goPending = (direction: 1 | -1) => {
    if (!pending.length || !current) return
    const index = pending.findIndex(item => item.annotation.id === current.annotation.id)
    const target = pending[index + direction]
    if (!target) return
    const pos = queuePos.get(target.annotation.id) ?? 0
    setCursor({ id: target.annotation.id, pos: pos - 1 })
  }

  const currentPreview = current
    ? (current.annotation.correctedText || current.annotation.predictedText
        || current.annotation.recordLabel
        || (current.annotation.recordType ? recordTypeOntologyLabels[current.annotation.recordType] : '')
        || '')
    : ''
  const currentAncestors = current
    ? current.ancestors
        .map(id => queue.find(item => item.annotation.id === id)?.annotation)
        .filter((item): item is Annotation => Boolean(item))
        .map(item => `${annotationDisplayLabel(item)} ${item.readingOrder}`)
        .join(' / ')
    : ''

  return (
    <div className="review-panel">
      <div className="review-progress">
        <ListOrdered size={15} />
        <span>{confirmed} de {reviewable.length} confirmados · {pending.length} pendentes</span>
      </div>
      {current ? (
        <div className="review-current">
          <div className="review-current-head">
            <strong>{annotationDisplayLabel(current.annotation)} {current.annotation.readingOrder}</strong>
            {current.annotation.confidence != null && (current.annotation.type === 'line' || current.annotation.type === 'word') && (
              <small className="review-confidence">{Math.round(current.annotation.confidence * 100)}%</small>
            )}
            <StatusBadge status={current.annotation.status} />
          </div>
          {currentAncestors && <small className="review-current-path">{currentAncestors}</small>}
          {(() => {
            const index = pending.findIndex(item => item.annotation.id === current.annotation.id)
            return (
              <div className="review-nav">
                <button className="secondary-button" disabled={index <= 0} onClick={() => goPending(-1)} title="Item pendente anterior" type="button"><ChevronLeft size={14} /> Anterior</button>
                <span>Pendente {index + 1} de {pending.length}</span>
                <button className="secondary-button" disabled={index < 0 || index >= pending.length - 1} onClick={() => goPending(1)} title="Próximo item pendente" type="button">Próximo <ChevronRight size={14} /></button>
              </div>
            )
          })()}
          <p className="review-current-preview">
            {currentPreview || (current.annotation.type === 'region' ? 'Região sem texto associada.' : 'Sem texto reconhecido.')}
          </p>
          <div className="review-current-actions">
            <button className="verify-button" onClick={() => act('verify', current.annotation.id)} type="button">
              <CheckCircle2 size={15} /> Confirmar
            </button>
            <button className="secondary-button" onClick={() => act('edit', current.annotation.id)} type="button">Editar</button>
            <button className="review-delete" onClick={() => act('delete', current.annotation.id)} type="button">
              <Trash2 size={14} /> Excluir
            </button>
          </div>
        </div>
      ) : (
        <div className="review-current review-done">
          <strong>Revisão concluída</strong>
          <p>Todos os itens pendentes foram confirmados ou excluídos. Guarde a página para persistir.</p>
        </div>
      )}
      <button className="review-tree-toggle" onClick={() => setShowTree(value => !value)} type="button">
        {showTree ? 'Ocultar lista completa' : 'Ver lista completa'}
      </button>
      {showTree && (
      <div className="annotation-tree review-tree">
        {visible.map(({ annotation, depth }) => {
          const hasChildren = queue.some(item => item.ancestors.at(-1) === annotation.id)
          const isCollapsed = collapsed[annotation.id] ?? false
          const preview = annotation.correctedText || annotation.predictedText || ''
          return (
            <div className="tree-branch" key={annotation.id}>
              <div className={`tree-item review-item ${annotation.id === selectedId ? 'is-selected' : ''}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
                <button
                  aria-expanded={hasChildren ? !isCollapsed : undefined}
                  aria-label={hasChildren ? (isCollapsed ? 'Expandir itens' : 'Recolher itens') : 'Sem itens filhos'}
                  className="tree-expander"
                  disabled={!hasChildren}
                  onClick={() => setCollapsed(value => ({ ...value, [annotation.id]: !isCollapsed }))}
                  type="button"
                >
                  {hasChildren ? (isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />) : <span />}
                </button>
                <button className="tree-select" onClick={() => onSelect(annotation.id)} type="button">
                  <span><strong>{annotationDisplayLabel(annotation)} {annotation.readingOrder}</strong><small>{preview || annotation.id.slice(0, 8)}</small></span>
                  {annotation.confidence != null && (annotation.type === 'line' || annotation.type === 'word') && (
                    <small className="review-confidence">{Math.round(annotation.confidence * 100)}%</small>
                  )}
                  <StatusBadge status={annotation.status} />
                </button>
                {annotation.status !== 'verified' && (
                  <button
                    className="review-confirm"
                    onClick={() => onVerify(annotation.id)}
                    title="Confirmar sem alterar"
                    type="button"
                  ><CheckCircle2 size={14} /></button>
                )}
              </div>
            </div>
          )
        })}
        {!queue.length && <p className="panel-empty">Ainda não existem anotações nesta página.</p>}
      </div>
      )}
    </div>
  )
}
