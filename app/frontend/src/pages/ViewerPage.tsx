import { ChevronLeft, ChevronRight, CircleHelp, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useWorkspaceRole } from '../components/auth/AuthProvider'
import type { DrawKind } from '../components/pages/ViewerToolbar'
import { AnnotationTree } from '../components/annotations/AnnotationTree'
import { ConfirmLines } from '../components/annotations/ConfirmLines'
import { buildReviewQueue } from '../components/annotations/ReviewPanel'
import { FlowPanel, type FlowAction } from '../components/annotations/FlowPanel'
import { TranscriptionEditor } from '../components/annotations/TranscriptionEditor'
import { TranscriptionPanel } from '../components/annotations/TranscriptionPanel'
import { PageCanvas, type PageCanvasHandle } from '../components/pages/PageCanvas'
import { RecordPreview } from '../components/annotations/RecordPreview'
import { PageMetadata } from '../components/pages/PageMetadata'
import { PageThumbnails } from '../components/pages/PageThumbnails'
import { ViewerToolbar } from '../components/pages/ViewerToolbar'
import { annotationWire, apiDataService } from '../services/dataService'
import { useAppStore } from '../stores/useAppStore'
import type { Annotation, AnnotationType, DocumentRecord, LexiconSuggestion, Point, SegmentProgress } from '../types/domain'
import { annotationDisplayLabel, recordTypeOntologyLabels } from '../utils/format'
import { polygonArea, polygonBounds, polygonCentroid, pointInPolygon, translatePolygon } from '../utils/geometry'

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
}

const emptyAnnotations: Annotation[] = []

// Fingerprint estável (chaves ordenadas) para comparar o estado das
// anotações sem gerar falso positivo de "alteração" após cada save.
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

// Fingerprint do que REALMENTE seria persistido: só os campos do payload
// (annotationWire), ordenados por id — campos voláteis de UI e ordem do
// array não geram falso "pendente".
const wireFingerprint = (annotations: Annotation[]) =>
  stableStringify(
    annotations.map(annotationWire)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))

import { useSession } from '../components/auth/AuthProvider'
import { recordLineProgress } from '../village/data'

