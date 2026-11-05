import { ChevronLeft, ChevronRight, PanelLeftClose } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Page } from '../../types/domain'
import { StatusBadge } from '../ui/StatusBadge'

export function PageThumbnails({ pages, activePageId, onCollapse }: {
  pages: Page[]
  activePageId: string
  onCollapse: () => void
}) {
  const navigate = useNavigate()
  const activeIndex = pages.findIndex(page => page.id === activePageId)
  const go = (index: number) => pages[index] && navigate(`/viewer/${pages[index].id}`)

  return (
    <aside className="page-thumbnails">
      <div className="panel-header">
        <div><strong>Páginas</strong><span>{pages.length} imagens</span></div>
        <button className="icon-button always-visible bare" onClick={onCollapse} title="Recolher páginas" type="button"><PanelLeftClose size={17} /></button>
      </div>
      <div className="thumbnail-nav">
        <button disabled={activeIndex <= 0} onClick={() => go(activeIndex - 1)} type="button"><ChevronLeft size={16} /> Anterior</button>
        <span>{activeIndex + 1} / {pages.length}</span>
        <button disabled={activeIndex >= pages.length - 1} onClick={() => go(activeIndex + 1)} type="button">Seguinte <ChevronRight size={16} /></button>
      </div>
      <div className="thumbnail-list">
        {pages.map(page => (
          <button className={`thumbnail-item ${page.id === activePageId ? 'is-active' : ''}`} key={page.id} onClick={() => navigate(`/viewer/${page.id}`)} type="button">
            <div className="thumbnail-image"><img src={page.imageUrl} alt="" /><span>{String(page.pageNumber).padStart(2, '0')}</span></div>
            <div className="thumbnail-info"><strong>{page.originalFilename}</strong><StatusBadge status={page.status} /></div>
          </button>
        ))}
      </div>
    </aside>
  )
}
