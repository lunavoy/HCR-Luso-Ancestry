import { CheckCircle2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiDataService } from '../../services/dataService'
import type { Annotation, DocumentRecord, Page, Scribe, VerificationStatus } from '../../types/domain'
import { polygonBounds } from '../../utils/geometry'
import { recordTypeOntologyLabels, regionTypeLabels } from '../../utils/format'
import { regionColor } from '../../utils/regionColors'

const REGION_TYPES = Object.keys(regionTypeLabels)

const FRAGMENT_ROLES: Record<string, string> = {
  start: 'Parte inicial',
  continuation: 'Continuação',
  end: 'Parte final',
}

const SCRIBE_ROLES = ['Paróco', 'Presbítero', 'Escrivão', 'Oficial do registo', 'Governador civil', 'Capelão', 'Coadjutor']

function ScribeFields({ annotation, onScribeChange }: {
  annotation: Annotation
  onScribeChange?: (scribeId: string | null, role: string) => void
}) {
  const [scribes, setScribes] = useState<Scribe[]>([])
  useEffect(() => {
    apiDataService.listScribes().then(setScribes).catch(() => {})
  }, [])
  if (!onScribeChange) return null
  return (
    <>
      <label className="transcription-field">
        <span>Escriba</span>
        <select
          onChange={event => onScribeChange(event.target.value || null, annotation.scribeRole ?? '')}
          value={annotation.scribeId ?? ''}
        >
          <option value="">— não atribuído —</option>
          {scribes.map(scribe => <option key={scribe.id} value={scribe.id}>{scribe.name}</option>)}
        </select>
        <small>Quem escreveu esta região — base para treinar a IA por mão de escrita.</small>
      </label>
      <label className="transcription-field">
        <span>Função</span>
        <input
          list="scribe-role-suggestions"
          onChange={event => onScribeChange(annotation.scribeId ?? null, event.target.value)}
          onBlur={event => onScribeChange(annotation.scribeId ?? null, event.target.value.trim())}
          placeholder="Ex.: Paróco"
          spellCheck={false}
          value={annotation.scribeRole ?? ''}
        />
        <datalist id="scribe-role-suggestions">
          {SCRIBE_ROLES.map(role => <option key={role} value={role} />)}
        </datalist>
        <small>O cargo com que o escriba se apresenta nesta região.</small>
      </label>
    </>
  )
}

