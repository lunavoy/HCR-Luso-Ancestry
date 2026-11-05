import type { AnnotationType, ProcessingStatus, RecordType, VerificationStatus } from '../types/domain'

export const recordTypeLabels: Record<RecordType, string> = {
  batismo: 'Batismos',
  casamento: 'Casamentos',
  obito: 'Óbitos',
}

export const processingStatusLabels: Record<ProcessingStatus, string> = {
  imported: 'Importada',
  unannotated: 'Não anotada',
  partial: 'Parcial',
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

export const formatBytes = (bytes: number) => {
  const megabytes = bytes / 1024 / 1024
  return `${megabytes.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MB`
}

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
