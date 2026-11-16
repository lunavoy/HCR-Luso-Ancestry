import { ChevronDown, ChevronRight, FileBox, ScanLine, SquareDashed, Type } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Annotation, AnnotationType } from '../../types/domain'
import { annotationDisplayLabel } from '../../utils/format'
import { StatusBadge } from '../ui/StatusBadge'

const icons: Record<AnnotationType, typeof FileBox> = {
  record: FileBox,
  region: SquareDashed,
  line: ScanLine,
  word: Type,
}

function TreeItem({ annotation, annotations, selectedId, depth, onSelect, resolveParent }: {
  annotation: Annotation
  annotations: Annotation[]
  selectedId?: string
  depth: number
  onSelect: (id: string) => void
  resolveParent: (item: Annotation) => string | undefined
}) {
  const children = annotations.filter(item => resolveParent(item) === annotation.id).sort((a, b) => a.readingOrder - b.readingOrder)
  const [open, setOpen] = useState(true)
  const Icon = icons[annotation.type]

  return (
    <div className="tree-branch">
      <div className={`tree-item ${annotation.id === selectedId ? 'is-selected' : ''}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
        <button aria-expanded={children.length ? open : undefined} aria-label={children.length ? (open ? 'Recolher itens' : 'Expandir itens') : 'Sem itens filhos'} className="tree-expander" disabled={!children.length} onClick={() => setOpen(value => !value)} type="button">{children.length ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span />}</button>
        <button className="tree-select" onClick={() => onSelect(annotation.id)} type="button">
          <Icon size={15} />
          <span><strong>{annotationDisplayLabel(annotation)}{annotation.type !== 'region' && !annotation.displayLabel ? ` ${annotation.readingOrder}` : ''}</strong><small>{annotation.correctedText || annotation.predictedText || annotation.id}</small></span>
          <StatusBadge status={annotation.status} />
        </button>
      </div>
      {open && children.map(child => <TreeItem annotation={child} annotations={annotations} depth={depth + 1} key={child.id} onSelect={onSelect} resolveParent={resolveParent} selectedId={selectedId} />)}
    </div>
  )
}

export function AnnotationTree({ annotations, selectedId, onSelect }: {
  annotations: Annotation[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  // Região → registro: quando todas as linhas da região pertencem ao mesmo
  // registro, a região passa a ser filha dele na árvore (o registro engloba
  // as regiões que o compõem).
  const regionRecord = useMemo(() => {
    const recordIdsByRegion = new Map<string, Set<string>>()
    for (const item of annotations) {
      if (item.type === 'line' && item.parentId && item.recordId) {
        const set = recordIdsByRegion.get(item.parentId) ?? new Set<string>()
        set.add(item.recordId)
        recordIdsByRegion.set(item.parentId, set)
      }
    }
    const map = new Map<string, string>()
    for (const [regionId, ids] of recordIdsByRegion) {
      if (ids.size === 1) map.set(regionId, [...ids][0])
    }
    return map
  }, [annotations])

  const resolveParent = (item: Annotation) =>
    item.parentId ?? (item.type === 'region' ? regionRecord.get(item.id) : undefined)

  const roots = annotations.filter(annotation => !resolveParent(annotation)).sort((a, b) => a.readingOrder - b.readingOrder)
  return (
    <div className="annotation-tree">
      {roots.map(annotation => <TreeItem annotation={annotation} annotations={annotations} depth={0} key={annotation.id} onSelect={onSelect} resolveParent={resolveParent} selectedId={selectedId} />)}
      {!roots.length && <p className="panel-empty">Ainda não existem anotações nesta página.</p>}
    </div>
  )
}
