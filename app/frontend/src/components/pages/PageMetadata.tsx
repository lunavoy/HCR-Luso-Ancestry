import { FileImage, Hash, Maximize2, RotateCw } from 'lucide-react'
import type { Page } from '../../types/domain'
import { formatBytes, formatDate } from '../../utils/format'
import { StatusBadge } from '../ui/StatusBadge'

export function PageMetadata({ page }: { page: Page }) {
  return (
    <dl className="page-metadata">
      <div><dt><FileImage size={14} /> Ficheiro</dt><dd>{page.originalFilename}</dd></div>
      <div><dt><Hash size={14} /> Página</dt><dd>{page.pageNumber}</dd></div>
      <div><dt><Maximize2 size={14} /> Dimensões</dt><dd>{page.width} × {page.height} px</dd></div>
      <div><dt><RotateCw size={14} /> Rotação</dt><dd>{page.rotation}°</dd></div>
      <div><dt>Tamanho</dt><dd>{formatBytes(page.fileSize)}</dd></div>
      <div><dt>Importada</dt><dd>{formatDate(page.importedAt)}</dd></div>
      <div><dt>Estado</dt><dd><StatusBadge status={page.status} /></dd></div>
    </dl>
  )
}
