import { create } from 'zustand'
import { apiDataService } from '../services/dataService'
import type { Annotation, Collection, Document, Page, Point } from '../types/domain'

interface AnnotationHistory {
  past: Annotation[][]
  future: Annotation[][]
}

interface AppState {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  collections: Collection[]
  documents: Document[]
  pages: Page[]
  annotationsByPage: Record<string, Annotation[]>
  histories: Record<string, AnnotationHistory>
  selectedAnnotationId?: string
  activeTool: 'select' | 'pan' | 'polygon' | 'vertices' | 'zoom'
  annotationType: Annotation['type']
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSelectedAnnotation: (id?: string) => void
  setActiveTool: (tool: AppState['activeTool']) => void
  setAnnotationType: (type: Annotation['type']) => void
  addCollection: (collection: Collection) => void
  addDocument: (document: Document) => void
  addPages: (pages: Page[]) => void
  addAnnotation: (pageId: string, annotation: Annotation) => void
  updateAnnotation: (pageId: string, annotationId: string, updates: Partial<Annotation>) => void
  updateVertex: (pageId: string, annotationId: string, vertexIndex: number, point: Point) => void
  deleteAnnotation: (pageId: string, annotationId: string) => void
  undo: (pageId: string) => void
  redo: (pageId: string) => void
  loadWorkspace: () => Promise<void>
  setAnnotations: (pageId: string, annotations: Annotation[]) => void
}

const pushHistory = (
  state: AppState,
  pageId: string,
  nextAnnotations: Annotation[],
): Pick<AppState, 'annotationsByPage' | 'histories'> => {
  const current = state.annotationsByPage[pageId] ?? []
  const history = state.histories[pageId] ?? { past: [], future: [] }
  return {
    annotationsByPage: { ...state.annotationsByPage, [pageId]: nextAnnotations },
    histories: {
      ...state.histories,
      [pageId]: { past: [...history.past.slice(-29), current], future: [] },
    },
  }
}

const initialTheme = (): 'light' | 'dark' => {
  const stored = localStorage.getItem('htr-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: initialTheme(),
  sidebarCollapsed: false,
  collections: [],
  documents: [],
  pages: [],
  annotationsByPage: {},
  histories: {},
  selectedAnnotationId: undefined,
  activeTool: 'select',
  annotationType: 'line',
  setTheme: theme => {
    localStorage.setItem('htr-theme', theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSelectedAnnotation: selectedAnnotationId => set({ selectedAnnotationId }),
  setActiveTool: activeTool => set({ activeTool }),
  setAnnotationType: annotationType => set({ annotationType }),
  addCollection: collection => set(state => ({ collections: [...state.collections, collection] })),
  addDocument: document => set(state => ({
    documents: [...state.documents, document],
    collections: state.collections.map(collection =>
      collection.id === document.collectionId
        ? { ...collection, documentIds: [...collection.documentIds, document.id], updatedAt: new Date().toISOString() }
        : collection,
    ),
  })),
  addPages: pages => set(state => ({
    pages: [...state.pages, ...pages],
    documents: state.documents.map(document => {
      const additions = pages.filter(page => page.documentId === document.id)
      return additions.length ? { ...document, pageIds: [...document.pageIds, ...additions.map(page => page.id)] } : document
    }),
    annotationsByPage: {
      ...state.annotationsByPage,
      ...Object.fromEntries(pages.map(page => [page.id, []])),
    },
  })),
  addAnnotation: (pageId, annotation) => set(state =>
    pushHistory(state, pageId, [...(state.annotationsByPage[pageId] ?? []), annotation]),
  ),
  updateAnnotation: (pageId, annotationId, updates) => set(state =>
    pushHistory(
      state,
      pageId,
      (state.annotationsByPage[pageId] ?? []).map(annotation =>
        annotation.id === annotationId ? { ...annotation, ...updates } : annotation,
      ),
    ),
  ),
  updateVertex: (pageId, annotationId, vertexIndex, point) => {
    const annotation = get().annotationsByPage[pageId]?.find(item => item.id === annotationId)
    if (!annotation) return
    const polygon = annotation.polygon.map((vertex, index) => index === vertexIndex ? point : vertex)
    get().updateAnnotation(pageId, annotationId, { polygon })
  },
  deleteAnnotation: (pageId, annotationId) => set(state => {
    const annotations = state.annotationsByPage[pageId] ?? []
    const descendants = new Set([annotationId])
    let changed = true
    while (changed) {
      changed = false
      annotations.forEach(annotation => {
        if (annotation.parentId && descendants.has(annotation.parentId) && !descendants.has(annotation.id)) {
          descendants.add(annotation.id)
          changed = true
        }
      })
    }
    return {
      ...pushHistory(state, pageId, annotations.filter(annotation => !descendants.has(annotation.id))),
      selectedAnnotationId: undefined,
    }
  }),
  undo: pageId => set(state => {
    const history = state.histories[pageId]
    if (!history?.past.length) return state
    const previous = history.past.at(-1)!
    const current = state.annotationsByPage[pageId] ?? []
    return {
      annotationsByPage: { ...state.annotationsByPage, [pageId]: previous },
      histories: {
        ...state.histories,
        [pageId]: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, 30) },
      },
    }
  }),
  redo: pageId => set(state => {
    const history = state.histories[pageId]
    if (!history?.future.length) return state
    const next = history.future[0]
    const current = state.annotationsByPage[pageId] ?? []
    return {
      annotationsByPage: { ...state.annotationsByPage, [pageId]: next },
      histories: {
        ...state.histories,
        [pageId]: { past: [...history.past, current].slice(-30), future: history.future.slice(1) },
      },
    }
  }),
  setAnnotations: (pageId, annotations) => set(state => ({
    annotationsByPage: { ...state.annotationsByPage, [pageId]: annotations },
  })),
  loadWorkspace: async () => {
    const collections = await apiDataService.listCollections()
    const documents = (await Promise.all(
      collections.flatMap(collection => apiDataService.listDocuments(collection.id)),
    )).flat()
    const pages = (await Promise.all(
      documents.flatMap(document => apiDataService.listPages(document.id)),
    )).flat()
    const annotationEntries = await Promise.all(
      pages.map(async page => [page.id, await apiDataService.listAnnotations(page.id)] as const),
    )
    set({
      collections,
      documents,
      pages,
      annotationsByPage: Object.fromEntries(annotationEntries),
    })
  },
}))
