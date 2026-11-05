import { demoCollection, mockAnnotations, mockCollections, mockDocuments, mockPages } from '../mocks/data'
import type {
  Annotation, Collection, CreateCollectionInput, CreateDocumentInput, Document, Page,
} from '../types/domain'
import type { Point } from '../types/domain'

const wait = (duration = 120) => new Promise(resolve => window.setTimeout(resolve, duration))

export interface Workspace {
  collections: Collection[]
  documents: Document[]
  pages: Page[]
}

export interface DataService {
  listCollections(): Promise<Collection[]>
  createCollection(input: CreateCollectionInput): Promise<Collection>
  listDocuments(collectionId: string): Promise<Document[]>
  createDocument(input: CreateDocumentInput): Promise<Document>
  listPages(documentId: string): Promise<Page[]>
  importImages(documentId: string, files: File[]): Promise<Page[]>
  getPage(pageId: string): Promise<Page | undefined>
  saveAnnotations(pageId: string, annotations: Annotation[]): Promise<Annotation[]>
  listAnnotations(pageId: string): Promise<Annotation[]>
  updateTranscription(annotationId: string, text: string): Promise<Annotation>
}

export const mockDataService: DataService = {
  async listCollections() { await wait(); return structuredClone(mockCollections) },
  async createCollection(input) {
    await wait()
    return { ...input, id: `collection-${crypto.randomUUID()}`, documentIds: [],
      pageCount: 0, updatedAt: new Date().toISOString() }
  },
  async listDocuments(collectionId) {
    await wait()
    return structuredClone(mockDocuments.filter(document => document.collectionId === collectionId))
  },
  async createDocument(input) {
    await wait()
    return { ...input, id: `document-${crypto.randomUUID()}`, pageIds: [], status: 'imported' }
  },
  async listPages(documentId) {
    await wait()
    return structuredClone(mockPages.filter(page => page.documentId === documentId))
  },
  async importImages(documentId, files) {
    await wait(600)
    return files.map((file, index) => ({
      id: `page-${crypto.randomUUID()}`, documentId, pageNumber: index + 1,
      originalFilename: file.name, imageUrl: URL.createObjectURL(file),
      width: 1200, height: 1600, fileSize: file.size, status: 'imported' as const,
      rotation: 0, importedAt: new Date().toISOString(),
    }))
  },
  async getPage(pageId) { await wait(); return structuredClone(mockPages.find(page => page.id === pageId)) },
  async saveAnnotations(_pageId, annotations) { await wait(240); return structuredClone(annotations) },
  async listAnnotations(pageId) {
    await wait()
    return structuredClone(mockAnnotations.filter(annotation => annotation.pageId === pageId))
  },
  async updateTranscription(annotationId, text) {
    await wait()
    const annotation = mockAnnotations.find(item => item.id === annotationId) ?? mockAnnotations[2]
    return { ...structuredClone(annotation), correctedText: text, status: 'in_review' }
  },
}

const errorMessage = async (response: Response) => {
  const raw = await response.text()
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown; error?: unknown }
    const detail = parsed.detail ?? parsed.error
    if (typeof detail === 'string') return detail
    if (detail) return JSON.stringify(detail)
  } catch {
    // resposta não JSON
  }
  return raw || `Erro ${response.status} na API`
}

const api = async (path: string, init?: RequestInit): Promise<any> => {
  let response: Response
  try {
    response = await fetch(`/api${path}`, init)
  } catch {
    throw new Error('Não foi possível contactar a API. Verifique se os servidores estão em execução.')
  }
  if (!response.ok) throw new Error(await errorMessage(response))
  return response.status === 204 ? undefined : response.json()
}

const toPage = (row: Record<string, unknown>): Page => ({
  id: String(row.id), documentId: String(row.document_id), pageNumber: Number(row.page_number),
  originalFilename: String(row.original_filename ?? ''), imageUrl: String(row.image_url ?? ''),
  width: Number(row.width_px ?? row.width ?? 0), height: Number(row.height_px ?? row.height ?? 0),
  fileSize: Number(row.file_size ?? 0), status: (row.status ?? 'imported') as Page['status'],
  rotation: Number(row.rotation ?? 0),
  importedAt: String(row.created_at ?? row.imported_at ?? new Date().toISOString()),
})

const toDocument = (row: Record<string, unknown>): Document => {
  const meta = (row.metadata ?? {}) as Record<string, unknown>
  return {
  id: String(row.id), collectionId: String(row.collection_id), title: String(row.title),
  recordType: (row.record_type ?? meta.record_type) as Document['recordType'],
  startYear: Number(row.start_year ?? meta.start_year), endYear: Number(row.end_year ?? meta.end_year),
  archivalReference: String(row.archival_reference ?? row.source_reference ?? ''),
  sourceUrl: String(row.source_url ?? ''), pageIds: (row.page_ids ?? []) as string[],
  status: (row.status ?? 'imported') as Document['status'],
  }
}

