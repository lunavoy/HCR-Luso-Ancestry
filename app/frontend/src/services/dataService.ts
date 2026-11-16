import type {
  Annotation, Collection, CreateCollectionInput, CreateDocumentInput, Document, DocumentRecord, MapStats, Page,
  PageSummary, PersonDetail, PersonMapStats, PersonStats, PersonSummary, PersonTimeline, Place, RecordDetail, RecordMention, Scribe, SegmentProgress,
  LexiconStats, LexiconSuggestion, DashboardStats, ScribeMapEntry,
} from '../types/domain'
import type { Point } from '../types/domain'
import { getAuthClient } from './authClient'

export interface Workspace {
  collections: Collection[]
  documents: Document[]
  pages: Page[]
}

export interface DataService {
  createCollection(input: CreateCollectionInput): Promise<Collection>
  updateCollection(id: string, input: Partial<CreateCollectionInput>): Promise<Collection>
  createDocument(input: CreateDocumentInput): Promise<Document>
  listPages(documentId: string): Promise<Page[]>
  getPage(pageId: string): Promise<Page>
  importImages(documentId: string, files: File[]): Promise<Page[]>
  saveAnnotations(pageId: string, annotations: Annotation[]): Promise<Annotation[]>
  listAnnotations(pageId: string): Promise<Annotation[]>
  listDocumentRecords(documentId: string): Promise<DocumentRecord[]>
  listPageSummary(): Promise<PageSummary[]>
  getRecord(recordId: string): Promise<RecordDetail>
  saveRecordContent(recordId: string, fields: Record<string, unknown>, markVerified?: boolean): Promise<unknown>
  saveRecordMentions(recordId: string, mentions: Omit<RecordMention, 'id' | 'record_id'>[], markVerified?: boolean): Promise<unknown>
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
  const client = await getAuthClient()
  const { data: { session } } = await client.auth.getSession()
  if (!session) throw new Error('Entre na sua conta para continuar.')
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new Error('Não foi possível contactar a API. Verifique se os servidores estão em execução.')
  }
  if (!response.ok) {
    const error = new Error(await errorMessage(response)) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return response.status === 204 ? undefined : response.json()
}

export type WorkspaceLevel = 'videira' | 'cacho' | 'vinho'

export interface WorkspaceAccount {
  id: string
  email: string | null
  role: 'admin' | 'contributor'
  level: WorkspaceLevel
  changeCount: number
}

export function listWorkspaceAccounts(page: number): Promise<{ users: WorkspaceAccount[]; hasNext: boolean }> {
  return api(`/admin/users?page=${page}`)
}

export interface TrainingInterest {
  email: string
  name: string
  experience: string
  submitted_at: string
}

export function listTrainingInterest(page: number): Promise<{ entries: TrainingInterest[]; hasNext: boolean }> {
  return api(`/admin/training-interest?page=${page}`)
}

export function setWorkspaceLevel(id: string, level: WorkspaceLevel): Promise<WorkspaceAccount> {
  return api(`/admin/users/${encodeURIComponent(id)}/level`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  })
}

export interface WorkspaceChange {
  id: number
  page_id: string
  created_at: string
  changes: { id: string; before: unknown; after: unknown }[]
}

export function listWorkspaceChanges(id: string, page: number): Promise<{ entries: WorkspaceChange[]; hasNext: boolean }> {
  return api(`/admin/users/${encodeURIComponent(id)}/changes?page=${page}`)
}

const toPage = (row: Record<string, unknown>): Page => ({
  id: String(row.id), documentId: String(row.document_id),
  pageNumber: Number(row.digital_order ?? row.page_number ?? 0),
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
  scribeId: row.scribe_id ? String(row.scribe_id) : null,
  scribes: Array.isArray(row.scribes) ? (row.scribes as Record<string, unknown>[]).map(s => ({
    id: String(s.id), name: String(s.name), is_primary: Boolean(s.is_primary),
  })) : undefined,
  status: (row.status ?? 'imported') as Document['status'],
  }
}

