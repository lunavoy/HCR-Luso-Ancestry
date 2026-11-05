import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Label, Layer, Line, Stage, Tag, Text } from 'react-konva'
import { useElementSize } from '../../hooks/useElementSize'
import { useImageElement } from '../../hooks/useImageElement'
import type { Annotation, AnnotationType, Page, Point } from '../../types/domain'
import { annotationTypeLabels } from '../../utils/format'
import { clamp, flattenPoints } from '../../utils/geometry'

export interface PageCanvasHandle {
  fit: (mode: 'page' | 'width') => void
  actualSize: () => void
  center: () => void
  zoomBy: (factor: number) => void
  finishPolygon: () => void
  cancelPolygon: () => void
}

const annotationColors: Record<AnnotationType, string> = {
  record: '#b7853b',
  region: '#8a75ad',
  line: '#4f7fa4',
  word: '#5d8c72',
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
  tool: 'select' | 'pan' | 'polygon' | 'vertices' | 'zoom'
  annotationType: AnnotationType
  rotation: number
  onSelect: (id?: string) => void
  onCreate: (polygon: Point[]) => void
  onUpdatePolygon: (id: string, polygon: Point[]) => void
  onZoomChange: (zoom: number) => void
  onDraftChange: (count: number) => void
}>(({ page, annotations, selectedId, tool, annotationType, rotation, onSelect, onCreate, onUpdatePolygon, onZoomChange, onDraftChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const groupRef = useRef<Konva.Group>(null)
  const size = useElementSize(containerRef)
  const { image, error } = useImageElement(page.imageUrl)
  const [scale, setScale] = useState(0.5)
  const [position, setPosition] = useState({ x: 40, y: 40 })
  const [draft, setDraft] = useState<Point[]>([])
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
    cancelPolygon: () => { setDraft([]); onDraftChange(0) },
  }), [applyScale, center, fit, finishPolygon, onDraftChange, rotatedWidth, size.width, zoomAt])

  useEffect(() => {
    if (!size.width || !image || hasFitRef.current === `${page.id}-${rotation}`) return
    hasFitRef.current = `${page.id}-${rotation}`
    fit('page')
  }, [fit, image, page.id, rotation, size.width, size.height])

  useEffect(() => {
    setDraft([])
    onDraftChange(0)
  }, [onDraftChange, page.id, tool])

  const pointerInImage = (): Point | undefined => {
    const stage = stageRef.current
    const group = groupRef.current
    const pointer = stage?.getPointerPosition()
    if (!pointer || !group) return undefined
    return group.getAbsoluteTransform().copy().invert().point(pointer)
  }

  const handleStageClick = (event: KonvaEventObject<MouseEvent>) => {
    if (tool === 'zoom') {
      const pointer = stageRef.current?.getPointerPosition()
      if (pointer) zoomAt(event.evt.shiftKey ? 0.85 : 1.18, pointer)
      return
    }
    if (tool === 'polygon') {
      const point = pointerInImage()
      if (!point || point.x < 0 || point.y < 0 || point.x > page.width || point.y > page.height) return
      const next = [...draft, point]
      setDraft(next)
      onDraftChange(next.length)
      return
    }
    if (event.target === event.target.getStage() && tool === 'select') onSelect(undefined)
  }

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    zoomAt(event.evt.deltaY > 0 ? 0.9 : 1.1, pointer)
  }

  const updateVertex = (annotation: Annotation, index: number, point: Point) => {
    onUpdatePolygon(annotation.id, annotation.polygon.map((vertex, vertexIndex) => vertexIndex === index ? point : vertex))
  }

  return (
    <div className={`page-canvas ${tool === 'pan' ? 'is-panning' : ''} ${tool === 'polygon' ? 'is-drawing' : ''} ${tool === 'zoom' ? 'is-zooming' : ''}`} ref={containerRef}>
      {error && <div className="canvas-error">Não foi possível carregar a imagem desta página.</div>}
      <Stage
        draggable={tool === 'pan'}
        height={size.height}
        onClick={handleStageClick}
        onDragEnd={event => setPosition({ x: event.target.x(), y: event.target.y() })}
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
            {annotations.map(annotation => {
              const selected = annotation.id === selectedId
              const color = annotationColors[annotation.type]
              return (
                <Group key={annotation.id}>
                  <Line
                    closed
                    fill={`${color}${selected ? '24' : '12'}`}
                    hitStrokeWidth={14 / scale}
                    onClick={event => {
                      if (tool === 'select' || tool === 'vertices') {
                        event.cancelBubble = true
                        onSelect(annotation.id)
                      }
                    }}
                    points={flattenPoints(annotation.polygon)}
                    stroke={selected ? '#d9a84e' : color}
                    strokeWidth={(selected ? 2.5 : 1.5) / scale}
                  />
                  {annotation.baseline && (
                    <Line dash={[8 / scale, 5 / scale]} points={flattenPoints(annotation.baseline)} stroke={color} strokeWidth={1.5 / scale} />
                  )}
                  <Label x={annotation.polygon[0]?.x} y={(annotation.polygon[0]?.y ?? 0) - 22 / scale}>
                    <Tag fill={selected ? '#b77c23' : color} cornerRadius={3 / scale} />
                    <Text fill="#fff" fontFamily="Inter, sans-serif" fontSize={11 / scale} padding={4 / scale} text={`${annotationTypeLabels[annotation.type]} ${annotation.id.split('-').at(-1)}`} />
                  </Label>
                  {selected && tool === 'vertices' && annotation.polygon.map((point, index) => (
                    <Circle
                      draggable
                      fill="#f6c562"
                      key={`${annotation.id}-${index}`}
                      onDragMove={event => updateVertex(annotation, index, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) })}
                      radius={5.5 / scale}
                      stroke="#201b12"
                      strokeWidth={1.5 / scale}
                      x={point.x}
                      y={point.y}
                    />
                  ))}
                </Group>
              )
            })}
            {draft.length > 0 && (
              <Group>
                <Line closed={draft.length >= 3} dash={[8 / scale, 5 / scale]} fill="#d9a84e1b" points={flattenPoints(draft)} stroke="#d9a84e" strokeWidth={2 / scale} />
                {draft.map((point, index) => (
                  <Circle
                    fill={index === 0 && draft.length >= 3 ? '#f5c363' : '#fff'}
                    key={`${point.x}-${point.y}-${index}`}
                    onClick={event => {
                      event.cancelBubble = true
                      if (index === 0 && draft.length >= 3) finishPolygon()
                    }}
                    radius={(index === 0 ? 6 : 4) / scale}
                    stroke="#9e6c21"
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
      {tool === 'polygon' && <div className="canvas-instruction">{draft.length < 3 ? `Clique para criar: ${annotationTypeLabels[annotationType]}` : 'Clique no primeiro ponto ou pressione Enter para concluir'}</div>}
    </div>
  )
})

PageCanvas.displayName = 'PageCanvas'
