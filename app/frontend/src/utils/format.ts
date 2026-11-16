import type { Annotation, AnnotationType, ProcessingStatus, RecordType, VerificationStatus } from '../types/domain'

export const recordTypeLabels: Record<RecordType, string> = {
  batismo: 'Batismos',
  casamento: 'Casamentos',
  obito: 'Óbitos',
}

export const processingStatusLabels: Record<ProcessingStatus, string> = {
  imported: 'Importada',
  processing: 'Processando',
  annotated: 'Anotada',
  reviewed: 'Revisada',
  error: 'Com erro',
}

export const verificationStatusLabels: Record<VerificationStatus, string> = {
  pending: 'Pendente',
  in_review: 'Em revisão',
  verified: 'Verificada',
}

export const annotationTypeLabels: Record<AnnotationType, string> = {
  record: 'Registro',
  region: 'Região',
  line: 'Linha',
  word: 'Palavra',
}

export const regionTypeLabels: Record<string, string> = {
  // Vocabulário legado (region_types legada)
  MainZone: 'Corpo do texto',
  MarginTextZone: 'Nota à margem',
  RunningTitleZone: 'Título corrente',
  TitlePageZone: 'Folha de título',
  NumberingZone: 'Numeração',
  StampZone: 'Carimbo',
  SealZone: 'Selo',
  GraphicZone: 'Imagem/desenho',
  DamageZone: 'Dano físico',
  DigitizationArtefactZone: 'Defeito de digitalização',
  DropCapitalZone: 'Capital ornamentada',
  QuireMarksZone: 'Reclamos',
  TableZone: 'Tabela/índice',
  // Vocabulário novo (região → sub-região)
  page_number: 'Número da página',
  prefatory_note: 'Nota prefacial',
  seal: 'Selo',
  stamp: 'Carimbo',
  record: 'Registro',
  main_text: 'Parágrafo principal',
  header: 'Cabeçalho',
  footer: 'Rodapé',
  margin_note: 'Anotação lateral',
  signature: 'Assinatura',
  unclassified: 'Não classificada',
}

export const lineTypeLabels: Record<string, string> = {
  DefaultLine: 'Linha comum',
  HeadingLine: 'Título',
  InterlinearLine: 'Entrelinha',
  SignatureLine: 'Assinatura',
  DropCapitalLine: 'Capital',
}

export const recordTypeOntologyLabels: Record<string, string> = {
  baptism: 'Batismo', marriage: 'Casamento', death: 'Óbito',
  term: 'Termo', index: 'Índice', other: 'Registro',
}

export function annotationDisplayLabel(annotation: Annotation): string {
  if (annotation.type === 'region') {
    const key = annotation.regionType?.trim()
    return (key && regionTypeLabels[key]) || key || 'Região'
  }
  if (annotation.type === 'line' && annotation.lineType && annotation.lineType !== 'DefaultLine') {
    return lineTypeLabels[annotation.lineType] ?? annotation.lineType
  }
  if (annotation.type === 'record') {
    return annotation.displayLabel
      ?? recordTypeOntologyLabels[annotation.recordType ?? 'other']
      ?? 'Registro'
  }
  return annotationTypeLabels[annotation.type]
}

export const formatBytes = (bytes: number) => {
  const megabytes = bytes / 1024 / 1024
  return `${megabytes.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MB`
}

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
