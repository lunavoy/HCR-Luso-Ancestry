export type RecordType = 'batismo' | 'casamento' | 'obito'
export type ProcessingStatus = 'imported' | 'processing' | 'annotated' | 'reviewed' | 'error'
export type VerificationStatus = 'pending' | 'in_review' | 'verified'
export type AnnotationType = 'record' | 'region' | 'line' | 'word'

export interface Point {
  x: number
  y: number
}

export interface Collection {
  id: string
  title: string
  recordType: RecordType
  startYear: number
  endYear: number
  startDate?: string
  endDate?: string
  placeId?: string | null
  parish: string
  municipality: string
  district: string
  notes: string
  sourceUrl: string
  documentIds: string[]
  pageCount: number
  updatedAt: string
}

export interface Scribe {
  id: string
  name: string
  aliases?: string[]
  notes?: string | null
  active_from?: string | null
  active_to?: string | null
  document_count?: number
}

export interface Document {
  id: string
  collectionId: string
  title: string
  recordType: RecordType
  startYear: number
  endYear: number
  archivalReference: string
  sourceUrl: string
  scribeId?: string | null
  scribes?: { id: string; name: string; is_primary?: boolean }[]
  pageIds: string[]
  status: ProcessingStatus
}

export interface Page {
  id: string
  documentId: string
  pageNumber: number
  originalFilename: string
  imageUrl: string
  width: number
  height: number
  fileSize: number
  status: ProcessingStatus
  rotation: number
  importedAt: string
}

export interface Annotation {
  id: string
  pageId: string
  parentId?: string
  type: AnnotationType
  polygon: Point[]
  baseline?: Point[]
  readingOrder: number
  predictedText?: string
  correctedText?: string
  confidence?: number
  status: VerificationStatus
  originalPolygon?: Point[]
  originalBaseline?: Point[]
  regionType?: string
  suggestedType?: string
  lineType?: string
  recordType?: string
  recordLabel?: string
  displayLabel?: string
  completeness?: string
  tokenKind?: string
  legibility?: string
  normalizedText?: string
  recordId?: string
  memberLineIds?: string[]
  continuesRecordId?: string
  continuesRegionId?: string
  recordPages?: { pageId: string; pageNumber?: number; filename?: string; regionId?: string; fragmentOrder?: number; fragmentRole?: string }[]
  fragmentOrder?: number
  fragmentRole?: string
  scribeId?: string | null
  scribeRole?: string | null
}

export interface ScribeMapEntry {
  region_id: string
  page_id: string | null
  page_label: string
  kind: string
  label: string
  record_type?: string | null
  scribe_id: string | null
  scribe_name: string | null
  scribe_role: string | null
}

export interface LexiconToken {
  orig: string
  suggestion?: string | null
  score?: number | null
  method?: string
}

export interface LexiconSuggestion {
  id: string
  line_id: string
  original_text: string
  suggested_text?: string | null
  tokens?: LexiconToken[]
  status: 'pending' | 'accepted' | 'rejected' | 'auto_applied'
  created_at?: string
}

export interface LexiconStats {
  total: number
  by_kind: Record<string, number>
  by_source: Record<string, number>
}

export interface DashboardStats {
  lines: { total: number; verified: number; human_origin: number; pending: number }
  words: { total: number; verified: number; human_origin: number; pending: number }
  transcriptions: { total: number; htr: number; human: number; avg_confidence: number | null }
  accuracy: {
    sample_lines: number
    exact_match_rate: number | null
    mean_cer: number | null
    mean_wer: number | null
    char_accuracy: number | null
    word_accuracy: number | null
  }
  suggestions: Record<string, number>
}

export interface DocumentRecord {
  id: string
  recordType: string
  recordLabel?: string
  displayLabel?: string
  completeness?: string
  seq?: number
  preview?: { pageId: string; pageNumber?: number; polygon?: unknown }
}

export interface RecordListItem {
  id: string
  document_id: string
  record_type: string
  record_label?: string
  completeness?: string
  extraction_status?: string
  is_verified: boolean
  document_title?: string
  pages?: { id: string; filename?: string; page_number?: number }[]
  content?: { is_verified: boolean; updated_at: string } | null
}

export interface PageSummary {
  page_id: string
  document_id: string
  document_title?: string
  filename?: string
  page_number?: number
  lines_total: number
  lines_done: number
  words_total: number
  words_done: number
  status: 'complete' | 'in_review' | 'pending'
  records?: { id: string; record_type?: string; record_label?: string; display_label?: string }[]
}

export interface RecordSectionLine {
  line_id: string
  reading_order: number
  text: string
}

