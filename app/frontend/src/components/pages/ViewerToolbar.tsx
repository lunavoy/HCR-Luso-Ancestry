import {
  Check,
  Expand,
  Focus,
  Hand,
  Layers,
  Maximize,
  MousePointer2,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Spline,
  RotateCw,
  Square,
  Trash2,
  Undo2,
  WholeWord,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useState } from 'react'
import type { AnnotationType } from '../../types/domain'
import { annotationTypeLabels } from '../../utils/format'
import { IconButton } from '../ui/IconButton'
import type { PageCanvasHandle } from './PageCanvas'

type Tool = 'select' | 'pan' | 'polygon' | 'vertices' | 'line' | 'word'
export type DrawKind = 'region' | 'subregion'

const FILTER_TYPES: AnnotationType[] = ['region', 'line', 'word', 'record']

export function ViewerToolbar({
  canvas,
  tool,
  zoom,
  canDelete,
  canUndo,
  canRedo,
  draftPoints,
  visibleTypes,
  showLinePolygons = false,
  onToggleLinePolygons,
  drawKind,
  onTool,
  onDraw,
  onToggleType,
  onDelete,
  onUndo,
  onRedo,
  onRotate,
  onSave,
  saveDisabled,
}: {
  canvas: React.RefObject<PageCanvasHandle | null>
  tool: Tool
  zoom: number
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
  draftPoints: number
  visibleTypes: Record<AnnotationType, boolean>
  showLinePolygons?: boolean
  onToggleLinePolygons?: () => void
  drawKind?: DrawKind | null
  onTool: (tool: Tool) => void
  onDraw?: (kind: DrawKind) => void
  onToggleType: (type: AnnotationType) => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onRotate: () => void
  onSave: () => void
  saveDisabled?: boolean
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const hiddenCount = FILTER_TYPES.filter(type => !visibleTypes[type]).length

  const adding = tool === 'word' || tool === 'line' || (tool === 'polygon' && Boolean(drawKind))

  const pickAdd = (action: () => void) => {
    setAddOpen(false)
    action()
  }

  return (
    <div className="viewer-toolbar">
      <div className="tool-group">
        <IconButton active={tool === 'select'} label="Selecionar" shortcut="V" onClick={() => onTool('select')}><MousePointer2 size={17} /></IconButton>
        <IconButton active={tool === 'pan'} label="Mover imagem" shortcut="H" onClick={() => onTool('pan')}><Hand size={17} /></IconButton>
        <div className="filter-wrapper">
          <IconButton
            active={addOpen || adding}
            label="Acrescentar novo — palavra, linha ou região"
            onClick={() => setAddOpen(open => !open)}
          ><Plus size={17} /></IconButton>
          {addOpen && (
            <>
              <div className="filter-backdrop" onMouseDown={() => setAddOpen(false)} />
              <div className="filter-popover add-popover">
                <p className="filter-title">O que você quer acrescentar?</p>
                <button className="add-option" onClick={() => pickAdd(() => onTool('word'))} type="button">
                  <WholeWord size={15} />
                  <span><strong>Nova palavra</strong><small>Contorno de uma palavra — o pai é a linha que a contém.</small></span>
                </button>
                <button className="add-option" onClick={() => pickAdd(() => onTool('line'))} type="button">
                  <PenLine size={15} />
                  <span><strong>Nova linha</strong><small>Dois cliques na base do texto — a faixa é gerada sozinha.</small></span>
                </button>
                <button className="add-option" onClick={() => pickAdd(() => onDraw?.('region'))} type="button">
                  <Pencil size={15} />
                  <span><strong>Nova região</strong><small>Áreas de nível superior: número de página, selo, termo, registro…</small></span>
                </button>
                <button className="add-option" onClick={() => pickAdd(() => onDraw?.('subregion'))} type="button">
                  <Square size={15} />
                  <span><strong>Nova sub-região</strong><small>Parte dentro de uma região: cabeçalho, rodapé, anotação, assinatura…</small></span>
                </button>
              </div>
            </>
          )}
        </div>
        <IconButton
          active={tool === 'vertices'}
          label="Editar vértices de uma anotação existente"
          shortcut="E"
          onClick={() => onTool('vertices')}
        ><Spline size={17} /></IconButton>
      </div>
      <div className="tool-separator" />
      <div className="filter-wrapper">
        <IconButton
          active={filterOpen || hiddenCount > 0}
          label={hiddenCount ? `Filtro de camadas (${hiddenCount} ocultas)` : 'Filtro de camadas'}
          onClick={() => setFilterOpen(open => !open)}
        ><Layers size={17} /></IconButton>
        {filterOpen && (
          <>
            <div className="filter-backdrop" onMouseDown={() => setFilterOpen(false)} />
            <div className="filter-popover">
              <p className="filter-title">Mostrar no canvas</p>
              {FILTER_TYPES.map(type => (
                <label className="filter-option" key={type}>
                  <input
                    checked={visibleTypes[type]}
                    onChange={() => onToggleType(type)}
                    type="checkbox"
                  />
                  <span className={`layer-dot layer-${type}`} />
                  {annotationTypeLabels[type]}
                </label>
              ))}
              <div className="filter-divider" />
              <label className="filter-option">
                <input
                  checked={showLinePolygons}
                  onChange={() => onToggleLinePolygons?.()}
                  type="checkbox"
                />
                <span className="layer-dot layer-line" />
                Contorno (polígono) das linhas
              </label>
              <p className="filter-hint">Desligado, as linhas mostram só a linha de base tracejada — mais limpo para corrigir.</p>
            </div>
          </>
        )}
      </div>
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
      <button className="save-button" disabled={saveDisabled} onClick={onSave} type="button"><Check size={16} /> Salvar alterações</button>
    </div>
  )
}
