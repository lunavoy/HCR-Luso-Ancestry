import { CheckCircle2, Sparkles } from 'lucide-react'
import type { Annotation, Page, VerificationStatus } from '../../types/domain'
import { polygonBounds } from '../../utils/geometry'

export function TranscriptionEditor({ page, annotation, onChange, onStatus }: {
  page: Page
  annotation: Annotation
  onChange: (text: string) => void
  onStatus: (status: VerificationStatus) => void
}) {
  const bounds = polygonBounds(annotation.polygon)
  const canTranscribe = annotation.type === 'line' || annotation.type === 'word'

  if (!canTranscribe) {
    return (
      <div className="transcription-empty">
        <Sparkles size={18} />
        <p>Selecione uma linha ou palavra para editar a transcrição.</p>
      </div>
    )
  }

  return (
    <div className="transcription-editor">
      <div className="line-crop" style={{ aspectRatio: `${Math.max(bounds.width, 1)} / ${Math.max(bounds.height, 1)}` }}>
        <img
          alt="Recorte ampliado da linha selecionada"
          src={page.imageUrl}
          style={{
            left: `${-(bounds.x / Math.max(bounds.width, 1)) * 100}%`,
            top: `${-(bounds.y / Math.max(bounds.height, 1)) * 100}%`,
            width: `${(page.width / Math.max(bounds.width, 1)) * 100}%`,
          }}
        />
      </div>
      <div className="confidence-row"><span><Sparkles size={14} /> Reconhecimento automático</span><strong>{annotation.confidence ? `${Math.round(annotation.confidence * 100)}%` : '—'}</strong></div>
      <p className="predicted-text">{annotation.predictedText || 'Sem texto reconhecido.'}</p>
      <label className="transcription-field">
        <span>Transcrição corrigida</span>
        <textarea
          onChange={event => onChange(event.target.value)}
          placeholder="Transcreva exatamente como aparece no documento…"
          rows={5}
          spellCheck={false}
          value={annotation.correctedText ?? ''}
        />
        <small>Grafia histórica, abreviaturas e acentuação são preservadas.</small>
      </label>
      <div className="review-actions">
        <label><span>Estado de revisão</span><select onChange={event => onStatus(event.target.value as VerificationStatus)} value={annotation.status}><option value="pending">Pendente</option><option value="in_review">Em revisão</option><option value="verified">Verificada</option></select></label>
        <button className="verify-button" onClick={() => onStatus('verified')} type="button"><CheckCircle2 size={15} /> Marcar revista</button>
      </div>
    </div>
  )
}
