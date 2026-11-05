import { ChevronLeft, ChevronRight, CircleHelp, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnnotationTree } from '../components/annotations/AnnotationTree'
import { TranscriptionEditor } from '../components/annotations/TranscriptionEditor'
import { PageCanvas, type PageCanvasHandle } from '../components/pages/PageCanvas'
import { PageMetadata } from '../components/pages/PageMetadata'
import { PageThumbnails } from '../components/pages/PageThumbnails'
import { ViewerToolbar } from '../components/pages/ViewerToolbar'
import { apiDataService } from '../services/dataService'
import { useAppStore } from '../stores/useAppStore'
import type { Annotation, Point } from '../types/domain'
import { translatePolygon } from '../utils/geometry'

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
}

const emptyAnnotations: Annotation[] = []

export function ViewerPage() {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef<PageCanvasHandle>(null)
  const page = useAppStore(state => state.pages.find(item => item.id === pageId))
  const document = useAppStore(state => state.documents.find(item => item.id === page?.documentId))
  const allPages = useAppStore(state => state.pages)
  const annotations = useAppStore(state => pageId ? (state.annotationsByPage[pageId] ?? emptyAnnotations) : emptyAnnotations)
  const history = useAppStore(state => pageId ? state.histories[pageId] : undefined)
  const selectedId = useAppStore(state => state.selectedAnnotationId)
  const tool = useAppStore(state => state.activeTool)
  const annotationType = useAppStore(state => state.annotationType)
  const setSelected = useAppStore(state => state.setSelectedAnnotation)
  const setTool = useAppStore(state => state.setActiveTool)
  const setAnnotationType = useAppStore(state => state.setAnnotationType)
  const addAnnotation = useAppStore(state => state.addAnnotation)
  const updateAnnotation = useAppStore(state => state.updateAnnotation)
  const deleteAnnotation = useAppStore(state => state.deleteAnnotation)
  const undo = useAppStore(state => state.undo)
  const redo = useAppStore(state => state.redo)
  const setAnnotations = useAppStore(state => state.setAnnotations)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [rightTab, setRightTab] = useState<'annotations' | 'page'>('annotations')
  const [zoom, setZoom] = useState(0.5)
  const [rotations, setRotations] = useState<Record<string, number>>({})
  const [draftPoints, setDraftPoints] = useState(0)
  const [saved, setSaved] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const selectedAnnotation = annotations.find(annotation => annotation.id === selectedId)
  const pages = useMemo(() => allPages.filter(item => item.documentId === page?.documentId), [allPages, page?.documentId])
  const currentIndex = pages.findIndex(item => item.id === pageId)
  const rotation = page ? (rotations[page.id] ?? page.rotation) : 0

  const savePage = async () => {
    if (!pageId) return
    setSaveError('')
    try {
      const savedAnnotations = await apiDataService.saveAnnotations(pageId, annotations)
      setAnnotations(pageId, savedAnnotations)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha ao guardar as anotações.')
    }
  }

  const parentForType = (type: Annotation['type']) => {
    if (type === 'record') return undefined
    const desiredParent = type === 'region' ? 'record' : type === 'line' ? 'region' : 'line'
    if (selectedAnnotation?.type === desiredParent) return selectedAnnotation.id
    return annotations.find(annotation => annotation.type === desiredParent)?.id
  }

  const createAnnotation = (polygon: Point[]) => {
    if (!pageId) return
    const sameType = annotations.filter(annotation => annotation.type === annotationType)
    const baseline = annotationType === 'line'
      ? [...polygon].sort((a, b) => b.y - a.y).slice(0, 2).sort((a, b) => a.x - b.x)
      : undefined
    const annotation: Annotation = {
      id: `${annotationType}-${crypto.randomUUID().slice(0, 8)}`,
      pageId,
      parentId: parentForType(annotationType),
      type: annotationType,
      polygon,
      baseline,
      readingOrder: sameType.length + 1,
      predictedText: annotationType === 'line' || annotationType === 'word' ? '' : undefined,
      correctedText: annotationType === 'line' || annotationType === 'word' ? '' : undefined,
      confidence: undefined,
      status: 'pending',
    }
    addAnnotation(pageId, annotation)
    setSelected(annotation.id)
    setTool('vertices')
  }

  const moveSelection = useCallback((x: number, y: number) => {
    if (!pageId || !selectedAnnotation) return
    updateAnnotation(pageId, selectedAnnotation.id, {
      polygon: translatePolygon(selectedAnnotation.polygon, x, y),
      baseline: selectedAnnotation.baseline ? translatePolygon(selectedAnnotation.baseline, x, y) : undefined,
    })
  }, [pageId, selectedAnnotation, updateAnnotation])

  const goPage = useCallback((direction: -1 | 1) => {
    const target = pages[currentIndex + direction]
    if (target) navigate(`/viewer/${target.id}`)
  }, [currentIndex, navigate, pages])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        if (pageId) {
          if (event.shiftKey) redo(pageId)
          else undo(pageId)
        }
        return
      }
      if (key === 'v') setTool('select')
      else if (key === 'h') setTool('pan')
      else if (key === 'p') setTool('polygon')
      else if (key === 'e') setTool('vertices')
      else if (key === 'z') setTool('zoom')
      else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (pageId && selectedId) deleteAnnotation(pageId, selectedId)
      } else if (event.key === '+' || event.key === '=') canvasRef.current?.zoomBy(1.18)
      else if (event.key === '-') canvasRef.current?.zoomBy(0.85)
      else if (event.key === '0') canvasRef.current?.fit('page')
      else if (event.key === 'Enter' && draftPoints >= 3) canvasRef.current?.finishPolygon()
      else if (event.key === 'Escape') canvasRef.current?.cancelPolygon()
      else if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        if (selectedAnnotation) {
          const amount = event.shiftKey ? 10 : 1
          if (event.key === 'ArrowLeft') moveSelection(-amount, 0)
          if (event.key === 'ArrowRight') moveSelection(amount, 0)
          if (event.key === 'ArrowUp') moveSelection(0, -amount)
          if (event.key === 'ArrowDown') moveSelection(0, amount)
        } else if (event.key === 'ArrowLeft') goPage(-1)
        else if (event.key === 'ArrowRight') goPage(1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteAnnotation, draftPoints, goPage, moveSelection, pageId, redo, selectedAnnotation, selectedId, setTool, undo])

  const hierarchyPath = useMemo(() => {
    if (!selectedAnnotation) return ''
    const path: string[] = []
    let item: Annotation | undefined = selectedAnnotation
    while (item) {
      path.unshift(`${item.type} ${item.readingOrder}`)
      item = annotations.find(annotation => annotation.id === item?.parentId)
    }
    return path.join(' / ')
  }, [annotations, selectedAnnotation])

  if (!page || !document || !pageId) return <main className="page-shell"><h1>Página não encontrada</h1></main>

  return (
    <main className="viewer-page">
      <div className="viewer-contextbar">
        <Link to={`/documents/${document.id}`}><ChevronLeft size={15} /> {document.title}</Link>
        <span className="context-divider" />
        <strong>Página {page.pageNumber}</strong>
        <span>{page.originalFilename}</span>
        <div className="context-actions">
          <button disabled={currentIndex <= 0} onClick={() => goPage(-1)} type="button"><ChevronLeft size={15} /> Anterior</button>
          <button disabled={currentIndex >= pages.length - 1} onClick={() => goPage(1)} type="button">Seguinte <ChevronRight size={15} /></button>
        </div>
      </div>
      <ViewerToolbar
        annotationType={annotationType}
        canDelete={Boolean(selectedId)}
        canRedo={Boolean(history?.future.length)}
        canUndo={Boolean(history?.past.length)}
        canvas={canvasRef}
        draftPoints={draftPoints}
        onAnnotationType={setAnnotationType}
        onDelete={() => selectedId && deleteAnnotation(pageId, selectedId)}
        onRedo={() => redo(pageId)}
        onRotate={() => setRotations(current => ({ ...current, [page.id]: (rotation + 90) % 360 }))}
        onSave={() => void savePage()}
        onTool={setTool}
        onUndo={() => undo(pageId)}
        tool={tool}
        zoom={zoom}
      />
      <div className={`viewer-workspace ${leftOpen ? '' : 'left-closed'} ${rightOpen ? '' : 'right-closed'}`}>
        {leftOpen
          ? <PageThumbnails activePageId={page.id} onCollapse={() => setLeftOpen(false)} pages={pages} />
          : <button className="open-side-panel left" onClick={() => setLeftOpen(true)} title="Mostrar páginas" type="button"><PanelLeftOpen size={18} /></button>}
        <PageCanvas
          annotationType={annotationType}
          annotations={annotations}
          onCreate={createAnnotation}
          onDraftChange={setDraftPoints}
          onSelect={setSelected}
          onUpdatePolygon={(id, polygon) => updateAnnotation(pageId, id, { polygon })}
          onZoomChange={setZoom}
          page={page}
          ref={canvasRef}
          rotation={rotation}
          selectedId={selectedId}
          tool={tool}
        />
        {rightOpen ? (
          <aside className="annotation-panel">
            <div className="panel-header annotation-panel-header">
              <div className="panel-tabs"><button className={rightTab === 'annotations' ? 'is-active' : ''} onClick={() => setRightTab('annotations')} type="button">Anotações</button><button className={rightTab === 'page' ? 'is-active' : ''} onClick={() => setRightTab('page')} type="button">Página</button></div>
              <button className="icon-button always-visible bare" onClick={() => setRightOpen(false)} title="Recolher painel" type="button"><PanelRightClose size={17} /></button>
            </div>
            {rightTab === 'page' ? <PageMetadata page={page} /> : (
              <>
                <div className="annotation-summary"><span>{annotations.length} elementos</span>{hierarchyPath && <small>{hierarchyPath}</small>}</div>
                <AnnotationTree annotations={annotations} onSelect={setSelected} selectedId={selectedId} />
                <div className="panel-section-title"><span>Transcrição</span>{selectedAnnotation && <code>{selectedAnnotation.id}</code>}</div>
                {selectedAnnotation
                  ? <TranscriptionEditor
                      annotation={selectedAnnotation}
                      onChange={text => updateAnnotation(pageId, selectedAnnotation.id, { correctedText: text, status: 'in_review' })}
                      onStatus={status => updateAnnotation(pageId, selectedAnnotation.id, { status })}
                      page={page}
                    />
                  : <div className="transcription-empty"><p>Selecione uma anotação no documento ou na árvore.</p></div>}
              </>
            )}
          </aside>
        ) : <button className="open-side-panel right" onClick={() => setRightOpen(true)} title="Mostrar anotações" type="button"><PanelRightOpen size={18} /></button>}
      </div>
      <footer className="viewer-statusbar">
        <span>{tool === 'polygon' ? 'Desenho de polígono' : tool === 'vertices' ? 'Edição de vértices' : tool === 'pan' ? 'Mover imagem' : 'Seleção'}</span>
        <span>X/Y em coordenadas originais</span>
        <button onClick={() => setHelpOpen(true)} type="button"><CircleHelp size={13} /> Atalhos</button>
        {saved && <strong className="saved-toast">Alterações guardadas no servidor</strong>}
        {saveError && <strong className="saved-toast">{saveError}</strong>}
      </footer>
      {helpOpen && (
        <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setHelpOpen(false)} role="presentation">
          <div className="dialog shortcuts-dialog">
            <div className="dialog-header"><div><p className="eyebrow">Editor</p><h2>Atalhos de teclado</h2></div><button className="secondary-button" onClick={() => setHelpOpen(false)} type="button">Fechar</button></div>
            <div className="shortcuts-grid">
              {[['V', 'Selecionar'], ['H', 'Mover imagem'], ['P', 'Criar polígono'], ['E', 'Editar vértices'], ['Delete', 'Excluir seleção'], ['Ctrl Z', 'Desfazer'], ['Ctrl ⇧ Z', 'Refazer'], ['+', 'Ampliar'], ['−', 'Reduzir'], ['0', 'Ajustar à tela'], ['Enter', 'Concluir polígono'], ['Setas', 'Mover seleção / navegar']].map(([key, label]) => <div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