export interface RecordSection {
  region_id?: string
  region_type: string
  role: string
  lines: RecordSectionLine[]
  text: string
}

export interface RecordMention {
  id: string
  record_id: string
  group_key: string
  field_name: string
  line_id?: string
  token_start?: number
  token_end?: number
  char_start?: number
  char_end?: number
  text: string
  seq: number
}

export interface MapAreaStat {
  documents: number
  done: number
}

export interface Place {
  id: string
  name: string
  kind: string
  parent_id?: string | null
  parent_name?: string | null
  concelho_name?: string | null
  distrito_name?: string | null
  freguesia_code?: string | null
  concelho_code?: string | null
  distrito_code?: string | null
  aliases?: string[]
  valid_from?: string | null
  valid_to?: string | null
  notes?: string | null
}

export interface SegmentProgress {
  status: 'idle' | 'running' | 'done' | 'error'
  stage?: string
  percent?: number | null
  lines_done?: number | null
  lines_total?: number | null
  detail?: string
  error?: string | null
  updated_at?: string | null
}

export interface MapStats {
  freguesias: Record<string, MapAreaStat>
  concelhos: Record<string, MapAreaStat>
  distritos: Record<string, MapAreaStat>
}

export interface RecordDetail {
  record: {
    id: string
    document_id: string
    record_type: string
    record_label?: string
    display_label?: string
    completeness?: string
    is_verified: boolean
    scribe_id?: string | null
  }
  document?: { id: string; title: string } | null
  content?: Record<string, unknown> | null
  page_ids: string[]
  pages?: { id: string; filename?: string; page_number?: number }[]
  mentions?: RecordMention[]
  transcription: { sections: RecordSection[]; full_text: string }
}

export interface ImportCandidate {
  id: string
  file: File
  previewUrl: string
  width?: number
  height?: number
  error?: string
  progress: number
  state: 'ready' | 'uploading' | 'complete' | 'error'
}

export interface CreateCollectionInput {
  title: string
  recordType: RecordType
  startDate: string
  endDate: string
  parish: string
  municipality: string
  district: string
  placeId?: string | null
  notes: string
  sourceUrl: string
}

export interface CreateDocumentInput {
  collectionId: string
  title: string
  recordType: RecordType
  startYear: number
  endYear: number
  archivalReference: string
  sourceUrl: string
  scribeId?: string | null
  scribeIds?: string[]
}

// ---------------------------------------------------------------------------
// Timeline / Pessoas
// ---------------------------------------------------------------------------

export type PersonStatus = 'vivo' | 'presumido' | 'falecido' | 'desconhecido'

export interface PersonAppearance {
  mention_id: string
  record_id?: string
  name_as_written?: string
  role?: string
  role_label: string
  record_type?: string
  record_type_label: string
  is_verified: boolean
  event_date?: string
  event_year?: number
  place?: string
  parish?: string
  parish_id?: string
  display_label?: string
  pages: { id: string; filename?: string; page_number?: number }[]
}

export interface PersonSummary {
  id: string
  name?: string
  birth_date?: string
  death_date?: string
  birth_year?: number
  death_year?: number
  birth_place?: string
  birth_place_id?: string
  birth_place_name?: string
  notes?: string
  lifespan_start?: number | null
  lifespan_end?: number | null
  lifespan_estimated: boolean
  appearances_count: number
  status: PersonStatus
}

export interface PersonEvent {
  kind: 'birth' | 'death' | 'appearance'
  label: string
  date?: string
  year?: number
  place?: string
  record_id?: string
  display_label?: string
  pages?: { id: string; filename?: string; page_number?: number }[]
  name_as_written?: string
  is_verified?: boolean
}

export interface PersonDetail extends PersonSummary {
  events: PersonEvent[]
  appearances: PersonAppearance[]
}

export interface PersonTimelineEvent {
  year?: number
  role?: string
  role_label?: string
  record_type_label?: string
  place?: string
  record_id?: string
  display_label?: string
}

export interface PersonLane extends PersonSummary {
  events: PersonTimelineEvent[]
}

export interface PersonTimeline {
  from: number
  to: number
  persons: PersonLane[]
}

export interface PersonStats {
  persons: number
  with_birth: number
  with_death: number
  documented_events: number
  estimated_note?: string
}

export interface PersonAreaStat {
  persons: number
  events: number
}

export interface PersonMapStats {
  freguesias: Record<string, PersonAreaStat>
  concelhos: Record<string, PersonAreaStat>
  distritos: Record<string, PersonAreaStat>
}
