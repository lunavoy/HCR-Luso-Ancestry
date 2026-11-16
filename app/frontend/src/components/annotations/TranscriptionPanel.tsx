import { useMemo, useState } from 'react'
import type { Annotation } from '../../types/domain'
import { regionTypeLabels } from '../../utils/format'
import { polygonBounds } from '../../utils/geometry'
import { contrastingText, regionColor } from '../../utils/regionColors'

const lineText = (line: Annotation) => line.correctedText ?? line.predictedText ?? ''

const RECORD_TYPE_LABELS: Record<string, string> = {
  baptism: 'Batismo', marriage: 'Casamento', death: 'Óbito',
  term: 'Termo', index: 'Índice', other: 'Registro',
}

interface RegionNodeProps {
  region: Annotation
  depth: number
  selectedId?: string
  editingId: string | null
  draft: string
  dropTarget: string | null
  dragLineId: string | null
  childrenOf: Map<string, Annotation[]>
  linesOf: Map<string, Annotation[]>
  onSelect: (id: string) => void
  onStartEdit: (region: Annotation) => void
  onCommitEdit: (regionId: string) => void
  onCancelEdit: () => void
  onDraftChange: (value: string) => void
  onAllowDrop: (event: React.DragEvent, key: string) => void
  onHandleDrop: (event: React.DragEvent, regionId: string, beforeLineId?: string) => void
  lineItem: (line: Annotation, lineIndex: number, regionId?: string) => React.ReactNode
}

function RegionNode({
  region, depth, selectedId, editingId, draft, dropTarget, dragLineId,
  childrenOf, linesOf,
  onSelect, onStartEdit, onCommitEdit, onCancelEdit, onDraftChange,
  onAllowDrop, onHandleDrop, lineItem,
}: RegionNodeProps) {
  const isRecord = region.type === 'record'
  const color = regionColor(region.regionType ?? region.recordType)
  const label = isRecord
    ? (region.displayLabel ?? RECORD_TYPE_LABELS[region.recordType ?? ''] ?? region.recordType ?? 'Registro')
    : (regionTypeLabels[region.regionType ?? ''] ?? region.regionType ?? '')
  const subRegions = childrenOf.get(region.id) ?? []
  const lines = (linesOf.get(region.id) ?? [])
    .slice()
    .sort((a, b) => a.readingOrder - b.readingOrder
      || polygonBounds(a.polygon).y - polygonBounds(b.polygon).y)
  const regionDropKey = `region:${region.id}`

  return (
    <section
      className={`transcription-region transcription-region-depth-${depth} ${dropTarget === regionDropKey ? 'is-drop-region' : ''}`}
      onDragOver={event => onAllowDrop(event, regionDropKey)}
      onDrop={event => onHandleDrop(event, region.id)}
    >
      <header
        className={region.id === selectedId ? 'is-selected' : ''}
        onClick={() => onSelect(region.id)}
        title={isRecord ? 'Registro — selecionar no canvas' : 'Selecionar região no canvas'}
      >
        <span className="region-name">
          {isRecord ? 'Registro' : depth === 0 ? 'Região' : 'Sub-região'}
        </span>
        {isRecord ? (
          <span className="region-tag" style={{ background: color, color: contrastingText(color) }}>{label}</span>
        ) : editingId === region.id ? (
          <input
            autoFocus
            className="region-tag region-tag-input"
            list="transcription-region-types"
            onBlur={() => onCommitEdit(region.id)}
            onChange={event => onDraftChange(event.target.value)}
            onClick={event => event.stopPropagation()}
            onKeyDown={event => {
              if (event.key === 'Enter') onCommitEdit(region.id)
              if (event.key === 'Escape') onCancelEdit()
            }}
            spellCheck={false}
            style={{ background: color, color: contrastingText(color) }}
            value={draft}
          />
        ) : (
          <button
            className="region-tag region-tag-button"
            onClick={event => {
              event.stopPropagation()
              onStartEdit(region)
            }}
            style={{ background: color, color: contrastingText(color) }}
            title="Clique para editar a etiqueta da região"
            type="button"
          >{label || '(sem etiqueta)'}</button>
        )}
      </header>
      {subRegions.map(child => (
        <RegionNode
          key={child.id}
          region={child}
          depth={depth + 1}
          selectedId={selectedId}
          editingId={editingId}
          draft={draft}
          dropTarget={dropTarget}
          dragLineId={dragLineId}
          childrenOf={childrenOf}
          linesOf={linesOf}
          onSelect={onSelect}
          onStartEdit={onStartEdit}
          onCommitEdit={onCommitEdit}
          onCancelEdit={onCancelEdit}
          onDraftChange={onDraftChange}
          onAllowDrop={onAllowDrop}
          onHandleDrop={onHandleDrop}
          lineItem={lineItem}
        />
      ))}
      {lines.length ? (
        <ol className="region-lines">
          {lines.map((line, lineIndex) => lineItem(line, lineIndex, region.id))}
        </ol>
      ) : !subRegions.length ? (
        <p className="region-empty">Sem linhas nesta região.</p>
      ) : null}
    </section>
  )
}

