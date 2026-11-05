export type RecordType = 'batismo' | 'casamento' | 'obito'
export type ProcessingStatus = 'imported' | 'unannotated' | 'partial' | 'reviewed' | 'error'
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
  parish: string
  municipality: string
  district: string
  notes: string
  sourceUrl: string
  documentIds: string[]
  pageCount: number
  updatedAt: string
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
  startYear: number
  endYear: number
  parish: string
  municipality: string
  district: string
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
}