const toCollection = (row: Record<string, unknown>): Collection => ({
  id: String(row.id), title: String(row.title),
  recordType: (row.book_type ?? row.record_type ?? 'batismo') as Collection['recordType'],
  startYear: Number(String(row.start_date ?? row.start_year ?? '').slice(0, 4)),
  endYear: Number(String(row.end_date ?? row.end_year ?? '').slice(0, 4)),
  startDate: row.start_date ? String(row.start_date) : undefined,
  endDate: row.end_date ? String(row.end_date) : undefined,
  placeId: row.place_id ? String(row.place_id) : null,
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
  type: row.type as Annotation['type'],
  polygon: toPoints(row.polygon) ?? [],
  baseline: toPoints(row.baseline),
  readingOrder: Number(row.reading_order ?? 0),
  predictedText: (row.predicted_text ?? undefined) as string | undefined,
  correctedText: (row.corrected_text ?? undefined) as string | undefined,
  confidence: row.confidence as number | undefined,
  status: row.status as Annotation['status'] ?? (row.is_verified ? 'verified' : row.corrected_text ? 'in_review' : 'pending'),
  originalPolygon: toPoints(row.original_polygon),
  originalBaseline: toPoints(row.original_baseline),
  regionType: row.region_type as string | undefined,
  suggestedType: row.suggested_type as string | undefined,
  lineType: row.line_type as string | undefined,
  recordType: row.record_type as string | undefined,
  recordLabel: row.record_label as string | undefined,
  displayLabel: row.display_label as string | undefined,
  completeness: row.completeness as string | undefined,
  tokenKind: row.token_kind as string | undefined,
  legibility: row.legibility as string | undefined,
  normalizedText: row.normalized_text as string | undefined,
  recordId: row.record_id ? String(row.record_id) : undefined,
  memberLineIds: Array.isArray(row.member_line_ids) ? row.member_line_ids.map(String) : undefined,
  continuesRecordId: row.continues_record_id ? String(row.continues_record_id) : undefined,
  continuesRegionId: row.continues_region_id ? String(row.continues_region_id) : undefined,
  recordPages: Array.isArray(row.record_pages)
    ? (row.record_pages as Record<string, unknown>[]).map(page => ({
        pageId: String(page.page_id),
        pageNumber: page.page_number == null ? undefined : Number(page.page_number),
        filename: page.filename == null ? undefined : String(page.filename),
        regionId: page.region_id == null ? undefined : String(page.region_id),
        fragmentOrder: page.fragment_order == null ? undefined : Number(page.fragment_order),
        fragmentRole: page.fragment_role == null ? undefined : String(page.fragment_role),
      }))
    : undefined,
  fragmentOrder: row.fragment_order == null ? undefined : Number(row.fragment_order),
  fragmentRole: row.fragment_role == null ? undefined : String(row.fragment_role),
  scribeId: row.scribe_id ? String(row.scribe_id) : null,
  scribeRole: (row.scribe_role as string | null) ?? null,
})

export interface SegmentResult { lines: number, regions: number, records: number, words?: number, ocr?: boolean }

// Projeção "wire" da anotação: exatamente os campos que o PUT persiste.
// Usada tanto no payload quanto no fingerprint/contagem de pendências —
// campos voláteis de UI (displayLabel, memberLineIds…) ficam de fora.
export const annotationWire = (annotation: Annotation) => ({
  id: annotation.id, type: annotation.type, parent_id: annotation.parentId ?? null,
  reading_order: annotation.readingOrder,
  polygon: annotation.polygon.map(point => [point.x, point.y]),
  baseline: annotation.baseline?.map(point => [point.x, point.y]) ?? null,
  predicted_text: annotation.predictedText ?? null,
  corrected_text: annotation.correctedText ?? null,
  confidence: annotation.confidence ?? null,
  is_verified: annotation.status === 'verified',
  region_type: annotation.regionType ?? '',
  line_type: annotation.lineType ?? null,
  record_type: annotation.recordType ?? null,
  record_label: annotation.recordLabel ?? null,
  completeness: annotation.completeness ?? null,
  token_kind: annotation.tokenKind ?? null,
  legibility: annotation.legibility ?? null,
  normalized_text: annotation.normalizedText ?? null,
  continues_record_id: annotation.continuesRecordId ?? null,
  continues_region_id: annotation.continuesRegionId ?? null,
  fragment_order: annotation.fragmentOrder ?? null,
  fragment_role: annotation.fragmentRole ?? null,
  scribe_id: annotation.scribeId ?? null,
  scribe_role: annotation.scribeRole ?? null,
  record_id: annotation.recordId ?? null,
})