export function TranscriptionPanel({ annotations, selectedId, onSelect, onMoveLine, onRegionType }: {
  annotations: Annotation[]
  selectedId?: string
  onSelect: (id: string) => void
  onMoveLine: (lineId: string, targetRegionId: string, beforeLineId?: string) => void
  onRegionType?: (regionId: string, regionType: string | undefined) => void
}) {
  const [dragLineId, setDragLineId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null)
  const [regionDraft, setRegionDraft] = useState('')

  const startRegionEdit = (region: Annotation) => {
    setEditingRegionId(region.id)
    setRegionDraft(region.regionType ?? '')
  }

  const commitRegionEdit = (regionId: string) => {
    onRegionType?.(regionId, regionDraft.trim() || undefined)
    setEditingRegionId(null)
  }

  const { roots, orphans, childrenOf, linesOf } = useMemo(() => {
    const containers = annotations.filter(
      annotation => annotation.type === 'region' || annotation.type === 'record')
    const containerIds = new Set(containers.map(annotation => annotation.id))
    const childrenOf = new Map<string, Annotation[]>()
    const roots: Annotation[] = []
    for (const container of containers) {
      if (container.parentId && containerIds.has(container.parentId)) {
        const list = childrenOf.get(container.parentId) ?? []
        list.push(container)
        childrenOf.set(container.parentId, list)
      } else {
        roots.push(container)
      }
    }
    const linesOf = new Map<string, Annotation[]>()
    const orphans: Annotation[] = []
    for (const annotation of annotations) {
      if (annotation.type !== 'line') continue
      if (annotation.parentId) {
        const list = linesOf.get(annotation.parentId) ?? []
        list.push(annotation)
        linesOf.set(annotation.parentId, list)
      } else {
        orphans.push(annotation)
      }
    }
    const byPosition = (a: Annotation, b: Annotation) => {
      const ab = polygonBounds(a.polygon)
      const bb = polygonBounds(b.polygon)
      return ab.y - bb.y || ab.x - bb.x || a.readingOrder - b.readingOrder
    }
    roots.sort(byPosition)
    for (const list of childrenOf.values()) list.sort(byPosition)
    for (const list of linesOf.values()) {
      list.sort((a, b) => a.readingOrder - b.readingOrder
        || polygonBounds(a.polygon).y - polygonBounds(b.polygon).y)
    }
    orphans.sort((a, b) => a.readingOrder - b.readingOrder
      || polygonBounds(a.polygon).y - polygonBounds(b.polygon).y)
    return { roots, orphans, childrenOf, linesOf }
  }, [annotations])

  const allowDrop = (event: React.DragEvent, key: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(key)
  }

  const handleDrop = (event: React.DragEvent, regionId: string, beforeLineId?: string) => {
    event.preventDefault()
    event.stopPropagation()
    setDropTarget(null)
    const lineId = event.dataTransfer.getData('text/plain') || dragLineId
    if (lineId) onMoveLine(lineId, regionId, beforeLineId)
    setDragLineId(null)
  }

  const lineItem = (line: Annotation, lineIndex: number, regionId?: string) => {
    const text = lineText(line)
    const dropKey = `${regionId ?? 'orphan'}:${line.id}`
    return (
      <li
        className={`${line.id === selectedId ? 'is-selected' : ''} ${dragLineId === line.id ? 'is-dragging' : ''} ${dropTarget === dropKey ? 'is-drop-target' : ''}`}
        draggable={Boolean(regionId)}
        key={line.id}
        onClick={() => onSelect(line.id)}
        onDragEnd={() => { setDragLineId(null); setDropTarget(null) }}
        onDragOver={event => regionId && allowDrop(event, dropKey)}
        onDragStart={event => {
          event.dataTransfer.setData('text/plain', line.id)
          event.dataTransfer.effectAllowed = 'move'
          setDragLineId(line.id)
        }}
        onDrop={event => regionId && handleDrop(event, regionId, line.id)}
        title={regionId ? 'Arrastar para reordenar ou mover de região' : 'Selecionar linha no canvas'}
      >
        <span className="line-number">{lineIndex + 1}</span>
        <span className={`line-text ${text ? '' : 'is-empty'}`}>
          {text || '(sem texto)'}
        </span>
      </li>
    )
  }

  if (!roots.length && !orphans.length) {
    return (
      <div className="transcription-empty">
        <p>Sem regiões na página. Execute «Segmentar» ou desenhe regiões no canvas.</p>
      </div>
    )
  }

  return (
    <div className="transcription-panel">
      <datalist id="transcription-region-types">
        {Object.keys(regionTypeLabels).map(code => <option key={code} value={code}>{regionTypeLabels[code]}</option>)}
      </datalist>
      {roots.map(region => (
        <RegionNode
          key={region.id}
          region={region}
          depth={0}
          selectedId={selectedId}
          editingId={editingRegionId}
          draft={regionDraft}
          dropTarget={dropTarget}
          dragLineId={dragLineId}
          childrenOf={childrenOf}
          linesOf={linesOf}
          onSelect={onSelect}
          onStartEdit={startRegionEdit}
          onCommitEdit={commitRegionEdit}
          onCancelEdit={() => setEditingRegionId(null)}
          onDraftChange={setRegionDraft}
          onAllowDrop={allowDrop}
          onHandleDrop={handleDrop}
          lineItem={lineItem}
        />
      ))}
      {orphans.length > 0 && (
        <section className="transcription-region is-orphan">
          <header>
            <span className="region-name">Sem região</span>
          </header>
          <ol className="region-lines">
            {orphans.map((line, index) => lineItem(line, index))}
          </ol>
        </section>
      )}
    </div>
  )
}