const toCollection = (row: Record<string, unknown>): Collection => ({
  id: String(row.id), title: String(row.title),
  recordType: (row.book_type ?? row.record_type ?? 'batismo') as Collection['recordType'],
  startYear: Number(String(row.start_date ?? row.start_year ?? '').slice(0, 4)),
  endYear: Number(String(row.end_date ?? row.end_year ?? '').slice(0, 4)),
  parish: String(row.parish ?? ''), municipality: String(row.municipality ?? ''),
  district: String(row.district ?? ''), notes: String(row.reuse_notes ?? row.notes ?? ''),
  sourceUrl: String(row.source_url ?? ''), documentIds: (row.document_ids ?? []) as string[],
  pageCount: Number(row.page_count ?? 0),
  updatedAt: String(row.updated_at ?? row.created_at ?? ''),
})

const toPoints = (value: unknown): Point[] | undefined => {
  if (!Array.isArray(value)) return undefined
  return value.map(point => {
    if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) }
    const object = point as Record<string, unknown>
    return { x: Number(object.x), y: Number(object.y) }
  })
}

const toAnnotation = (row: Record<string, unknown>): Annotation => ({
  id: String(row.id), pageId: String(row.page_id),
  parentId: row.parent_id ? String(row.parent_id) : undefined,
  type: row.element_type as Annotation['type'],
  polygon: toPoints(row.polygon) ?? [],
  baseline: toPoints(row.baseline),
  readingOrder: Number(row.reading_order ?? 0),
  predictedText: (row.predicted_text ?? undefined) as string | undefined,
  correctedText: (row.corrected_text ?? undefined) as string | undefined,
  confidence: row.confidence as number | undefined,
  status: row.is_verified ? 'verified' : row.corrected_text ? 'in_review' : 'pending',
  originalPolygon: toPoints(row.original_polygon),
  originalBaseline: toPoints(row.original_baseline),
})

export interface SegmentResult { lines: number, regions: number, records: number }

export const apiDataService: DataService & {
  getWorkspace(): Promise<Workspace>
  segmentPage(pageId: string): Promise<SegmentResult>
} = {
  async segmentPage(pageId) {
    return api(`/pages/${pageId}/segment`, { method: 'POST' })
  },
  async getWorkspace() {
    const data = await api('/workspace')
    return {
      collections: data.collections.map(toCollection),
      documents: data.documents.map(toDocument),
      pages: data.pages.map(toPage),
    }
  },
  async listCollections() { return (await api('/collections')).map(toCollection) },
  async createCollection(input) {
    return toCollection(await api('/collections', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        book_type: input.recordType,
        start_date: `${input.startYear}-01-01`,
        end_date: `${input.endYear}-12-31`,
        parish: input.parish,
        municipality: input.municipality,
        district: input.district,
        source_url: input.sourceUrl,
        reuse_notes: input.notes,
      }),
    }))
  },
  async listDocuments(collectionId) {
    return (await api(`/collections/${collectionId}/documents`)).map(toDocument)
  },
  async createDocument(input) {
    return toDocument(await api('/documents', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collection_id: input.collectionId, title: input.title,
        record_type: input.recordType, start_year: input.startYear, end_year: input.endYear,
        archival_reference: input.archivalReference || null, source_url: input.sourceUrl || null }) }))
  },
  async listPages(documentId) { return (await api(`/documents/${documentId}/pages`)).map(toPage) },
  async importImages(documentId, files) {
    const pages: Page[] = []
    const existing = await this.listPages(documentId)
    const nextNumber = existing.reduce((max, page) => Math.max(max, page.pageNumber), 0) + 1
    for (const [index, file] of files.entries()) {
      const form = new FormData()
      form.append('document_id', documentId)
      form.append('page_number', String(nextNumber + index))
      form.append('file', file)
      pages.push(toPage(await api('/pages/import', { method: 'POST', body: form })))
    }
    return pages
  },
  async getPage(pageId) {
    const row = await api(`/pages/${pageId}`)
    return row ? toPage(row) : undefined
  },
  async listAnnotations(pageId) {
    return (await api(`/pages/${pageId}/annotations`)).map(toAnnotation)
  },
  async saveAnnotations(pageId, annotations) {
    const rows = await api(`/pages/${pageId}/annotations`, { method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(annotations.map(annotation => ({
        id: annotation.id, parent_id: annotation.parentId ?? null,
        element_type: annotation.type, reading_order: annotation.readingOrder,
        polygon: annotation.polygon.map(point => [point.x, point.y]),
        baseline: annotation.baseline?.map(point => [point.x, point.y]) ?? null,
        predicted_text: annotation.predictedText ?? null,
        corrected_text: annotation.correctedText ?? null, confidence: annotation.confidence ?? null,
        is_verified: annotation.status === 'verified',
      }))) })
    return rows.map(toAnnotation)
  },
  async updateTranscription(annotationId, _text) {
    throw new Error(`Use saveAnnotations para atualizar ${annotationId}.`)
  },
}

export const initialData = {
  collections: [demoCollection], documents: mockDocuments, pages: mockPages, annotations: mockAnnotations,
}
