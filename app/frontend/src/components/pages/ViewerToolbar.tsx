import {
  Check,
  Crosshair,
  Expand,
  Focus,
  Hand,
  Maximize,
  MousePointer2,
  Pentagon,
  Redo2,
  RotateCw,
  ScanLine,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { AnnotationType } from '../../types/domain'
import { annotationTypeLabels } from '../../utils/format'
import { IconButton } from '../ui/IconButton'
import type { PageCanvasHandle } from './PageCanvas'

type Tool = 'select' | 'pan' | 'polygon' | 'vertices' | 'zoom'

export function ViewerToolbar({
  canvas,
  tool,
  annotationType,
  zoom,
  canDelete,
  canUndo,
  canRedo,
  draftPoints,
  onTool,
  onAnnotationType,
  onDelete,
  onUndo,
  onRedo,
  onRotate,
  onSave,
}: {
  canvas: React.RefObject<PageCanvasHandle | null>
  tool: Tool
  annotationType: AnnotationType
  zoom: number
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
  draftPoints: number
  onTool: (tool: Tool) => void
  onAnnotationType: (type: AnnotationType) => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onRotate: () => void
  onSave: () => void
}) {
  return (
    <div className="viewer-toolbar">
      <div className="tool-group">
        <IconButton active={tool === 'select'} label="Selecionar" shortcut="V" onClick={() => onTool('select')}><MousePointer2 size={17} /></IconButton>
        <IconButton active={tool === 'pan'} label="Mover imagem" shortcut="H" onClick={() => onTool('pan')}><Hand size={17} /></IconButton>
        <IconButton active={tool === 'polygon'} label="Criar polígono" shortcut="P" onClick={() => onTool('polygon')}><Pentagon size={17} /></IconButton>
        <IconButton active={tool === 'vertices'} label="Editar vértices" shortcut="E" onClick={() => onTool('vertices')}><Crosshair size={17} /></IconButton>
        <IconButton active={tool === 'zoom'} label="Zoom por clique" shortcut="Z" onClick={() => onTool('zoom')}><ZoomIn size={17} /></IconButton>
      </div>
      <div className="tool-separator" />
      <label className="annotation-select">
        <ScanLine size={16} />
        <select value={annotationType} onChange={event => onAnnotationType(event.target.value as AnnotationType)}>
          {(Object.keys(annotationTypeLabels) as AnnotationType[]).map(type => <option key={type} value={type}>{annotationTypeLabels[type]}</option>)}
        </select>
      </label>
      {draftPoints >= 3 && <button className="finish-polygon" onClick={() => canvas.current?.finishPolygon()} type="button"><Check size={15} /> Concluir polígono</button>}
      <div className="toolbar-spacer" />
      <div className="tool-group">
        <IconButton disabled={!canUndo} label="Desfazer" shortcut="Ctrl Z" onClick={onUndo}><Undo2 size={17} /></IconButton>
        <IconButton disabled={!canRedo} label="Refazer" shortcut="Ctrl ⇧ Z" onClick={onRedo}><Redo2 size={17} /></IconButton>
        <IconButton disabled={!canDelete} label="Excluir anotação" shortcut="Delete" onClick={onDelete}><Trash2 size={17} /></IconButton>
      </div>
      <div className="tool-separator" />
      <div className="tool-group zoom-controls">
        <IconButton label="Reduzir" shortcut="−" onClick={() => canvas.current?.zoomBy(0.85)}><ZoomOut size={17} /></IconButton>
        <button className="zoom-value" onClick={() => canvas.current?.actualSize()} title="Zoom atual · clique para 100%" type="button">{Math.round(zoom * 100)}%</button>
        <IconButton label="Ampliar" shortcut="+" onClick={() => canvas.current?.zoomBy(1.18)}><ZoomIn size={17} /></IconButton>
        <IconButton label="Ajustar à tela" shortcut="0" onClick={() => canvas.current?.fit('page')}><Maximize size={17} /></IconButton>
        <IconButton label="Ajustar à largura" onClick={() => canvas.current?.fit('width')}><Expand size={17} /></IconButton>
        <IconButton label="Centralizar" onClick={() => canvas.current?.center()}><Focus size={17} /></IconButton>
        <IconButton label="Rodar 90°" onClick={onRotate}><RotateCw size={17} /></IconButton>
      </div>
      <button className="save-button" onClick={onSave} type="button"><Check size={16} /> Guardar</button>
    </div>
  )
}
