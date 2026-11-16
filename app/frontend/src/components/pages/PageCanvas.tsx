import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Label, Layer, Line, Stage, Tag, Text } from 'react-konva'
import { useElementSize } from '../../hooks/useElementSize'
import { useImageElement } from '../../hooks/useImageElement'
import type { Annotation, AnnotationType, Page, Point } from '../../types/domain'
import { annotationDisplayLabel } from '../../utils/format'
import { clamp, flattenPoints, polygonBounds } from '../../utils/geometry'
import { contrastingText, regionColor } from '../../utils/regionColors'

export interface PageCanvasHandle {
  fit: (mode: 'page' | 'width') => void
  actualSize: () => void
  center: () => void
  zoomBy: (factor: number) => void
  finishPolygon: () => void
  cancelPolygon: () => void
}

const annotationColors: Record<AnnotationType, string> = {
  record: '#ff8a00',
  region: '#ff3d81',
  line: '#2b8cff',
  word: '#00e676',
}

const SELECTION_COLOR = '#ffe600'
const BASELINE_COLOR = '#00c8ff'

// Interpolação Catmull-Rom: suaviza a baseline para exibição sem alterar os
// pontos de controle armazenados (que seguem sendo os vértices editáveis).
function smoothCurve(points: Point[], samplesPerSegment = 8): Point[] {
  if (points.length < 3) return points
  const out: Point[] = [points[0]]
  const at = (index: number) => points[Math.max(0, Math.min(points.length - 1, index))]
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = at(index - 1), p1 = at(index), p2 = at(index + 1), p3 = at(index + 2)
    for (let step = 1; step <= samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment, t2 = t * t, t3 = t2 * t
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  return out
}

function groupTransform(rotation: number, page: Page) {
  if (rotation === 90) return { x: page.height, y: 0, rotation }
  if (rotation === 180) return { x: page.width, y: page.height, rotation }
  if (rotation === 270) return { x: 0, y: page.width, rotation }
  return { x: 0, y: 0, rotation: 0 }
}

export const PageCanvas = forwardRef<PageCanvasHandle, {
  page: Page
  annotations: Annotation[]
  selectedId?: string
  tool: 'select' | 'pan' | 'polygon' | 'vertices' | 'line' | 'word'
  visibleTypes: Record<AnnotationType, boolean>
  rotation: number
  onSelect: (id?: string) => void
  onCreate: (polygon: Point[]) => void
  onCreateLine?: (start: Point, end: Point) => void
  onUpdatePolygon: (id: string, polygon: Point[]) => void
  onUpdateBaseline?: (id: string, baseline: Point[]) => void
  showLinePolygons?: boolean
  onZoomChange: (zoom: number) => void
  onDraftChange: (count: number) => void
  onEditVertices?: (id: string) => void
  onDeleteAnnotation?: (id: string) => void
  onImageError?: () => void
  draftLabel?: string
}>(({ page, annotations, selectedId, tool, visibleTypes, rotation, onSelect, onCreate, onUpdatePolygon, onZoomChange, onDraftChange, onEditVertices, onDeleteAnnotation, onUpdateBaseline, showLinePolygons = true, onCreateLine, onImageError, draftLabel }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const groupRef = useRef<Konva.Group>(null)
  const size = useElementSize(containerRef)
  const { image, error } = useImageElement(page.imageUrl)
  const imageErrorNotified = useRef('')
  useEffect(() => {
    // URL assinada expirada → avisa uma vez por fonte para o pai buscar uma nova.
    if (error && onImageError && imageErrorNotified.current !== page.imageUrl) {
      imageErrorNotified.current = page.imageUrl
      onImageError()
    }
  }, [error, onImageError, page.imageUrl])
  const [scale, setScale] = useState(0.5)
  const [position, setPosition] = useState({ x: 40, y: 40 })
  const [draft, setDraft] = useState<Point[]>([])
  const [lineDraft, setLineDraft] = useState<Point[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [vertexDrafts, setVertexDrafts] = useState<Record<string, Point[]>>({})
  const [baselineDrafts, setBaselineDrafts] = useState<Record<string, Point[]>>({})
  const hasFitRef = useRef('')
  const rotatedWidth = rotation % 180 === 0 ? page.width : page.height
  const rotatedHeight = rotation % 180 === 0 ? page.height : page.width
  const transform = groupTransform(rotation, page)

  const applyScale = useCallback((nextScale: number, nextPosition: { x: number; y: number }) => {
    const clampedScale = clamp(nextScale, 0.08, 8)
    setScale(clampedScale)
    setPosition(nextPosition)
    onZoomChange(clampedScale)
  }, [onZoomChange])

  const fit = useCallback((mode: 'page' | 'width') => {
    if (!size.width || !size.height) return
    const padding = 52
    const nextScale = mode === 'width'
      ? (size.width - padding) / rotatedWidth
      : Math.min((size.width - padding) / rotatedWidth, (size.height - padding) / rotatedHeight)
    const safeScale = clamp(nextScale, 0.08, 4)
    applyScale(safeScale, {
      x: Math.max(24, (size.width - rotatedWidth * safeScale) / 2),
      y: Math.max(24, (size.height - rotatedHeight * safeScale) / 2),
    })
  }, [applyScale, rotatedHeight, rotatedWidth, size.height, size.width])

  const center = useCallback(() => setPosition({
    x: (size.width - rotatedWidth * scale) / 2,
    y: (size.height - rotatedHeight * scale) / 2,
  }), [rotatedHeight, rotatedWidth, scale, size.height, size.width])

  const zoomAt = useCallback((factor: number, pointer?: Point) => {
    const anchor = pointer ?? { x: size.width / 2, y: size.height / 2 }
    const nextScale = clamp(scale * factor, 0.08, 8)
    const imagePoint = { x: (anchor.x - position.x) / scale, y: (anchor.y - position.y) / scale }
    applyScale(nextScale, { x: anchor.x - imagePoint.x * nextScale, y: anchor.y - imagePoint.y * nextScale })
  }, [applyScale, position.x, position.y, scale, size.height, size.width])

  const finishPolygon = useCallback(() => {
    if (draft.length < 3) return
    onCreate(draft.map(point => ({ x: Math.round(point.x), y: Math.round(point.y) })))
    setDraft([])
    onDraftChange(0)
  }, [draft, onCreate, onDraftChange])

  useImperativeHandle(ref, () => ({
    fit,
    center,
    zoomBy: factor => zoomAt(factor),
    actualSize: () => applyScale(1, { x: (size.width - rotatedWidth) / 2, y: 32 }),
    finishPolygon,
    cancelPolygon: () => { setDraft([]); setLineDraft([]); setVertexDrafts({}); onDraftChange(0) },
  }), [applyScale, center, fit, finishPolygon, onDraftChange, rotatedWidth, size.width, zoomAt])

  useEffect(() => {
    if (!size.width || !image || hasFitRef.current === `${page.id}-${rotation}`) return
    hasFitRef.current = `${page.id}-${rotation}`
    fit('page')
  }, [fit, image, page.id, rotation, size.width, size.height])

  useEffect(() => {
    setDraft([])
    setLineDraft([])
    setContextMenu(null)
    onDraftChange(0)
  }, [onDraftChange, page.id, tool])

  useEffect(() => {
    setVertexDrafts({})
    setBaselineDrafts({})
  }, [page.id])

  const pointerInImage = (): Point | undefined => {
    const stage = stageRef.current
    const group = groupRef.current
    const pointer = stage?.getPointerPosition()
    if (!pointer || !group) return undefined
    return group.getAbsoluteTransform().copy().invert().point(pointer)
  }

  const handleStageClick = (event: KonvaEventObject<MouseEvent>) => {
    if (tool === 'line') {
      const point = pointerInImage()
      if (!point || point.x < 0 || point.y < 0 || point.x > page.width || point.y > page.height) return
      if (lineDraft.length === 0) {
        setLineDraft([point])
      } else {
        const start = lineDraft[0]
        // Dois cliques quase no mesmo lugar não formam linha.
        if (Math.hypot(point.x - start.x, point.y - start.y) > 8) {
          onCreateLine?.(start, point)
        }
        setLineDraft([])
      }
      return
    }
    if (tool === 'polygon' || tool === 'word') {
      const point = pointerInImage()
      if (!point || point.x < 0 || point.y < 0 || point.x > page.width || point.y > page.height) return
      const next = [...draft, point]
      setDraft(next)
      onDraftChange(next.length)
      return
    }
    if (event.target === event.target.getStage() && tool === 'select') onSelect(undefined)
  }

  const handleContextMenu = (event: KonvaEventObject<MouseEvent>, annotation: Annotation) => {
    event.evt.preventDefault()
    event.cancelBubble = true
    const container = containerRef.current?.getBoundingClientRect()
    if (!container) return
    onSelect(annotation.id)
    setContextMenu({
      x: event.evt.clientX - container.left,
      y: event.evt.clientY - container.top,
      id: annotation.id,
    })
  }

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    zoomAt(event.evt.deltaY > 0 ? 0.9 : 1.1, pointer)
  }

  const draftPolygonFor = (annotation: Annotation) => vertexDrafts[annotation.id] ?? annotation.polygon

  const updateDraftVertex = (annotation: Annotation, index: number, point: Point) => {
    setVertexDrafts(previous => ({
      ...previous,
      [annotation.id]: (previous[annotation.id] ?? annotation.polygon)
        .map((vertex, vertexIndex) => vertexIndex === index ? point : vertex),
    }))
  }

  const insertDraftVertex = (annotation: Annotation, edgeIndex: number) => {
    const polygon = draftPolygonFor(annotation)
    const a = polygon[edgeIndex]
    const b = polygon[(edgeIndex + 1) % polygon.length]
    const midpoint = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }
    setVertexDrafts(previous => ({
      ...previous,
      [annotation.id]: [...polygon.slice(0, edgeIndex + 1), midpoint, ...polygon.slice(edgeIndex + 1)],
    }))
  }

  const removeDraftVertex = (annotation: Annotation, index: number) => {
    const polygon = draftPolygonFor(annotation)
    if (polygon.length <= 3) return
    setVertexDrafts(previous => ({
      ...previous,
      [annotation.id]: polygon.filter((_, vertexIndex) => vertexIndex !== index),
    }))
  }

  const confirmVertexDrafts = () => {
    Object.entries(vertexDrafts).forEach(([id, polygon]) => onUpdatePolygon(id, polygon))
    setVertexDrafts({})
  }

  // Baseline (a linha de base tracejada): polilinha aberta de 2+ pontos.
  // O draft local dá preview durante o arraste; no dragEnd o ponto é
  // commitado via onUpdateBaseline (autosave persiste).
  const baselineFor = (annotation: Annotation): Point[] =>
    baselineDrafts[annotation.id] ?? annotation.baseline ?? []

  const baselineWith = (annotation: Annotation, index: number, point: Point): Point[] =>
    baselineFor(annotation).map((vertex, vertexIndex) =>
      vertexIndex === index ? point : vertex)

  const updateBaselinePoint = (annotation: Annotation, index: number, point: Point) => {
    setBaselineDrafts(previous => ({
      ...previous,
      [annotation.id]: baselineWith(annotation, index, point),
    }))
  }

  const insertBaselinePoint = (annotation: Annotation, edgeIndex: number) => {
    const baseline = baselineFor(annotation)
    const a = baseline[edgeIndex]
    const b = baseline[edgeIndex + 1]
    if (!a || !b) return
    const midpoint = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }
    setBaselineDrafts(previous => ({
      ...previous,
      [annotation.id]: [...baseline.slice(0, edgeIndex + 1), midpoint, ...baseline.slice(edgeIndex + 1)],
    }))
  }

  const removeBaselinePoint = (annotation: Annotation, index: number) => {
    const baseline = baselineFor(annotation)
    if (baseline.length <= 2) return
    const next = baseline.filter((_, vertexIndex) => vertexIndex !== index)
    setBaselineDrafts(previous => ({ ...previous, [annotation.id]: next }))
    onUpdateBaseline?.(annotation.id, next)
  }

  return (
    <div className={`page-canvas ${tool === 'pan' ? 'is-panning' : ''} ${tool === 'polygon' || tool === 'line' || tool === 'word' ? 'is-drawing' : ''}`} ref={containerRef}>
      {error && <div className="canvas-error">Não foi possível carregar a imagem desta página.</div>}
      <Stage
        draggable={tool === 'pan'}
        height={size.height}
        onClick={handleStageClick}
        onDragEnd={event => {
          if (event.target === stageRef.current) {
            setPosition({ x: event.target.x(), y: event.target.y() })
          }
        }}
        onWheel={handleWheel}
        ref={stageRef}
        scaleX={scale}
        scaleY={scale}
        width={size.width}
        x={position.x}
        y={position.y}
      >
        <Layer>
          <Group {...transform} ref={groupRef}>
            {image && <KonvaImage height={page.height} image={image} width={page.width} />}
            {annotations.filter(annotation => visibleTypes[annotation.type]).map(annotation => {
              const selected = annotation.id === selectedId
              const color = annotation.type === 'region'
                ? regionColor(annotation.regionType)
                : annotationColors[annotation.type]
              const displayPolygon = draftPolygonFor(annotation)
              const editingVertices = selected && tool === 'vertices'
              const baselinePoints = baselineFor(annotation)
              return (
                <Group key={annotation.id}>
                  {(annotation.type !== 'line' || showLinePolygons) && (
                  <Line
                    closed
                    fill={`${color}${selected ? '24' : '12'}`}
                    hitStrokeWidth={annotation.type === 'word' ? 22 / scale : 14 / scale}
                    onClick={event => {
                      if (tool === 'select' || tool === 'vertices') {
                        event.cancelBubble = true
                        onSelect(annotation.id)
                      }
                    }}
                    onContextMenu={event => handleContextMenu(event, annotation)}
                    onDblClick={event => {
                      if (tool === 'select' && onEditVertices) {
                        event.cancelBubble = true
                        onEditVertices(annotation.id)
                      }
                    }}
                    points={flattenPoints(displayPolygon)}
                    stroke={selected ? SELECTION_COLOR : color}
                    strokeWidth={(selected ? 2.5 : 1.5) / scale}
                  />
                  )}
                  {annotation.type === 'line' && baselinePoints.length >= 2 && (
                    <Line
                      hitStrokeWidth={showLinePolygons ? 0 : 20 / scale}
                      onClick={event => {
                        if (!showLinePolygons && (tool === 'select' || tool === 'vertices')) {
                          event.cancelBubble = true
                          onSelect(annotation.id)
                        }
                      }}
                      onContextMenu={event => {
                        if (!showLinePolygons) handleContextMenu(event, annotation)
                      }}
                      onDblClick={event => {
                        if (!showLinePolygons && tool === 'select' && onEditVertices) {
                          event.cancelBubble = true
                          onEditVertices(annotation.id)
                        }
                      }}
                      points={flattenPoints(smoothCurve(baselinePoints))}
                      stroke={selected ? SELECTION_COLOR : BASELINE_COLOR}
                      strokeWidth={3 / scale}
                    />
                  )}
                  {editingVertices && annotation.type === 'line' && baselinePoints.length >= 2 && (
                    <>
                      {baselinePoints.map((point, index) => (
                        <Circle
                          draggable
                          fill={BASELINE_COLOR}
                          key={`${annotation.id}-bl-${index}`}
                          onContextMenu={event => {
                            event.evt.preventDefault()
                            event.cancelBubble = true
                            removeBaselinePoint(annotation, index)
                          }}
                          onDragMove={event => updateBaselinePoint(annotation, index, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) })}
                          onDragEnd={event => {
                            const point = { x: Math.round(event.target.x()), y: Math.round(event.target.y()) }
                            const baseline = baselineWith(annotation, index, point)
                            setBaselineDrafts(previous => ({ ...previous, [annotation.id]: baseline }))
                            if (baseline.length >= 2) onUpdateBaseline?.(annotation.id, baseline)
                          }}
                          radius={5 / scale}
                          stroke="#201b12"
                          strokeWidth={1.5 / scale}
                          x={point.x}
                          y={point.y}
                        />
                      ))}
                      {baselinePoints.slice(0, -1).map((point, index) => {
                        const next = baselinePoints[index + 1]
                        return (
                          <Circle
                            fill="#00c8ff88"
                            key={`${annotation.id}-bl-mid-${index}`}
                            onClick={event => {
                              event.cancelBubble = true
                              insertBaselinePoint(annotation, index)
                            }}
                            radius={3.5 / scale}
                            stroke="#00e676"
                            strokeWidth={1 / scale}
                            x={(point.x + next.x) / 2}
                            y={(point.y + next.y) / 2}
                          />
                        )
                      })}
                    </>
                  )}
                  {annotation.type === 'region' && scale > 0.1 && (() => {
                    const bounds = polygonBounds(displayPolygon)
                    const label = annotationDisplayLabel(annotation)
                    const tagWidth = label.length * 5.6 / scale
                    return (
                      <Label
                        listening={false}
                        x={Math.max(0, bounds.x + bounds.width / 2 - tagWidth / 2)}
                        y={Math.max(0, bounds.y - 24 / scale)}
                      >
                        <Tag fill={color} cornerRadius={3 / scale} />
                        <Text fill={contrastingText(color)} fontFamily="Inter, sans-serif" fontSize={10 / scale} padding={3 / scale} text={label} />
                      </Label>
                    )
                  })()}
                  {selected && annotation.type !== 'region' && (
                    <Label x={displayPolygon[0]?.x} y={(displayPolygon[0]?.y ?? 0) - 22 / scale}>
                      <Tag fill={color} cornerRadius={3 / scale} />
                      <Text fill="#fff" fontFamily="Inter, sans-serif" fontSize={11 / scale} padding={4 / scale} text={`${annotationDisplayLabel(annotation)} ${annotation.readingOrder}`} />
                    </Label>
                  )}
                  {editingVertices && (annotation.type !== 'line' || showLinePolygons) && displayPolygon.map((point, index) => (
                    <Circle
                      draggable
                      fill="#ffe600"
                      key={`${annotation.id}-${index}`}
                      onContextMenu={event => {
                        event.evt.preventDefault()
                        event.cancelBubble = true
                        removeDraftVertex(annotation, index)
                      }}
                      onDragMove={event => updateDraftVertex(annotation, index, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) })}
                      onDragEnd={event => updateDraftVertex(annotation, index, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) })}
                      radius={5.5 / scale}
                      stroke="#201b12"
                      strokeWidth={1.5 / scale}
                      x={point.x}
                      y={point.y}
                    />
                  ))}
                  {editingVertices && (annotation.type !== 'line' || showLinePolygons) && displayPolygon.map((point, index) => {
                    const next = displayPolygon[(index + 1) % displayPolygon.length]
                    return (
                      <Circle
                        fill="#ffe600cc"
                        key={`${annotation.id}-mid-${index}`}
                        onClick={event => {
                          event.cancelBubble = true
                          insertDraftVertex(annotation, index)
                        }}
                        radius={3.5 / scale}
                        stroke="#00e676"
                        strokeWidth={1 / scale}
                        x={(point.x + next.x) / 2}
                        y={(point.y + next.y) / 2}
                      />
                    )
                  })}
                </Group>
              )
            })}
            {lineDraft.length > 0 && (
              <Group>
                {lineDraft.length === 2 && (
                  <Line
                    points={flattenPoints(lineDraft)}
                    stroke={BASELINE_COLOR}
                    strokeWidth={3 / scale}
                  />
                )}
                {lineDraft.map((point, index) => (
                  <Circle
                    fill={index === 0 ? BASELINE_COLOR : '#fff'}
                    key={`line-draft-${index}`}
                    radius={5 / scale}
                    stroke={BASELINE_COLOR}
                    strokeWidth={1.5 / scale}
                    x={point.x}
                    y={point.y}
                  />
                ))}
              </Group>
            )}
            {draft.length > 0 && (
              <Group>
                <Line closed={draft.length >= 3} dash={[8 / scale, 5 / scale]} fill="#ffe6001b" points={flattenPoints(draft)} stroke="#ffe600" strokeWidth={2 / scale} />
                {draft.map((point, index) => (
                  <Circle
                    fill={index === 0 && draft.length >= 3 ? '#ffe600' : '#fff'}
                    key={`${point.x}-${point.y}-${index}`}
                    onClick={event => {
                      event.cancelBubble = true
                      if (index === 0 && draft.length >= 3) finishPolygon()
                    }}
                    radius={(index === 0 ? 6 : 4) / scale}
                    stroke="#ffe600"
                    strokeWidth={1.5 / scale}
                    x={point.x}
                    y={point.y}
                  />
                ))}
              </Group>
            )}
          </Group>
        </Layer>
      </Stage>
      <div className="canvas-coordinate-note">Coordenadas da imagem · {page.width} × {page.height} px</div>
      {(tool === 'polygon' || tool === 'word') && <div className="canvas-instruction">{draft.length < 3 ? (draftLabel ?? 'Desenhe o polígono — Enter conclui') : 'Clique no primeiro ponto ou pressione Enter para concluir'}</div>}
      {tool === 'vertices' && selectedId && (
        <div className="canvas-instruction vertex-hint">Arraste vértices · clique num ponto médio para adicionar · botão direito num vértice para excluir</div>
      )}
      {Object.keys(vertexDrafts).length > 0 && (
        <div className="canvas-vertex-bar">
          <span>{Object.keys(vertexDrafts).length === 1 ? 'Edição de vértices pendente' : `${Object.keys(vertexDrafts).length} edições de vértices pendentes`}</span>
          <button onClick={confirmVertexDrafts} type="button">Confirmar</button>
          <button className="is-danger" onClick={() => setVertexDrafts({})} type="button">Descartar</button>
        </div>
      )}
      {contextMenu && (
        <>
          <div className="canvas-context-backdrop" onMouseDown={() => setContextMenu(null)} />
          <div
            className="canvas-context-menu"
            onMouseDown={event => event.stopPropagation()}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { onEditVertices?.(contextMenu.id); setContextMenu(null) }}
              type="button"
            >Editar vértices</button>
            <button
              className="is-danger"
              onClick={() => { onDeleteAnnotation?.(contextMenu.id); setContextMenu(null) }}
              type="button"
            >Excluir</button>
          </div>
        </>
      )}
    </div>
  )
})

PageCanvas.displayName = 'PageCanvas'
