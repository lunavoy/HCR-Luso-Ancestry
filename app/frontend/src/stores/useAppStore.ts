import { create } from 'zustand'
import { apiDataService } from '../services/dataService'
import type { Annotation, Collection, Document, Page } from '../types/domain'

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
  activeTool: 'select' | 'pan' | 'polygon' | 'vertices' | 'line' | 'word'
  workspaceStatus: 'idle' | 'loading' | 'ready' | 'error'
  workspaceError?: string
  loadedAnnotationPages: Record<string, boolean>
  loadAnnotations: (pageId: string, options?: { force?: boolean }) => Promise<void>
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSelectedAnnotation: (id?: string) => void
  setActiveTool: (tool: AppState['activeTool']) => void
  addCollection: (collection: Collection) => void
  updateCollection: (collection: Collection) => void
  addDocument: (document: Document) => void
  addPages: (pages: Page[]) => void
  addAnnotation: (pageId: string, annotation: Annotation) => void
  mutateAnnotations: (pageId: string, mutator: (annotations: Annotation[]) => Annotation[]) => void
  updateAnnotation: (pageId: string, annotationId: string, updates: Partial<Annotation>) => void
  deleteAnnotation: (pageId: string, annotationId: string) => void
  undo: (pageId: string) => void
  redo: (pageId: string) => void
  loadWorkspace: () => Promise<void>
  clearWorkspace: () => void
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

const withCounts = (collections: Collection[], documents: Document[], pages: Page[]) => {
  const pagesByDocument = new Map<string, string[]>()
  pages.forEach(page => pagesByDocument.set(page.documentId, [...(pagesByDocument.get(page.documentId) ?? []), page.id]))
  const countedDocuments = documents.map(document => ({ ...document, pageIds: pagesByDocument.get(document.id) ?? [] }))
  const countedCollections = collections.map(collection => {
    const own = countedDocuments.filter(document => document.collectionId === collection.id)
    return {
      ...collection,
      documentIds: own.map(document => document.id),
      pageCount: own.reduce((sum, document) => sum + document.pageIds.length, 0),
    }
  })
  return { collections: countedCollections, documents: countedDocuments, pages }
}

const initialTheme = (): 'light' | 'dark' => {
  const stored = localStorage.getItem('htr-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let workspaceGeneration = 0

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
  workspaceStatus: 'idle',
  workspaceError: undefined,
  loadedAnnotationPages: {},
  setTheme: theme => {
    localStorage.setItem('htr-theme', theme)
    set({ theme })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSelectedAnnotation: selectedAnnotationId => set({ selectedAnnotationId }),
  setActiveTool: activeTool => set({ activeTool }),
  addCollection: collection => set(state => ({ collections: [...state.collections, collection] })),
  updateCollection: collection => set(state => ({
    collections: state.collections.map(item => item.id === collection.id ? collection : item),
  })),
  addDocument: document => set(state => withCounts(state.collections, [...state.documents, document], state.pages)),
  addPages: pages => set(state => {
    const replaced = new Set(pages.map(page => page.id))
    return withCounts(state.collections, state.documents, [...state.pages.filter(page => !replaced.has(page.id)), ...pages])
  }),
  addAnnotation: (pageId, annotation) => set(state =>
    pushHistory(state, pageId, [...(state.annotationsByPage[pageId] ?? []), annotation]),
  ),
  mutateAnnotations: (pageId, mutator) => set(state =>
    pushHistory(state, pageId, mutator(state.annotationsByPage[pageId] ?? [])),
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
  clearWorkspace: () => {
    workspaceGeneration++
    set({
      collections: [], documents: [], pages: [], annotationsByPage: {},
      histories: {}, loadedAnnotationPages: {}, selectedAnnotationId: undefined,
      activeTool: 'select', workspaceStatus: 'idle', workspaceError: undefined,
    })
  },
  loadWorkspace: async () => {
    if (get().workspaceStatus === 'loading') return
    const generation = workspaceGeneration
    set({ workspaceStatus: 'loading', workspaceError: undefined })
    try {
      const workspace = await apiDataService.getWorkspace()
      if (generation !== workspaceGeneration) return
      set({ ...withCounts(workspace.collections, workspace.documents, workspace.pages), workspaceStatus: 'ready' })
    } catch (error) {
      if (generation !== workspaceGeneration) return
      console.error('Não foi possível carregar o workspace:', error)
      set({ workspaceStatus: 'error', workspaceError: error instanceof Error ? error.message : String(error) })
    }
  },
  loadAnnotations: async (pageId, options) => {
    if (!options?.force && get().loadedAnnotationPages[pageId]) return
    const generation = workspaceGeneration
    const annotations = await apiDataService.listAnnotations(pageId)
    if (generation !== workspaceGeneration) return
    set(state => ({
      annotationsByPage: { ...state.annotationsByPage, [pageId]: annotations },
      loadedAnnotationPages: { ...state.loadedAnnotationPages, [pageId]: true },
      ...(options?.force ? { histories: { ...state.histories, [pageId]: { past: [], future: [] } } } : {}),
    }))
  },
}))
