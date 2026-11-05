import type { Annotation, Collection, Document, Page, ProcessingStatus } from '../types/domain'

export const demoCollection: Collection = {
  id: 'collection-tinhela',
  title: 'Livro de Batismos (1900–1910) - Tinhela, Valpaços, Vila Real',
  recordType: 'batismo',
  startYear: 1900,
  endYear: 1910,
  parish: 'Tinhela',
  municipality: 'Valpaços',
  district: 'Vila Real',
  notes: 'Coleção de demonstração para o fluxo de descrição, transcrição e treino HTR.',
  sourceUrl: 'https://digitarq.advr.arquivos.pt/',
  documentIds: ['book-1900', 'book-1901', 'book-1902', 'book-1903', 'book-1910'],
  pageCount: 15,
  updatedAt: '2026-10-28T14:30:00.000Z',
}

const years = [1900, 1901, 1902, 1903, 1910]

export const mockDocuments: Document[] = years.map((year, index) => ({
  id: `book-${year}`,
  collectionId: demoCollection.id,
  title: `Batismos de ${year}`,
  recordType: 'batismo',
  startYear: year,
  endYear: year,
  archivalReference: `PT/ADVRL/PRQ/PVLP26/001/${String(76 + index).padStart(3, '0')}`,
  sourceUrl: 'https://digitarq.advr.arquivos.pt/',
  pageIds: Array.from({ length: 3 }, (_, pageIndex) => `page-${year}-${pageIndex + 1}`),
  status: index === 0 ? 'partial' : index === 1 ? 'reviewed' : 'imported',
}))

const statusSequence: ProcessingStatus[] = [
  'partial', 'reviewed', 'unannotated', 'imported', 'error',
  'partial', 'reviewed', 'unannotated', 'imported', 'partial',
  'reviewed', 'unannotated', 'imported', 'partial', 'unannotated',
]

export const mockPages: Page[] = years.flatMap((year, yearIndex) =>
  Array.from({ length: 3 }, (_, pageIndex) => {
    const sequence = yearIndex * 3 + pageIndex
    return {
      id: `page-${year}-${pageIndex + 1}`,
      documentId: `book-${year}`,
      pageNumber: pageIndex + 1,
      originalFilename: `PT-ADVRL-PRQ-PVLP26-001-${String(76 + yearIndex).padStart(3, '0')}_m${String(pageIndex + 4).padStart(4, '0')}.jpg`,
      imageUrl: '/document-placeholder.svg',
      width: 1200,
      height: 1600,
      fileSize: 7_250_000 + sequence * 134_000,
      status: statusSequence[sequence],
      rotation: 0,
      importedAt: new Date(Date.UTC(2026, 9, 12 + sequence)).toISOString(),
    }
  }),
)

const firstPageId = mockPages[0].id

export const mockAnnotations: Annotation[] = [
  {
    id: 'record-001',
    pageId: firstPageId,
    type: 'record',
    polygon: [{ x: 108, y: 228 }, { x: 1090, y: 218 }, { x: 1084, y: 1040 }, { x: 120, y: 1052 }],
    readingOrder: 1,
    status: 'in_review',
  },
  {
    id: 'region-001',
    pageId: firstPageId,
    parentId: 'record-001',
    type: 'region',
    polygon: [{ x: 148, y: 320 }, { x: 1040, y: 314 }, { x: 1028, y: 786 }, { x: 154, y: 798 }],
    readingOrder: 1,
    status: 'in_review',
  },
  {
    id: 'line-001',
    pageId: firstPageId,
    parentId: 'region-001',
    type: 'line',
    polygon: [{ x: 172, y: 350 }, { x: 1004, y: 342 }, { x: 1000, y: 420 }, { x: 176, y: 430 }],
    baseline: [{ x: 182, y: 406 }, { x: 992, y: 397 }],
    readingOrder: 1,
    predictedText: 'Aos vinte e tres dias do mez de Janeiro',
    correctedText: 'Aos vinte e três dias do mez de Janeiro',
    confidence: 0.91,
    status: 'verified',
  },
  {
    id: 'word-001',
    pageId: firstPageId,
    parentId: 'line-001',
    type: 'word',
    polygon: [{ x: 176, y: 350 }, { x: 310, y: 348 }, { x: 308, y: 426 }, { x: 178, y: 428 }],
    readingOrder: 1,
    predictedText: 'Aos vinte',
    correctedText: 'Aos vinte',
    confidence: 0.96,
    status: 'verified',
  },
  {
    id: 'line-002',
    pageId: firstPageId,
    parentId: 'region-001',
    type: 'line',
    polygon: [{ x: 166, y: 452 }, { x: 1020, y: 444 }, { x: 1014, y: 526 }, { x: 170, y: 532 }],
    baseline: [{ x: 178, y: 510 }, { x: 1004, y: 500 }],
    readingOrder: 2,
    predictedText: 'de mil novecentos nesta freguezia de Tinhela',
    correctedText: 'de mil novecentos nesta freguezia de Tinhela',
    confidence: 0.86,
    status: 'in_review',
  },
  {
    id: 'line-003',
    pageId: firstPageId,
    parentId: 'region-001',
    type: 'line',
    polygon: [{ x: 170, y: 554 }, { x: 1012, y: 548 }, { x: 1008, y: 634 }, { x: 174, y: 640 }],
    baseline: [{ x: 180, y: 616 }, { x: 996, y: 606 }],
    readingOrder: 3,
    predictedText: 'baptizei solemnemente a Maria filha legitima',
    correctedText: '',
    confidence: 0.74,
    status: 'pending',
  },
]

export const mockCollections = [demoCollection]
