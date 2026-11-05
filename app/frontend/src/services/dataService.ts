import { demoCollection, mockAnnotations, mockCollections, mockDocuments, mockPages } from '../mocks/data'
import type {
  Annotation,
  Collection,
  CreateCollectionInput,
  CreateDocumentInput,
  Document,
  Page,
} from '../types/domain'

const wait = (duration = 120) => new Promise(resolve => window.setTimeout(resolve, duration))

export interface DataService {
  listCollections(): Promise<Collection[]>
  createCollection(input: CreateCollectionInput): Promise<Collection>
  listDocuments(collectionId: string): Promise<Document[]>
  createDocument(input: CreateDocumentInput): Promise<Document>
  listPages(documentId: string): Promise<Page[]>
  importImages(documentId: string, files: File[]): Promise<Page[]>
  getPage(pageId: string): Promise<Page | undefined>
  saveAnnotations(pageId: string, annotations: Annotation[]): Promise<Annotation[]>
  updateTranscription(annotationId: string, text: string): Promise<Annotation>
}

export const mockDataService: DataService = {
  async listCollections() {
    await wait()
    return structuredClone(mockCollections)
  },
  async createCollection(input) {
    await wait()
    return {
      ...input,
      id: `collection-${crypto.randomUUID()}`,
      documentIds: [],
      pageCount: 0,
      updatedAt: new Date().toISOString(),
    }
  },
  async listDocuments(collectionId) {
    await wait()
    return structuredClone(mockDocuments.filter(document => document.collectionId === collectionId))
  },
  async createDocument(input) {
    await wait()
    return {
      ...input,
      id: `document-${crypto.randomUUID()}`,
      pageIds: [],
      status: 'imported',
    }
  },
  async listPages(documentId) {
    await wait()
    return structuredClone(mockPages.filter(page => page.documentId === documentId))
  },
  async importImages(documentId, files) {
    await wait(600)
    return files.map((file, index) => ({
      id: `page-${crypto.randomUUID()}`,
      documentId,
      pageNumber: mockPages.filter(page => page.documentId === documentId).length + index + 1,
      originalFilename: file.name,
      imageUrl: URL.createObjectURL(file),
      width: 1200,
      height: 1600,
      fileSize: file.size,
      status: 'imported',
      rotation: 0,
      importedAt: new Date().toISOString(),
    }))
  },
  async getPage(pageId) {
    await wait()
    return structuredClone(mockPages.find(page => page.id === pageId))
  },
  async saveAnnotations(_pageId, annotations) {
    await wait(240)
    return structuredClone(annotations)
  },
  async updateTranscription(annotationId, text) {
    await wait()
    const annotation = mockAnnotations.find(item => item.id === annotationId) ?? mockAnnotations[2]
    return { ...structuredClone(annotation), correctedText: text, status: 'in_review' }
  },
}

export const initialData = {
  collections: [demoCollection],
  documents: mockDocuments,
  pages: mockPages,
  annotations: mockAnnotations,
}