export function TranscriptionEditor({ page, annotation, words = [], onChange, onStatus, onRegionType, onRecordType, bookRecordType, onFlush, openRecords = [], onLinkRecord, onScribeChange, onFragmentPatch, onSeparate }: {
  page: Page
  annotation: Annotation
  words?: Annotation[]
  onChange: (text: string) => void
  onStatus: (status: VerificationStatus) => void
  onRegionType?: (regionType: string | undefined) => void
  onRecordType?: (recordType: string) => void
  bookRecordType?: string
  onFlush?: () => void
  openRecords?: DocumentRecord[]
  onLinkRecord?: (continuesId: string | null) => void
  onScribeChange?: (scribeId: string | null, role: string) => void
  onFragmentPatch?: (regionId: string, patch: { fragmentOrder?: number; fragmentRole?: string }) => void
  onSeparate?: () => void
}) {
  const bounds = polygonBounds(annotation.polygon)
  const canTranscribe = annotation.type === 'line' || annotation.type === 'word'
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  useEffect(() => { setShowLinkPicker(false) }, [annotation.id])
  const composedLineText = annotation.type === 'line'
    ? words.map(word => word.correctedText ?? word.predictedText ?? '').join(' ').replace(/\s+/g, ' ').trim()
    : ''

  if (annotation.type === 'region') {
    return (
      <div className="transcription-editor">
        <div className="transcription-empty">
          <Sparkles size={18} />
          <p>Região de layout. A etiqueta da região se edita na aba Transcrição; regiões sem texto (selos, carimbos, danos) não recebem linhas.</p>
        </div>
        <label className="transcription-field">
          <span>Tipo de região</span>
          <span className="region-type-input">
            <i className="region-color-dot" style={{ background: regionColor(annotation.regionType) }} />
            <input
              list="region-type-suggestions"
              onBlur={onFlush}
              onChange={event => onRegionType?.(event.target.value.trim() || undefined)}
              placeholder="Ex.: paragraph, heading, caption…"
              spellCheck={false}
              value={annotation.regionType ?? ''}
            />
          </span>
          <datalist id="region-type-suggestions">
            {REGION_TYPES.map(code => <option key={code} value={code}>{regionTypeLabels[code]}</option>)}
          </datalist>
          <small>Regiões sem texto (selos, carimbos, danos) não recebem linhas.</small>
          {annotation.suggestedType && annotation.suggestedType !== 'MainZone' && (
            <small>Sugestão do segmentador: {annotation.suggestedType}</small>
          )}
        </label>
        <ScribeFields annotation={annotation} onScribeChange={onScribeChange} />
        <div className="review-actions">
          <button className="verify-button" onClick={() => onStatus('verified')} type="button"><CheckCircle2 size={15} /> Marcar revista</button>
        </div>
      </div>
    )
  }

  if (annotation.type === 'record') {
    const continued = Boolean(annotation.continuesRecordId)
    const continueTargets = openRecords.filter(record =>
      record.id !== annotation.id && record.id !== annotation.recordId)
    const fragmentCount = annotation.recordPages?.length ?? 0
    return (
      <div className="transcription-editor">
        <div className="transcription-empty">
          <Sparkles size={18} />
          <p>Assento paroquial: {recordTypeOntologyLabels[annotation.recordType ?? 'other'] ?? annotation.recordType}. Agrupa as linhas do ato (batismo, casamento, óbito…). Se a área não for um assento — número de página, termo de abertura — exclua-a; se for, confirme o tipo.</p>
        </div>
        {fragmentCount > 0 && (
          <div className="transcription-field">
            <span>Este assento aparece em ({fragmentCount} {fragmentCount === 1 ? 'lugar' : 'lugares'})</span>
            <ul className="fragment-list">
              {annotation.recordPages!.map((recordPage, index) => (
                <li key={recordPage.regionId ?? `${recordPage.pageId}-${index}`} className={recordPage.regionId === annotation.id ? 'is-current' : ''}>
                  <Link to={`/viewer/${recordPage.pageId}`}>
                    Pág. {recordPage.pageNumber ?? '?'}
                  </Link>
                  <small>
                    {recordPage.fragmentRole ? FRAGMENT_ROLES[recordPage.fragmentRole] ?? recordPage.fragmentRole : `Parte ${index + 1}`}
                  </small>
                  {onFragmentPatch && recordPage.regionId && fragmentCount > 1 && (
                    <input
                      className="fragment-order-input"
                      min={1}
                      onChange={event => {
                        const value = event.target.valueAsNumber
                        onFragmentPatch(recordPage.regionId!, {
                          fragmentOrder: Number.isFinite(value) && value > 0 ? value : undefined,
                        })
                      }}
                      placeholder={String(index + 1)}
                      title="Ordem desta parte dentro do assento"
                      type="number"
                      value={recordPage.fragmentOrder ?? ''}
                    />
                  )}
                </li>
              ))}
            </ul>
            <small>As linhas de todas as partes entram na mesma transcrição e validação. A ordem define como o texto é lido.</small>
          </div>
        )}
        {continued && (
          <p className="predicted-text">
            Esta parte pertence ao assento {(() => {
              const target = openRecords.find(record => record.id === annotation.continuesRecordId)
              if (!target) return 'iniciado noutro lugar'
              if (target.displayLabel) {
                return `«${target.seq ? `Nº ${target.seq} · ` : ''}${target.displayLabel}»`
              }
              const label = recordTypeOntologyLabels[target.recordType] ?? target.recordType
              const detail = target.recordLabel
              return `«${label}${target.seq ? ` Nº ${target.seq}` : ''}${detail ? ` — ${detail}` : ''}»`
            })()} — é o mesmo assento, não um novo.
          </p>
        )}
        <label className="transcription-field">
          <span>Tipo de registro</span>
          <select
            onChange={event => onRecordType?.(event.target.value)}
            value={annotation.recordType ?? 'other'}
          >
            {Object.entries(recordTypeOntologyLabels).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          {annotation.recordType === 'other' && bookRecordType && bookRecordType !== 'other' && (
            <button
              className="secondary-button"
              onClick={() => onRecordType?.(bookRecordType)}
              type="button"
            >Usar «{recordTypeOntologyLabels[bookRecordType] ?? bookRecordType}» — tipo do livro</button>
          )}
          <small>Rascunhos da IA nascem como «Registro» — classifique o tipo real aqui.</small>
        </label>
        {onLinkRecord && openRecords.length > 0 && (
          <div className="transcription-field">
            <button
              className="secondary-button"
              onClick={() => setShowLinkPicker(current => !current)}
              type="button"
            >{showLinkPicker ? 'Fechar' : continued || fragmentCount > 1 ? 'Corrigir vínculo deste trecho' : 'Ligar a outro assento…'}</button>
            {showLinkPicker && (
              <>
                <select
                  onChange={event => {
                    onLinkRecord(event.target.value || null)
                    if (event.target.value) setShowLinkPicker(false)
                  }}
                  value={annotation.continuesRecordId ?? ''}
                >
                  <option value="">— assento independente —</option>
                  {continueTargets.map(record => (
                    <option key={record.id} value={record.id}>
                      {record.seq ? `Nº ${record.seq} · ` : ''}
                      {record.displayLabel ?? `${recordTypeOntologyLabels[record.recordType] ?? record.recordType}${record.recordLabel ? ` — ${record.recordLabel}` : ''}`}
                    </option>
                  ))}
                </select>
                <small>Use quando o retângulo foi desenhado como assento novo mas na verdade é parte de outro que já começou.</small>
              </>
            )}
          </div>
        )}
        {onSeparate && (continued || fragmentCount > 1) && (
          <button
            className="secondary-button"
            onClick={onSeparate}
            type="button"
          >Separar deste assento — vira um assento próprio</button>
        )}
        <ScribeFields annotation={annotation} onScribeChange={onScribeChange} />
        <div className="review-actions">
          <label><span>Estado de revisão</span><select onChange={event => onStatus(event.target.value as VerificationStatus)} value={annotation.status}><option value="pending">Pendente</option><option value="in_review">Em revisão</option><option value="verified">Verificada</option></select></label>
          <button className="verify-button" onClick={() => onStatus('verified')} type="button"><CheckCircle2 size={15} /> Marcar revista</button>
        </div>
      </div>
    )
  }

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
      {annotation.type === 'line' ? (
        <>
          <p className="predicted-text">{composedLineText || annotation.predictedText || 'Sem texto reconhecido.'}</p>
          <p className="predicted-text composed-note">Texto composto das palavras da linha — corrija as palavras, não a linha.</p>
        </>
      ) : (
        <>
          <p className="predicted-text">{annotation.predictedText || 'Sem texto reconhecido.'}</p>
          <label className="transcription-field">
            <span>Transcrição corrigida</span>
            <textarea
              onBlur={onFlush}
              onChange={event => onChange(event.target.value)}
              placeholder="Transcreva exatamente como aparece no documento…"
              rows={5}
              spellCheck={false}
              value={annotation.correctedText ?? ''}
            />
            <small>Grafia histórica, abreviaturas e acentuação são preservadas.</small>
          </label>
        </>
      )}
      <div className="review-actions">
        <label><span>Estado de revisão</span><select onChange={event => onStatus(event.target.value as VerificationStatus)} value={annotation.status}><option value="pending">Pendente</option><option value="in_review">Em revisão</option><option value="verified">Verificada</option></select></label>
        <button className="verify-button" onClick={() => onStatus('verified')} type="button"><CheckCircle2 size={15} /> Marcar revista</button>
      </div>
    </div>
  )
}