export function ViewerPage() {
  const progressUser = useSession()?.user.id
  const admin = useWorkspaceRole() === 'admin'
  const [search] = useSearchParams()
  const review = search.get('review') === 'lines'
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
  const setSelected = useAppStore(state => state.setSelectedAnnotation)
  const setTool = useAppStore(state => state.setActiveTool)
  const addAnnotation = useAppStore(state => state.addAnnotation)
  const mutateAnnotations = useAppStore(state => state.mutateAnnotations)
  const updateAnnotation = useAppStore(state => state.updateAnnotation)
  const deleteAnnotation = useAppStore(state => state.deleteAnnotation)
  const undo = useAppStore(state => state.undo)
  const redo = useAppStore(state => state.redo)
  const setAnnotations = useAppStore(state => state.setAnnotations)
  const loadAnnotations = useAppStore(state => state.loadAnnotations)
  const annotationsReady = useAppStore(state => Boolean(pageId && state.loadedAnnotationPages[pageId]))
  const [loadError, setLoadError] = useState('')
  const [leftOpen, setLeftOpen] = useState(() => localStorage.getItem('htr-panel-pages') !== 'closed')
  const [rightOpen, setRightOpen] = useState(() => localStorage.getItem('htr-panel-review') !== 'closed')
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = Number(localStorage.getItem('htr-panel-pages-w'))
    return saved >= 140 ? saved : 214
  })
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = Number(localStorage.getItem('htr-panel-review-w'))
    return saved >= 220 ? saved : 326
  })
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null)
  const [rightTab, setRightTab] = useState<'flow' | 'transcription' | 'annotations' | 'page'>('flow')
  const [zoom, setZoom] = useState(0.5)
  const [rotations, setRotations] = useState<Record<string, number>>({})
  const [draftPoints, setDraftPoints] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [leavingSave, setLeavingSave] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(review)
  useEffect(() => { setConfirmOpen(review) }, [pageId, review])
  const [pageSuggestions, setPageSuggestions] = useState<LexiconSuggestion[]>([])
  const [segmenting, setSegmenting] = useState(false)
  const [segmentProgress, setSegmentProgress] = useState<SegmentProgress | null>(null)
  const [segmentInfo, setSegmentInfo] = useState('')
  const [drawKind, setDrawKind] = useState<DrawKind | null>(null)
  const [openRecords, setOpenRecords] = useState<DocumentRecord[]>([])
  const [pendingPolygon, setPendingPolygon] = useState<{ points: Point[]; kind: DrawKind } | null>(null)
  const [creationHint, setCreationHint] = useState('')
  useEffect(() => { setCreationHint('') }, [tool])
  const [visibleTypes, setVisibleTypes] = useState<Record<AnnotationType, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('htr-visible-types') ?? '{}') as Partial<Record<AnnotationType, boolean>>
      return { region: true, line: true, word: true, record: true, ...saved }
    } catch {
      return { region: true, line: true, word: true, record: true }
    }
  })
  const [showLinePolygons, setShowLinePolygons] = useState(() =>
    localStorage.getItem('htr-show-line-polygons') === '1')
  const applyVisibleTypes = useCallback((next: Record<AnnotationType, boolean>) => {
    setVisibleTypes(next)
    localStorage.setItem('htr-visible-types', JSON.stringify(next))
  }, [])
  const toggleVisibleType = useCallback((type: AnnotationType) => {
    setVisibleTypes(current => {
      const next = { ...current, [type]: !current[type] }
      localStorage.setItem('htr-visible-types', JSON.stringify(next))
      return next
    })
  }, [])
  const applyLinePolygons = useCallback((value: boolean) => {
    setShowLinePolygons(value)
    localStorage.setItem('htr-show-line-polygons', value ? '1' : '0')
  }, [])
  const toggleLinePolygons = useCallback(() => {
    setShowLinePolygons(current => {
      const next = !current
      localStorage.setItem('htr-show-line-polygons', next ? '1' : '0')
      return next
    })
  }, [])
  const selectedAnnotation = annotations.find(annotation => annotation.id === selectedId)
  const bookRecordType = ({ batismo: 'baptism', casamento: 'marriage', obito: 'death' } as Record<string, string>)[document?.recordType ?? '']
  const selectedWords = useMemo(() => selectedAnnotation?.type === 'line'
    ? annotations
        .filter(annotation => annotation.type === 'word' && annotation.parentId === selectedAnnotation.id)
        .sort((a, b) => a.readingOrder - b.readingOrder)
    : [], [annotations, selectedAnnotation])
  const pages = useMemo(() => allPages.filter(item => item.documentId === page?.documentId), [allPages, page?.documentId])
  const currentIndex = pages.findIndex(item => item.id === pageId)
  const rotation = page ? (rotations[page.id] ?? page.rotation) : 0

  // "Continuação de um assento" no diálogo de criação: quando ativo, o
  // diálogo lista os assentos do livro com prévia em vez das opções de tipo.
  const [pickContinuation, setPickContinuation] = useState(false)

  const fetchAnnotations = useCallback(() => {
    if (!pageId) return
    loadAnnotations(pageId)
      .then(() => {
        if (!(pageId in savedAnnotationsRef.current)) {
          savedAnnotationsRef.current[pageId] =
            [...(useAppStore.getState().annotationsByPage[pageId] ?? emptyAnnotations)]
        }
      })
      .catch(error => setLoadError(error instanceof Error ? error.message : 'Falha ao carregar as anotações.'))
  }, [loadAnnotations, pageId])

  useEffect(() => {
    if (page) fetchAnnotations()
  }, [fetchAnnotations, page])

  useEffect(() => {
    localStorage.setItem('htr-panel-pages', leftOpen ? 'open' : 'closed')
  }, [leftOpen])

  useEffect(() => {
    localStorage.setItem('htr-panel-review', rightOpen ? 'open' : 'closed')
  }, [rightOpen])

  const startPanelResize = (side: 'left' | 'right') => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = side === 'left' ? leftWidth : rightWidth
    const min = side === 'left' ? 150 : 230
    const max = side === 'left' ? 480 : 640
    let latest = startWidth
    setResizing(side)
    const onMove = (move: PointerEvent) => {
      const delta = side === 'left' ? move.clientX - startX : startX - move.clientX
      latest = Math.min(max, Math.max(min, Math.round(startWidth + delta)))
      if (side === 'left') setLeftWidth(latest)
      else setRightWidth(latest)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setResizing(null)
      localStorage.setItem(side === 'left' ? 'htr-panel-pages-w' : 'htr-panel-review-w', String(latest))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  useEffect(() => {
    if (!admin || !document?.id) return
    apiDataService.listDocumentRecords(document.id)
      .then(setOpenRecords)
      .catch(() => setOpenRecords([]))
  }, [admin, document?.id])

  const goPage = useCallback((direction: -1 | 1) => {
    const target = pages[currentIndex + direction]
    if (target) navigate(`/viewer/${target.id}${review ? '?review=lines' : ''}`)
  }, [currentIndex, navigate, pages, review])

  // ---- Salvamento de anotações ----
  // Fingerprint estável por página do último estado confirmado pelo banco.
  const savedPrints = useRef<Record<string, string>>({})
  // Último estado confirmado pelo servidor por página — base do contador
  // de alterações pendentes.
  const savedAnnotationsRef = useRef<Record<string, Annotation[]>>({})
  const savingRef = useRef(false)
  const lineDraft = useRef<(() => void) | undefined>(undefined)
  const registerLineDraft = useCallback((commit?: () => void) => { lineDraft.current = commit }, [])
  const pageIdRef = useRef(pageId)
  const segmentingRef = useRef(segmenting)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (pageIdRef.current !== pageId) {
      setSaveState('idle')
      setSaveError('')
      setSaveNotice('')
    }
    pageIdRef.current = pageId
  })
  useEffect(() => { segmentingRef.current = segmenting })

  // Lê a versão atual da store e aguarda a confirmação da API.
  const persistAnnotations = async (pid: string): Promise<boolean> => {
    if (!pid) return false
    const state = useAppStore.getState()
    if (!state.loadedAnnotationPages[pid] || segmentingRef.current) return false
    const sent = state.annotationsByPage[pid] ?? emptyAnnotations
    const sentJson = wireFingerprint(sent)
    if (savedPrints.current[pid] === sentJson) return true
    if (savingRef.current) return false
    const isCurrent = () => pageIdRef.current === pid
    if (isCurrent()) { setSaveState('saving'); setSaveError(''); setSaveNotice('') }
    savingRef.current = true
    try {
      const savedRows = await apiDataService.saveAnnotations(pid, sent)
      if (progressUser) {
        try {
          recordLineProgress(progressUser, pid, savedAnnotationsRef.current[pid] ?? [], savedRows)
        } catch {
          // O acervo já foi salvo mesmo quando o armazenamento local está indisponível.
        }
      }
      // O fingerprint é o estado CONFIRMADO pelo servidor — não o enviado.
      // O PUT pode devolver campos que o front não tinha (original_polygon,
      // display_label, status recalculado); usar sentJson aqui deixaria a
      // página presa em "Alterações pendentes" após cada save.
      savedPrints.current[pid] = wireFingerprint(savedRows)
      savedAnnotationsRef.current[pid] = savedRows
      // Aplica a resposta do servidor somente se o estado local não mudou
      // durante o PUT — caso contrário ela reverteria edições em andamento.
      const current = useAppStore.getState().annotationsByPage[pid]
      if (current && wireFingerprint(current) === sentJson) {
        setAnnotations(pid, savedRows)
      }
      // Espelha o backend: página fica «Revisada» quando todas as linhas
      // estão verificadas — o assistente do Fluxo usa esse estado como fim.
      const savedLines = savedRows.filter(row => row.type === 'line')
      if (savedLines.length) {
        const reviewed = savedLines.every(row => row.status === 'verified') ? 'reviewed' : 'annotated'
        const pageRow = useAppStore.getState().pages.find(item => item.id === pid)
        if (pageRow && pageRow.status !== reviewed) {
          useAppStore.getState().addPages([{ ...pageRow, status: reviewed }])
        }
      }
      const clean = wireFingerprint(useAppStore.getState().annotationsByPage[pid] ?? []) === savedPrints.current[pid]
      if (isCurrent()) {
        setSaveState(clean ? 'saved' : 'dirty')
        // O servidor pode ter normalizado o payload (sanitize remove
        // órfãos/geometria vazia, FKs reparam parent_id…). Se a resposta
        // divergir do enviado, avisa em vez de fingir byte-a-byte.
        if (wireFingerprint(savedRows) !== sentJson) {
          setSaveNotice('Guardado — o servidor ajustou alguns elementos.')
          window.setTimeout(() => setSaveNotice(''), 6000)
        }
      }
      return clean
    } catch (error) {
      if (isCurrent()) {
        setSaveState('error')
        const detail = error instanceof Error ? error.message : ''
        setSaveError(`Não foi possível confirmar o salvamento. Tente novamente. ${detail}`)
      }
      return false
    } finally {
      savingRef.current = false
    }
  }

  const savePage = async (thenNext = false) => {
    if (!pageId) return
    if (!annotationsReady) {
      setSaveError('Aguarde as anotações carregarem antes de guardar.')
      return
    }
    const ok = await persistAnnotations(pageId)
    if (thenNext && ok) goPage(1)
  }

  // Sem autosave: o PUT substitui a página inteira (~centenas de polígonos)
  // e disparar a cada tecla travava a UI. O fingerprint só marca «sujo» —
  // a gravação acontece no clique em «Salvar» (ou ao sair da página).
  useEffect(() => {
    if (!pageId || !annotationsReady || segmenting) return
    const json = wireFingerprint(annotations)
    if (!(pageId in savedPrints.current)) {
      savedPrints.current[pageId] = json
      return
    }
    if (json !== savedPrints.current[pageId] && !savingRef.current) {
      setSaveState(previous => previous === 'error' ? previous : 'dirty')
    }
  }, [annotations, annotationsReady, segmenting, pageId])

  const hasUnsavedChanges = useCallback(() => {
    if (savingRef.current || lineDraft.current) return true
    if (!pageId || !(pageId in savedPrints.current)) return false
    const current = useAppStore.getState().annotationsByPage[pageId] ?? emptyAnnotations
    return savedPrints.current[pageId] !== wireFingerprint(current)
  }, [pageId])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && hasUnsavedChanges())

  const saveAndLeave = async () => {
    if (!pageId || leavingSave || savingRef.current) return
    setLeavingSave(true)
    lineDraft.current?.()
    const ok = await persistAnnotations(pageId)
    setLeavingSave(false)
    if (ok && blocker.state === 'blocked') blocker.proceed()
  }

  // Sugestões do léxico para a tela de confirmação (carrega ao abrir).
  useEffect(() => {
    if (!confirmOpen || !pageId) return
    apiDataService.listPageSuggestions(pageId)
      .then(setPageSuggestions)
      .catch(() => setPageSuggestions([]))
  }, [confirmOpen, pageId])

  // Quantas anotações diferem do último estado confirmado pelo servidor:
  // adicionadas, removidas ou com campos persistidos alterados.
  const pendingCount = useMemo(() => {
    if (!pageId) return 0
    const baseline = savedAnnotationsRef.current[pageId]
    if (!baseline) return annotations.length
    const wireOf = (list: Annotation[]) => new Map(
      list.map(annotation => [annotation.id, stableStringify(annotationWire(annotation))]))
    const baseMap = wireOf(baseline)
    const curMap = wireOf(annotations)
    let count = 0
    for (const [id, wire] of curMap) {
      const before = baseMap.get(id)
      if (before === undefined || before !== wire) count += 1
    }
    for (const id of baseMap.keys()) if (!curMap.has(id)) count += 1
    return count
  }, [annotations, pageId, saveState])

  // Polling do progresso da segmentação enquanto o Kraken processa.
  useEffect(() => {
    if (!segmenting || !pageId) { setSegmentProgress(null); return }
    let cancelled = false
    const poll = () => {
      apiDataService.getSegmentStatus(pageId)
        .then(state => { if (!cancelled) setSegmentProgress(state) })
        .catch(() => {})
    }
    poll()
    const timer = window.setInterval(poll, 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [segmenting, pageId])

  const segmentPage = useCallback(async () => {
    if (!pageId || !annotationsReady || segmenting) return
    if (history?.past.length && !window.confirm('A segmentação recarrega as anotações do servidor e descarta alterações não guardadas. Continuar?')) return
    setSaveError('')
    setSegmentInfo('')
    setSegmenting(true)
    try {
      const result = await apiDataService.segmentPage(pageId)
      await loadAnnotations(pageId, { force: true })
      // A segmentação substitui o estado no servidor — o novo baseline é o
      // que voltou do GET, senão a página apareceria "suja" sem edição.
      const fresh = useAppStore.getState().annotationsByPage[pageId] ?? emptyAnnotations
      savedPrints.current[pageId] = wireFingerprint(fresh)
      savedAnnotationsRef.current[pageId] = [...fresh]
      const words = result.words ? `, ${result.words} palavras` : ''
      setSegmentInfo(`Segmentação concluída: ${result.lines} linhas em ${result.regions} regiões${words}. Classifique-as na aba Transcrição.`)
      setRightTab('flow')
      window.setTimeout(() => setSegmentInfo(''), 6000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha na segmentação.')
    } finally {
      setSegmenting(false)
    }
  }, [annotationsReady, history?.past.length, loadAnnotations, pageId, segmenting])

  // Excluir → seleção salta para o próximo item pendente da fila de revisão
  // (depois deste na ordem de leitura; volta ao início se não houver).
  const deleteAndAdvance = useCallback((id: string) => {
    if (!pageId) return
    const queue = buildReviewQueue(annotations)
    const pos = queue.findIndex(item => item.annotation.id === id)
    const ordered = [...queue.slice(pos + 1), ...queue.slice(0, Math.max(pos, 0))]
    deleteAnnotation(pageId, id)
    const freshIds = new Set(
      (useAppStore.getState().annotationsByPage[pageId] ?? []).map(item => item.id))
    const survivors = ordered.map(item => item.annotation).filter(item => freshIds.has(item.id))
    const next = survivors.find(item => item.status !== 'verified') ?? survivors[0]
    setSelected(next?.id)
  }, [annotations, deleteAnnotation, pageId, setSelected])

  // Contêineres possíveis: regiões de topo, sub-regiões e registros
  // (o registro é uma região que contém sub-regiões).
  const containersOf = (types: Annotation['type'][]) =>
    annotations.filter(annotation => types.includes(annotation.type))

  const innermostContainer = (polygon: Point[] | undefined, types: Annotation['type'][]) => {
    if (!polygon?.length) return undefined
    const center = polygonCentroid(polygon)
    const candidates = containersOf(types)
      .filter(annotation => pointInPolygon(center, annotation.polygon))
    if (!candidates.length) return undefined
    // A sub-região é o contêiner de menor área que envolve o desenho.
    return candidates.sort((a, b) => polygonArea(a.polygon) - polygonArea(b.polygon))[0]
  }

  const parentForType = (type: Annotation['type'], polygon?: Point[]) => {
    if (type === 'record') return undefined
    if (type === 'region') {
      // Regiões de topo não pendem de ninguém; sub-regiões recebem o pai
      // explicitamente no diálogo de criação.
      return undefined
    }
    const desiredParent = type === 'line' ? 'region' : 'line'
    if (type === 'line') {
      const container = innermostContainer(polygon, ['region', 'record'])
      if (container) return container.id
    }
    // Preferência: o contêiner (região/linha) cujo polígono envolve o novo desenho.
    if (polygon?.length) {
      const center = polygonCentroid(polygon)
      const container = annotations
        .filter(annotation => annotation.type === desiredParent && pointInPolygon(center, annotation.polygon))
        .sort((a, b) => a.readingOrder - b.readingOrder)[0]
      if (container) return container.id
    }
    if (selectedAnnotation?.type === desiredParent) return selectedAnnotation.id
    if (selectedAnnotation?.type === 'word' && type === 'word') {
      const parent = annotations.find(annotation => annotation.id === selectedAnnotation.parentId)
      if (parent?.type === 'line') return parent.id
    }
    const candidates = annotations.filter(annotation => annotation.type === desiredParent)
    if (!candidates.length) return undefined
    // Palavra: sem linha contendo o desenho, usa a linha mais próxima do
    // cursor — nunca a "primeira da página", que esconderia o erro.
    if (type === 'word' && polygon?.length) {
      const center = polygonCentroid(polygon)
      let best = candidates[0]
      let bestDistance = Infinity
      for (const candidate of candidates) {
        const candidateCenter = polygonCentroid(candidate.polygon)
        const distance = Math.hypot(candidateCenter.x - center.x, candidateCenter.y - center.y)
        if (distance < bestDistance) { bestDistance = distance; best = candidate }
      }
      return best.id
    }
    return candidates[0].id
  }

  const createAnnotation = (polygon: Point[], type: Annotation['type'], forcedParentId?: string, baselineOverride?: Point[], extra?: Partial<Annotation>) => {
    if (!pageId || !annotationsReady) return
    const parentId = forcedParentId ?? parentForType(type, polygon)
    // Palavra sem linha pai seria descartada no save (sanitize) — avisa
    // em vez de criar um elemento fantasma que some depois.
    if (type === 'word' && !parentId) {
      setCreationHint('Não há linha nesta página — crie uma linha primeiro (Acrescentar novo → Nova linha).')
      return
    }
    setCreationHint('')
    const sameType = annotations.filter(annotation =>
      annotation.type === type && annotation.parentId === parentId)
    const baseline = baselineOverride ?? (type === 'line'
      ? [...polygon].sort((a, b) => b.y - a.y).slice(0, 2).sort((a, b) => a.x - b.x)
      : undefined)
    const recordTypeMap: Record<string, string> = { batismo: 'baptism', casamento: 'marriage', obito: 'death' }
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      pageId,
      parentId,
      type,
      polygon,
      baseline,
      readingOrder: sameType.length + 1,
      predictedText: type === 'line' || type === 'word' ? '' : undefined,
      correctedText: type === 'line' || type === 'word' ? '' : undefined,
      confidence: undefined,
      status: 'pending',
      regionType: undefined,
      recordType: type === 'record' ? (recordTypeMap[document?.recordType ?? ''] ?? 'other') : undefined,
      ...extra,
    }
    if (type === 'word' && annotation.parentId) {
      // Insere a palavra na posição horizontal dentro da linha e renumera os irmãos
      // (words.seq é único por linha no banco). Lê o estado fresco da store —
      // criações em sequência rápida antes do re-render gerariam seq duplicado.
      const fresh = useAppStore.getState().annotationsByPage[pageId] ?? annotations
      const siblings = fresh
        .filter(item => item.type === 'word' && item.parentId === annotation.parentId)
        .sort((a, b) => a.readingOrder - b.readingOrder)
      const centerX = polygonCentroid(polygon).x
      let insertAt = siblings.length
      for (let index = 0; index < siblings.length; index += 1) {
        if (polygonCentroid(siblings[index].polygon).x > centerX) { insertAt = index; break }
      }
      const order = [...siblings.slice(0, insertAt), annotation, ...siblings.slice(insertAt)]
      const seqById = new Map(order.map((item, index) => [item.id, index + 1]))
      annotation.readingOrder = insertAt + 1
      mutateAnnotations(pageId, list => [
        ...list.map(item => seqById.has(item.id) ? { ...item, readingOrder: seqById.get(item.id)! } : item),
        annotation,
      ])
    } else {
      addAnnotation(pageId, annotation)
    }
    setSelected(annotation.id)
    // Permanece no modo de desenho para marcar várias regiões seguidas;
    // a edição de vértices fica a um clique/toque de distância (E ou duplo clique).
    if (type === 'region' || type === 'record') setTool('polygon')
    else if (type === 'word') setTool('word')
    else if (type !== 'line') setTool('vertices')
  }

  const handleCanvasCreate = (polygon: Point[]) => {
    if (!annotationsReady) return
    // Ferramenta "palavra": polígono fechado vira word direto, sem diálogo —
    // o pai é a linha que contém o centro do desenho.
    if (tool === 'word') {
      createAnnotation(polygon, 'word')
      return
    }
    setPendingPolygon({ points: polygon, kind: drawKind ?? 'region' })
  }

  // Ferramenta "linha": dois cliques definem a baseline; o polígono é gerado
  // automaticamente como uma faixa em volta dela (altura = mediana das linhas
  // existentes na página, ~44px de fallback).
  const handleCreateLine = (start: Point, end: Point) => {
    if (!pageId || !annotationsReady) return
    const [a, b] = start.x <= end.x ? [start, end] : [end, start]
    const heights = annotations
      .filter(item => item.type === 'line')
      .map(item => polygonBounds(item.polygon).height)
      .filter(height => height > 4)
      .sort((x, y) => x - y)
    const height = heights.length ? heights[Math.floor(heights.length / 2)] : 44
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / length
    const ny = (b.x - a.x) / length
    const top = -0.78 * height
    const bottom = 0.22 * height
    const at = (point: Point, offset: number): Point => ({
      x: Math.round(point.x + nx * offset),
      y: Math.round(point.y + ny * offset),
    })
    const polygon = [at(a, top), at(b, top), at(b, bottom), at(a, bottom)]
    const baseline = [
      { x: Math.round(a.x), y: Math.round(a.y) },
      { x: Math.round(b.x), y: Math.round(b.y) },
    ]
    createAnnotation(polygon, 'line', undefined, baseline)
  }

  // Arrastar uma linha na aba Transcrição: move para outra região
  // (ou reordena dentro da mesma), renumera reading_order dos afetados.
  const moveLine = (lineId: string, targetRegionId: string, beforeLineId?: string) => {
    if (!pageId) return
    const lines = annotations.filter(annotation => annotation.type === 'line')
    const moved = lines.find(annotation => annotation.id === lineId)
    if (!moved) return
    const byRegion = (regionId?: string) => lines
      .filter(annotation => annotation.parentId === regionId)
      .sort((a, b) => a.readingOrder - b.readingOrder)
    // No-op: mesma região, já é a última linha.
    if (moved.parentId === targetRegionId && !beforeLineId
      && byRegion(targetRegionId).at(-1)?.id === lineId) return
    const updates = new Map<string, { parentId?: string; readingOrder: number }>()

    const targetLines = byRegion(targetRegionId).filter(annotation => annotation.id !== lineId)
    let insertAt = targetLines.length
    if (beforeLineId) {
      const index = targetLines.findIndex(annotation => annotation.id === beforeLineId)
      if (index >= 0) insertAt = index
    }
    const targetOrdered = [...targetLines.slice(0, insertAt), moved, ...targetLines.slice(insertAt)]
    targetOrdered.forEach((annotation, index) =>
      updates.set(annotation.id, { parentId: targetRegionId, readingOrder: index + 1 }))

    if (moved.parentId && moved.parentId !== targetRegionId) {
      byRegion(moved.parentId)
        .filter(annotation => annotation.id !== lineId)
        .forEach((annotation, index) =>
          updates.set(annotation.id, { parentId: moved.parentId, readingOrder: index + 1 }))
    }

    mutateAnnotations(pageId, list => list.map(annotation =>
      updates.has(annotation.id) ? { ...annotation, ...updates.get(annotation.id)! } : annotation))
    setSelected(lineId)
  }

  // Ações do assistente do painel Fluxo: cada etapa ajusta as camadas visíveis
  // para mostrar só o que o usuário precisa corrigir naquela fase.
  const reviewNext = (type: 'line' | 'word') => {
    if (!pageId) return
    const pending = annotations
      .filter(annotation => annotation.type === type && annotation.status !== 'verified')
      .sort((a, b) => {
        const ay = Math.min(...a.polygon.map(point => point.y))
        const by = Math.min(...b.polygon.map(point => point.y))
        const ax = Math.min(...a.polygon.map(point => point.x))
        const bx = Math.min(...b.polygon.map(point => point.x))
        return ay - by || ax - bx || a.readingOrder - b.readingOrder
      })
    if (!pending.length) { setRightTab('annotations'); return }
    const currentPos = pending.findIndex(annotation => annotation.id === selectedId)
    const target = currentPos >= 0 ? pending[(currentPos + 1) % pending.length] : pending[0]
    setSelected(target.id)
    setRightTab('annotations')
  }

  const handleFlowAction = (action: FlowAction) => {
    switch (action) {
      case 'draw-region':
        applyVisibleTypes({ region: true, line: false, word: false, record: true })
        applyLinePolygons(false)
        setDrawKind('region')
        setTool('polygon')
        break
      case 'add-line':
        applyVisibleTypes({ region: true, line: true, word: false, record: true })
        applyLinePolygons(false)
        setTool('line')
        break
      case 'review-lines':
        applyVisibleTypes({ region: true, line: true, word: false, record: true })
        applyLinePolygons(true)
        reviewNext('line')
        break
      case 'review-words':
        applyVisibleTypes({ region: true, line: true, word: true, record: true })
        applyLinePolygons(true)
        reviewNext('word')
        break
      case 'confirm-lines':
        setConfirmOpen(true)
        break
      case 'transcription':
        setRightTab('transcription')
        break
      case 'save':
        void savePage()
        break
    }
  }

  const moveSelection = useCallback((x: number, y: number) => {
    if (!pageId || !selectedAnnotation) return
    updateAnnotation(pageId, selectedAnnotation.id, {
      polygon: translatePolygon(selectedAnnotation.polygon, x, y),
      baseline: selectedAnnotation.baseline ? translatePolygon(selectedAnnotation.baseline, x, y) : undefined,
    })
  }, [pageId, selectedAnnotation, updateAnnotation])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (confirmOpen || savingRef.current || isTypingTarget(event.target)) return
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
      else if (key === 'p') { setDrawKind('region'); setTool('polygon') }
      else if (key === 'l') setTool('line')
      else if (key === 'w') setTool('word')
      else if (key === 'e') setTool('vertices')
      else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (pageId && selectedId) deleteAndAdvance(selectedId)
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
  }, [confirmOpen, deleteAndAdvance, draftPoints, goPage, moveSelection, pageId, redo, selectedAnnotation, selectedId, setTool, undo])

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
        <Link to={`/documents/${document.id}${review ? '?review=lines' : ''}`}><ChevronLeft size={15} /> {document.title}</Link>
        <span className="context-divider" />
        <strong>Página {page.pageNumber}</strong>
        <span>{page.originalFilename}</span>
        <div className="context-actions">
          <button type="button" onClick={() => setConfirmOpen(true)}>Correção rápida de linhas</button>
          <button disabled={currentIndex <= 0} onClick={() => goPage(-1)} type="button"><ChevronLeft size={15} /> Anterior</button>
          <button disabled={currentIndex >= pages.length - 1} onClick={() => goPage(1)} type="button">Seguinte <ChevronRight size={15} /></button>
          <button
            className="secondary-button"
            disabled={!annotationsReady || segmenting || saveState === 'saving' || currentIndex >= pages.length - 1}
            onClick={() => void savePage(true)}
            title="Guarda as anotações e abre a página seguinte"
            type="button"
          >Salvar e avançar</button>
        </div>
      </div>
      <ViewerToolbar
        canDelete={Boolean(selectedId)}
        canRedo={Boolean(history?.future.length)}
        canUndo={Boolean(history?.past.length)}
        canvas={canvasRef}
        draftPoints={draftPoints}
        onDelete={() => selectedId && deleteAndAdvance(selectedId)}
        onToggleType={toggleVisibleType}
        visibleTypes={visibleTypes}
        showLinePolygons={showLinePolygons}
        onToggleLinePolygons={toggleLinePolygons}
        onRedo={() => redo(pageId)}
        onRotate={() => setRotations(current => ({ ...current, [page.id]: (rotation + 90) % 360 }))}
        onSave={() => void savePage()}
        saveDisabled={!annotationsReady || segmenting || saveState === 'saving'}
        drawKind={drawKind}
        onDraw={kind => { setDrawKind(kind); setTool('polygon') }}
        onTool={next => {
          setTool(next)
          if (next !== 'polygon') setDrawKind(null)
          // A ferramenta de palavra exige a camada de palavras visível.
          if (next === 'word' && !visibleTypes.word) {
            applyVisibleTypes({ ...visibleTypes, word: true })
          }
        }}
        onUndo={() => undo(pageId)}
        tool={tool}
        zoom={zoom}
      />
      <div
        className={`viewer-workspace ${leftOpen ? '' : 'left-closed'} ${rightOpen ? '' : 'right-closed'} ${resizing ? 'resizing' : ''}`}
        style={{
          gridTemplateColumns: [
            leftOpen ? `${leftWidth}px` : null,
            'minmax(0, 1fr)',
            rightOpen ? `${rightWidth}px` : null,
          ].filter(Boolean).join(' '),
        }}
      >
        {leftOpen && (
          <div
            className={`panel-resizer left ${resizing === 'left' ? 'is-dragging' : ''}`}
            onPointerDown={startPanelResize('left')}
            style={{ left: leftWidth - 4 }}
          />
        )}
        {rightOpen && (
          <div
            className={`panel-resizer right ${resizing === 'right' ? 'is-dragging' : ''}`}
            onPointerDown={startPanelResize('right')}
            style={{ right: rightWidth - 4 }}
          />
        )}
        {leftOpen
          ? <PageThumbnails activePageId={page.id} onCollapse={() => setLeftOpen(false)} pages={pages} />
          : <button className="open-side-panel left" onClick={() => setLeftOpen(true)} title="Mostrar páginas" type="button"><PanelLeftOpen size={18} /></button>}
        <PageCanvas
          annotations={annotations}
          onCreate={handleCanvasCreate}
          onCreateLine={handleCreateLine}
          visibleTypes={visibleTypes}
          onDeleteAnnotation={id => deleteAndAdvance(id)}
          onImageError={() => {
            // Signed URL expirada: rebusca a página para uma URL nova.
            if (!pageId) return
            apiDataService.getPage(pageId)
              .then(fresh => useAppStore.getState().addPages([fresh]))
              .catch(() => {})
          }}
          onDraftChange={setDraftPoints}
          onEditVertices={id => { setSelected(id); setTool('vertices') }}
          onSelect={setSelected}
          onUpdatePolygon={(id, polygon) => updateAnnotation(pageId, id, { polygon })}
          onUpdateBaseline={(id, baseline) => updateAnnotation(pageId, id, { baseline })}
          showLinePolygons={showLinePolygons}
          onZoomChange={setZoom}
          page={page}
          ref={canvasRef}
          draftLabel={tool === 'word'
            ? 'Desenhe a palavra — Enter conclui'
            : drawKind === 'subregion'
            ? 'Desenhe a sub-região — depois escolha a região-mãe'
            : drawKind === 'region'
              ? 'Desenhe a região — Enter conclui'
              : undefined}
          rotation={rotation}
          selectedId={selectedId}
          tool={tool}
        />
        {rightOpen ? (
          <aside className="annotation-panel">
            <div className="panel-header annotation-panel-header">
              <div className="panel-tabs"><button className={rightTab === 'flow' ? 'is-active' : ''} onClick={() => setRightTab('flow')} type="button">Fluxo</button><button className={rightTab === 'transcription' ? 'is-active' : ''} onClick={() => setRightTab('transcription')} type="button">Transcrição</button><button className={rightTab === 'annotations' ? 'is-active' : ''} onClick={() => setRightTab('annotations')} type="button">Anotações</button><button className={rightTab === 'page' ? 'is-active' : ''} onClick={() => setRightTab('page')} type="button">Página</button></div>
              <button className="icon-button always-visible bare" onClick={() => setRightOpen(false)} title="Recolher painel" type="button"><PanelRightClose size={17} /></button>
            </div>
            {rightTab === 'page' ? <PageMetadata page={page} />
              : rightTab === 'flow' ? (
                <FlowPanel
                  annotations={annotations}
                  canSegment={admin && annotationsReady}
                  onAction={handleFlowAction}
                  onSegment={() => void segmentPage()}
                  segmenting={segmenting}
                  segmentProgress={segmentProgress}
                />
              ) : rightTab === 'transcription' ? (
                <TranscriptionPanel
                  annotations={annotations}
                  onMoveLine={moveLine}
                  onSelect={setSelected}
                  onRegionType={(regionId, regionType) => updateAnnotation(pageId, regionId, { regionType, status: 'in_review' })}
                  selectedId={selectedId}
                />
              ) : (
              <>
                <div className="annotation-summary"><span>{annotations.length} elementos</span>{hierarchyPath && <small>{hierarchyPath}</small>}</div>
                <AnnotationTree annotations={annotations} onSelect={setSelected} selectedId={selectedId} />
                <div className="panel-section-title"><span>Transcrição</span>{selectedAnnotation && <code>{selectedAnnotation.id}</code>}</div>
                {selectedAnnotation
                  ? <TranscriptionEditor
                      annotation={selectedAnnotation}
                      words={selectedWords}
                      openRecords={openRecords}
                      onChange={text => updateAnnotation(pageId, selectedAnnotation.id, { correctedText: text, status: 'in_review' })}
                      onStatus={status => updateAnnotation(pageId, selectedAnnotation.id, { status })}
                      onRegionType={regionType => updateAnnotation(pageId, selectedAnnotation.id, { regionType, status: 'in_review' })}
                      onRecordType={recordType => updateAnnotation(pageId, selectedAnnotation.id, { recordType, status: 'in_review' })}
                      bookRecordType={bookRecordType}
                      onLinkRecord={continuesId => updateAnnotation(pageId, selectedAnnotation.id, {
                        // record_id acompanha o alvo: o backend dá prioridade a ele
                        // sobre continues_record_id — sem isso a continuação era ignorada.
                        continuesRecordId: continuesId || undefined,
                        recordId: continuesId ?? undefined,
                        status: 'in_review',
                      })}
                      onScribeChange={(scribeId, role) => updateAnnotation(pageId, selectedAnnotation.id, { scribeId, scribeRole: role || null, status: 'in_review' })}
                      onFragmentPatch={(regionId, patch) => {
                        if (regionId === selectedAnnotation.id) {
                          updateAnnotation(pageId, selectedAnnotation.id, {
                            fragmentOrder: patch.fragmentOrder,
                            fragmentRole: patch.fragmentRole,
                            status: 'in_review',
                          })
                        }
                        if (!admin) return
                        void apiDataService.patchRegionFragment(regionId, patch)
                          .then(() => setSaveNotice('Ordem da parte atualizada.'))
                          .catch(() => setSaveError('Falha ao atualizar a ordem da parte.'))
                      }}
                      onSeparate={() => updateAnnotation(pageId, selectedAnnotation.id, {
                        recordId: undefined,
                        continuesRecordId: undefined,
                        fragmentOrder: undefined,
                        fragmentRole: undefined,
                        status: 'in_review',
                      })}
                      page={page}
                    />
                  : <div className="transcription-empty"><p>Selecione uma anotação no documento ou na árvore.</p></div>}
              </>
            )}
          </aside>
        ) : <button className="open-side-panel right" onClick={() => setRightOpen(true)} title="Mostrar anotações" type="button"><PanelRightOpen size={18} /></button>}
      </div>
      <footer className="viewer-statusbar">
        <span>{tool === 'polygon' ? (drawKind === 'subregion' ? 'Nova sub-região' : 'Nova região') : tool === 'line' ? 'Nova linha — clique no início e no fim da base' : tool === 'word' ? 'Nova palavra — desenhe o contorno e conclua' : tool === 'vertices' ? 'Edição de vértices' : tool === 'pan' ? 'Mover imagem' : 'Seleção'}</span>
        {creationHint && <span className="creation-hint">{creationHint}</span>}
        <span>X/Y em coordenadas originais</span>
        <button onClick={() => setHelpOpen(true)} type="button"><CircleHelp size={13} /> Atalhos</button>
        {saveState !== 'idle' && (
          <strong className={`save-state save-state-${saveState}`}>
            {saveState === 'saving' ? 'Salvando…'
              : saveState === 'dirty' ? `Alterações pendentes${pendingCount ? ` (${pendingCount})` : ''}`
              : saveState === 'error' ? 'Erro ao salvar'
              : 'Salvo'}
          </strong>
        )}
        {saveNotice && <strong className="saved-toast">{saveNotice}</strong>}
        {segmentInfo && <strong className="saved-toast">{segmentInfo}</strong>}
        {saveError && <div className="saved-toast" role="alert">{saveError} <button className="secondary-button" type="button" disabled={saveState === 'saving'} onClick={() => void savePage()}>Tentar novamente</button></div>}
        {!annotationsReady && !loadError && <strong className="saved-toast">A carregar anotações…</strong>}
        {loadError && <strong className="saved-toast">{loadError} <button className="secondary-button" onClick={() => { setLoadError(''); fetchAnnotations() }} type="button">Tentar novamente</button></strong>}
      </footer>
      {pendingPolygon && pendingPolygon.kind === 'region' && (
        <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && (setPendingPolygon(null), setPickContinuation(false))} role="presentation">
          <div className="dialog type-dialog">
            {pickContinuation ? (
              <>
                <div className="dialog-header">
                  <div><p className="eyebrow">Continuação de assento</p><h2>De qual assento este trecho é parte?</h2></div>
                  <button className="secondary-button" onClick={() => setPickContinuation(false)} type="button">Voltar</button>
                </div>
                <p className="dialog-hint">Escolha o assento que já começou noutro lugar — este retângulo vira uma parte dele, não um assento novo.</p>
                <div className="type-options continuation-options">
                  {openRecords.map(record => (
                    <button
                      key={record.id}
                      onClick={() => {
                        createAnnotation(pendingPolygon.points, 'record', undefined, undefined, {
                          recordId: record.id,
                          continuesRecordId: record.id,
                          fragmentRole: 'continuation',
                          status: 'in_review',
                        })
                        setPendingPolygon(null)
                        setPickContinuation(false)
                        setSaveNotice('Parte ligada ao assento — lembre de Salvar.')
                      }}
                      type="button"
                    >
                      <RecordPreview preview={record.preview} />
                      <span>
                        <strong>{record.seq ? `Nº ${record.seq} · ` : ''}{record.displayLabel ?? `${recordTypeOntologyLabels[record.recordType] ?? record.recordType}${record.recordLabel ? ` — ${record.recordLabel}` : ''}`}</strong>
                        <small>{recordTypeOntologyLabels[record.recordType] ?? record.recordType}</small>
                      </span>
                    </button>
                  ))}
                  {!openRecords.length && <p className="dialog-empty">Ainda não há assentos neste livro — crie o assento original primeiro.</p>}
                </div>
              </>
            ) : (
              <>
                <div className="dialog-header"><div><p className="eyebrow">Nova área</p><h2>O que é esta área?</h2></div><button className="secondary-button" onClick={() => setPendingPolygon(null)} type="button">Cancelar</button></div>
                <div className="type-options">
                  <button onClick={() => { createAnnotation(pendingPolygon.points, 'region'); setPendingPolygon(null) }} type="button">
                    <strong>Região</strong>
                    <small>Número de página, termo de abertura, selo, carimbo, prefácio… blocos que não são registros paroquiais. O rótulo pode ser ajustado depois na aba Transcrição.</small>
                  </button>
                  <button onClick={() => { createAnnotation(pendingPolygon.points, 'record'); setPendingPolygon(null) }} type="button">
                    <strong>Assento paroquial novo</strong>
                    <small>Batismo, casamento ou óbito que começa aqui — a região que contém todas as sub-regiões do assento (parágrafo, cabeçalho, margem, assinaturas).</small>
                  </button>
                  <button onClick={() => setPickContinuation(true)} type="button">
                    <strong>Continuação de um assento</strong>
                    <small>O resto de um batismo/casamento/óbito que já começou noutro lugar — mesmo assento, não um novo. Escolha qual na lista seguinte.</small>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {pendingPolygon && pendingPolygon.kind === 'subregion' && (
        <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setPendingPolygon(null)} role="presentation">
          <div className="dialog type-dialog">
            <div className="dialog-header"><div><p className="eyebrow">Nova sub-região</p><h2>Dentro de qual região ela está?</h2></div><button className="secondary-button" onClick={() => setPendingPolygon(null)} type="button">Cancelar</button></div>
            <p className="dialog-hint">A sub-região sempre pertence a uma região — parágrafo principal, cabeçalho, rodapé, anotação lateral, assinatura, número do registro…</p>
            <div className="type-options parent-options">
              {annotations
                .filter(annotation => annotation.type === 'region' || annotation.type === 'record')
                .sort((a, b) => a.readingOrder - b.readingOrder)
                .map(annotation => (
                  <button key={annotation.id} onClick={() => { createAnnotation(pendingPolygon.points, 'region', annotation.id); setPendingPolygon(null) }} type="button">
                    <strong>{annotationDisplayLabel(annotation)}</strong>
                    <small>{annotation.type === 'record' ? 'Registro' : (annotation.regionType?.trim() ? annotation.regionType : 'Região')}{annotation.parentId ? ' · sub-região' : ''}</small>
                  </button>
                ))}
              {!annotations.some(annotation => annotation.type === 'region' || annotation.type === 'record') && (
                <p className="dialog-empty">Desenhe primeiro uma região ou registro — a sub-região precisa de um pai.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {confirmOpen && annotationsReady && (
        <ConfirmLines
          key={pageId}
          annotations={annotations}
          registerDraft={registerLineDraft}
          saving={saveState === 'saving'}
          saveError={saveError}
          onClose={() => setConfirmOpen(false)}
          onConfirmText={(lineId, text, verified) => updateAnnotation(pageId, lineId, {
            correctedText: text || undefined,
            status: verified ? 'verified' : 'in_review',
          })}
          onSaveNow={() => void savePage()}
          page={page}
          pendingCount={pendingCount}
          suggestions={pageSuggestions}
        />
      )}
      {saveState === 'saving' && <div className="saved-toast viewer-save-progress" role="status"><progress aria-label="Salvando alterações" /> Salvando alterações…</div>}
      {blocker.state === 'blocked' && (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog">
            <div className="dialog-header"><div><span className="eyebrow">Alterações não guardadas</span><h2>{saveState === 'saving' ? 'Salvamento em andamento' : 'Sair sem salvar?'}</h2></div></div>
            <p className="dialog-hint">
              {pendingCount
                ? `Você tem ${pendingCount} ${pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'} nesta página.`
                : 'Você tem alterações nesta página que ainda não foram guardadas.'}
            </p>
            <p>{saveState === 'saving' ? 'Aguarde a confirmação antes de sair.' : 'Se sair agora, as alterações pendentes serão perdidas.'}</p>
            {saveError && <p className="error-text" role="alert">{saveError}</p>}
            <div className="dialog-footer">
              <button className="secondary-button" onClick={() => blocker.reset()} type="button">Cancelar</button>
              <button className="secondary-button" disabled={saveState === 'saving'} onClick={() => {
                setConfirmOpen(false)
                const saved = savedAnnotationsRef.current[pageId]
                if (saved) setAnnotations(pageId, saved)
                blocker.proceed()
              }} type="button">Sair sem salvar</button>
              <button className="primary-button" disabled={leavingSave || saveState === 'saving'} onClick={() => void saveAndLeave()} type="button">
                {saveState === 'saving' ? 'Salvando…' : hasUnsavedChanges() ? 'Salvar e sair' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {helpOpen && (
        <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setHelpOpen(false)} role="presentation">
          <div className="dialog shortcuts-dialog">
            <div className="dialog-header"><div><p className="eyebrow">Editor</p><h2>Atalhos de teclado</h2></div><button className="secondary-button" onClick={() => setHelpOpen(false)} type="button">Fechar</button></div>
            <div className="shortcuts-grid">
              {[['V', 'Selecionar'], ['H', 'Mover imagem'], ['P', 'Desenhar região'], ['L', 'Adicionar linha'], ['W', 'Adicionar palavra'], ['E', 'Editar vértices'], ['Delete', 'Excluir seleção'], ['Ctrl Z', 'Desfazer'], ['Ctrl ⇧ Z', 'Refazer'], ['+', 'Ampliar'], ['−', 'Reduzir'], ['0', 'Ajustar à tela'], ['Enter', 'Concluir polígono'], ['Setas', 'Mover seleção / navegar']].map(([key, label]) => <div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