// Remove o que o backend não conseguiria persistir e quebraria o PUT
// inteiro (FK de parent, polígono vazio, id duplicado):
// - word exige parent_id de uma line presente no payload;
// - line/region só aceitam parent_id de region/record presente;
// - anotação sem polígono não tem geometria para gravar.
const sanitizeAnnotations = (annotations: Annotation[]): Annotation[] => {
  const lineIds = new Set(annotations.filter(a => a.type === 'line').map(a => a.id))
  const containerIds = new Set(
    annotations.filter(a => a.type === 'region' || a.type === 'record').map(a => a.id))
  const seen = new Set<string>()
  const out: Annotation[] = []
  for (const annotation of annotations) {
    // 'record' pode vir sem polígono (membros noutros captures) — o backend
    // faz fallback para a geometria gravada; descartá-lo aqui apagaria o assento.
    if (seen.has(annotation.id)
        || (!annotation.polygon?.length && annotation.type !== 'record')) continue
    let parentId = annotation.parentId
    if (annotation.type === 'word') {
      if (!parentId || !lineIds.has(parentId)) continue
    } else if (parentId && !containerIds.has(parentId)) {
      parentId = undefined
    }
    seen.add(annotation.id)
    out.push(parentId === annotation.parentId ? annotation : { ...annotation, parentId })
  }
  return out
}

