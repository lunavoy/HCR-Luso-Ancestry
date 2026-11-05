import { ChevronDown, ChevronRight, FileBox, ScanLine, SquareDashed, Type } from 'lucide-react'
import { useState } from 'react'
import type { Annotation, AnnotationType } from '../../types/domain'
import { annotationTypeLabels } from '../../utils/format'
import { StatusBadge } from '../ui/StatusBadge'

const icons: Record<AnnotationType, typeof FileBox> = {
  record: FileBox,
  region: SquareDashed,
  line: ScanLine,
  word: Type,
}

function TreeItem({ annotation, annotations, selectedId, depth, onSelect }: {
  annotation: Annotation
  annotations: Annotation[]
  selectedId?: string
  depth: number
  onSelect: (id: string) => void
}) {
  const children = annotations.filter(item => item.parentId === annotation.id).sort((a, b) => a.readingOrder - b.readingOrder)
  const [open, setOpen] = useState(true)
  const Icon = icons[annotation.type]

  return (
    <div className="tree-branch">
      <div className={`tree-item ${annotation.id === selectedId ? 'is-selected' : ''}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
        <button className="tree-expander" disabled={!children.length} onClick={() => setOpen(value => !value)} type="button">{children.length ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span />}</button>
        <button className="tree-select" onClick={() => onSelect(annotation.id)} type="button">
          <Icon size={15} />
          <span><strong>{annotationTypeLabels[annotation.type]} {annotation.readingOrder}</strong><small>{annotation.correctedText || annotation.predictedText || annotation.id}</small></span>
          <StatusBadge status={annotation.status} />
        </button>
      </div>
      {open && children.map(child => <TreeItem annotation={child} annotations={annotations} depth={depth + 1} key={child.id} onSelect={onSelect} selectedId={selectedId} />)}
    </div>
  )
}

export function AnnotationTree({ annotations, selectedId, onSelect }: {
  annotations: Annotation[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const roots = annotations.filter(annotation => !annotation.parentId).sort((a, b) => a.readingOrder - b.readingOrder)
  return (
    <div className="annotation-tree">
      {roots.map(annotation => <TreeItem annotation={annotation} annotations={annotations} depth={0} key={annotation.id} onSelect={onSelect} selectedId={selectedId} />)}
      {!roots.length && <p className="panel-empty">Ainda não existem anotações nesta página.</p>}
    </div>
  )
}