export const apiDataService: DataService & {
  getWorkspace(): Promise<Workspace>
  segmentPage(pageId: string): Promise<SegmentResult>
  getSegmentStatus(pageId: string): Promise<SegmentProgress>
  patchRegionFragment(regionId: string, patch: { fragmentOrder?: number; fragmentRole?: string }): Promise<unknown>
  getMapStats(): Promise<MapStats>
  listPlaces(query?: string, kind?: string, limit?: number): Promise<Place[]>
  createPlace(input: Partial<Place>): Promise<Place>
  updatePlace(id: string, input: Partial<Place>): Promise<Place>
  listScribes(query?: string): Promise<Scribe[]>
  createScribe(input: Partial<Scribe>): Promise<Scribe>
  updateScribe(id: string, input: Partial<Scribe>): Promise<Scribe>
  updateDocument(id: string, input: { scribeId?: string | null; scribeIds?: string[] }): Promise<Document>
  updateRecord(recordId: string, input: { scribeId?: string | null }): Promise<unknown>
  listPersons(params?: { q?: string; placeId?: string; year?: number }): Promise<PersonSummary[]>
  getPersonStats(): Promise<PersonStats>
  getPersonTimeline(from: number, to: number, placeId?: string, q?: string): Promise<PersonTimeline>
  getPerson(personId: string): Promise<PersonDetail>
  getPersonMapStats(): Promise<PersonMapStats>
  rescorePage(pageId: string): Promise<{ lines: number; suggestions: number; auto_applied: number; detail?: string }>
  listPageSuggestions(pageId: string): Promise<LexiconSuggestion[]>
  acceptSuggestion(id: string): Promise<LexiconSuggestion>
  rejectSuggestion(id: string): Promise<LexiconSuggestion>
  rebuildLexicon(): Promise<{ terms: number; sources: number }>
  getLexiconStats(): Promise<LexiconStats>
  getDashboardStats(): Promise<DashboardStats>
  getDocumentScribeMap(documentId: string): Promise<ScribeMapEntry[]>
} = {
  async segmentPage(pageId) {
    return api(`/pages/${pageId}/segment`, { method: 'POST' })
  },
  async getSegmentStatus(pageId) {
    return api(`/pages/${pageId}/segment-status`)
  },
  async listDocumentRecords(documentId) {
    return (await api(`/documents/${documentId}/records`)).map((row: Record<string, unknown>) => ({
      id: String(row.id), recordType: String(row.record_type ?? 'other'),
      recordLabel: row.record_label as string | undefined,
      displayLabel: row.display_label as string | undefined,
      completeness: row.completeness as string | undefined,
      seq: row.seq as number | undefined,
      preview: row.preview && typeof row.preview === 'object'
        ? {
            pageId: String((row.preview as Record<string, unknown>).page_id),
            pageNumber: (row.preview as Record<string, unknown>).page_number == null
              ? undefined : Number((row.preview as Record<string, unknown>).page_number),
            polygon: (row.preview as Record<string, unknown>).polygon,
          }
        : undefined,
    }))
  },
  async patchRegionFragment(regionId: string, patch: { fragmentOrder?: number; fragmentRole?: string }) {
    const body: Record<string, unknown> = {}
    if (patch.fragmentOrder !== undefined) body.fragment_order = patch.fragmentOrder
    if (patch.fragmentRole !== undefined) body.fragment_role = patch.fragmentRole || null
    return api(`/pages/regions/${regionId}/fragment`, { method: 'PATCH', body: JSON.stringify(body) })
  },
  async getWorkspace() {
    const data = await api('/workspace')
    return {
      collections: data.collections.map(toCollection),
      documents: data.documents.map(toDocument),
      pages: data.pages.map(toPage),
    }
  },
  async updateCollection(id: string, input: Partial<CreateCollectionInput>) {
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = input.title
    if (input.recordType !== undefined) body.book_type = input.recordType
    if (input.startDate !== undefined) body.start_date = input.startDate
    if (input.endDate !== undefined) body.end_date = input.endDate
    if (input.placeId !== undefined) body.place_id = input.placeId
    if (input.parish !== undefined) body.parish = input.parish
    if (input.municipality !== undefined) body.municipality = input.municipality
    if (input.district !== undefined) body.district = input.district
    if (input.sourceUrl !== undefined) body.source_url = input.sourceUrl
    if (input.notes !== undefined) body.reuse_notes = input.notes
    return toCollection(await api(`/collections/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }))
  },
  async createCollection(input) {
    return toCollection(await api('/collections', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        book_type: input.recordType,
        start_date: input.startDate,
        end_date: input.endDate,
        place_id: input.placeId ?? null,
        parish: input.parish,
        municipality: input.municipality,
        district: input.district,
        source_url: input.sourceUrl,
        reuse_notes: input.notes,
      }),
    }))
  },
  async createDocument(input) {
    return toDocument(await api('/documents', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collection_id: input.collectionId, title: input.title,
        record_type: input.recordType, start_year: input.startYear, end_year: input.endYear,
        archival_reference: input.archivalReference || null, source_url: input.sourceUrl || null,
        scribe_id: input.scribeId || null,
        scribe_ids: input.scribeIds ?? (input.scribeId ? [input.scribeId] : []) }) }))
  },
  async listPages(documentId) { return (await api(`/documents/${documentId}/pages`)).map(toPage) },
  async getPage(pageId) { return toPage(await api(`/pages/${pageId}`)) },
  async importImages(documentId, files) {
    const pages: Page[] = []
    const existing = await this.listPages(documentId)
    const nextNumber = existing.reduce((max, page) => Math.max(max, page.pageNumber), 0) + 1
    // Ordem do catálogo: nome do arquivo com comparação numérica (m0001, m0002, ...).
    const ordered = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    for (const [index, file] of ordered.entries()) {
      const form = new FormData()
      form.append('document_id', documentId)
      form.append('page_number', String(nextNumber + index))
      form.append('file', file)
      pages.push(toPage(await api('/pages/import', { method: 'POST', body: form })))
    }
    return pages
  },
  async listAnnotations(pageId) {
    return (await api(`/pages/${pageId}/annotations`)).map(toAnnotation)
  },
  async listPageSummary(): Promise<PageSummary[]> {
    return api('/pages/summary')
  },
  async getMapStats(): Promise<MapStats> {
    return api('/map/stats')
  },
  async listPlaces(query = '', kind = '', limit = 200): Promise<Place[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (query) params.set('q', query)
    if (kind) params.set('kind', kind)
    return (await api(`/places?${params}`)).map((row: Record<string, unknown>) => ({
      id: String(row.id), name: String(row.name), kind: String(row.kind ?? 'lugar'),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      parent_name: row.parent_name ? String(row.parent_name) : null,
      concelho_name: (row.concelho_name as string) ?? null,
      distrito_name: (row.distrito_name as string) ?? null,
      freguesia_code: (row.freguesia_code as string) ?? null,
      concelho_code: (row.concelho_code as string) ?? null,
      distrito_code: (row.distrito_code as string) ?? null,
      aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
      valid_from: (row.valid_from as string) ?? null,
      valid_to: (row.valid_to as string) ?? null,
      notes: (row.notes as string) ?? null,
    }))
  },
  async createPlace(input) {
    return (await api('/places', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })) as Place
  },
  async updatePlace(id, input) {
    return (await api(`/places/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })) as Place
  },
  async listScribes(query = ''): Promise<Scribe[]> {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    return (await api(`/scribes?${params}`)).map((row: Record<string, unknown>) => ({
      id: String(row.id), name: String(row.name),
      aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
      notes: (row.notes as string) ?? null,
      active_from: (row.active_from as string) ?? null,
      active_to: (row.active_to as string) ?? null,
      document_count: Number(row.document_count ?? 0),
    }))
  },
  async createScribe(input) {
    return (await api('/scribes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })) as Scribe
  },
  async updateScribe(id, input) {
    return (await api(`/scribes/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })) as Scribe
  },
  async updateDocument(id, input) {
    return toDocument(await api(`/documents/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.scribeIds
        ? { scribe_ids: input.scribeIds }
        : { scribe_id: input.scribeId ?? null }),
    }))
  },
  async getRecord(recordId: string): Promise<RecordDetail> {
    return api(`/records/${recordId}`)
  },
  async listPersons(params?: { q?: string; placeId?: string; year?: number }): Promise<PersonSummary[]> {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.placeId) search.set('place_id', params.placeId)
    if (params?.year != null) search.set('year', String(params.year))
    const suffix = search.size ? `?${search}` : ''
    return api(`/persons${suffix}`)
  },
  async getPersonStats(): Promise<PersonStats> {
    return api('/persons/stats')
  },
  async getPersonTimeline(from: number, to: number, placeId?: string, q?: string): Promise<PersonTimeline> {
    const search = new URLSearchParams({ from: String(from), to: String(to) })
    if (placeId) search.set('place_id', placeId)
    if (q) search.set('q', q)
    return api(`/persons/timeline?${search}`)
  },
  async getPerson(personId: string): Promise<PersonDetail> {
    return api(`/persons/${personId}`)
  },
  async getPersonMapStats(): Promise<PersonMapStats> {
    return api('/map/person-stats')
  },
  async updateRecord(recordId, input) {
    return api(`/records/${recordId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scribe_id: input.scribeId ?? null }),
    })
  },
  async saveRecordContent(recordId: string, fields: Record<string, unknown>, markVerified = false) {
    return api(`/records/${recordId}/content`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields, mark_verified: markVerified }),
    })
  },
  async saveRecordMentions(recordId: string, mentions: Omit<RecordMention, 'id' | 'record_id'>[], markVerified = false) {
    return api(`/records/${recordId}/mentions`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mentions, mark_verified: markVerified }),
    })
  },
  async saveAnnotations(pageId, annotations) {
    const rows = await api(`/pages/${pageId}/annotations`, { method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sanitizeAnnotations(annotations).map(annotationWire)) })
    return rows.map(toAnnotation)
  },
  async rescorePage(pageId) {
    return api(`/pages/${pageId}/rescore`, { method: 'POST' })
  },
  async listPageSuggestions(pageId) {
    return api(`/pages/${pageId}/suggestions`)
  },
  async acceptSuggestion(id) {
    return api(`/pages/suggestions/${id}/accept`, { method: 'POST' })
  },
  async rejectSuggestion(id) {
    return api(`/pages/suggestions/${id}/reject`, { method: 'POST' })
  },
  async rebuildLexicon() {
    return api('/lexicon/rebuild', { method: 'POST' })
  },
  async getLexiconStats() {
    return api('/lexicon/stats')
  },
  async getDashboardStats() {
    return api('/stats/dashboard')
  },
  async getDocumentScribeMap(documentId) {
    return api(`/documents/${documentId}/scribe-map`)
  },
}
