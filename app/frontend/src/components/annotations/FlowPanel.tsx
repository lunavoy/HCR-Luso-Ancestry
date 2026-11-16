import { Check, ChevronRight, Loader2, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Annotation, SegmentProgress } from '../../types/domain'

export type FlowAction =
  | 'draw-region'
  | 'add-line'
  | 'review-lines'
  | 'review-words'
  | 'confirm-lines'
  | 'transcription'
  | 'save'

interface StepAction {
  label: string
  action?: FlowAction
  to?: string
  disabled?: boolean
  primary?: boolean
  segment?: boolean
}

interface Step {
  key: string
  title: string
  hint: string
  metric: string
  progress: number
  done: boolean
  actions?: StepAction[]
}

const SEGMENT_STAGES: Record<string, string> = {
  prepare: 'A preparar a imagem',
  layout: 'Segmentação do layout',
  ocr: 'Reconhecimento de texto (OCR)',
  saving: 'A gravar resultados',
  done: 'Concluído',
}

export function FlowPanel({
  annotations,
  onAction,
  onSegment,
  segmenting,
  canSegment,
  segmentProgress,
}: {
  annotations: Annotation[]
  onAction?: (action: FlowAction) => void
  onSegment?: () => void
  segmenting?: boolean
  canSegment?: boolean
  segmentProgress?: SegmentProgress | null
}) {
  const regions = annotations.filter(a => a.type === 'region')
  const records = annotations.filter(a => a.type === 'record')
  const lines = annotations.filter(a => a.type === 'line')
  const words = annotations.filter(a => a.type === 'word')
  const containers = [...regions, ...records]

  const classifiedRegions = regions.filter(region => {
    const label = region.regionType?.trim()
    return Boolean(label) && label !== 'unclassified'
  }).length
  const unclassified = regions.length - classifiedRegions

  const lineOrphans = lines.filter(line => !line.parentId).length
  const lineNoGeometry = lines.filter(line =>
    line.polygon.length < 3 || (line.baseline?.length ?? 0) < 2).length
  const linesNoText = lines.filter(line => !(line.correctedText || line.predictedText)).length
  const linesStructured = lines.filter(line =>
    line.parentId && line.polygon.length >= 3 && (line.baseline?.length ?? 0) >= 2).length

  const linesVerified = lines.filter(line => line.status === 'verified').length
  const wordsVerified = words.filter(word => word.status === 'verified').length
  const recordsVerified = records.filter(record => record.status === 'verified').length

  const regionsDone = containers.length > 0 && unclassified === 0
  const linesDone = lines.length > 0 && lineOrphans === 0 && lineNoGeometry === 0
  const lineShapesDone = linesDone && linesVerified === lines.length
  const wordShapesDone = words.length > 0 && wordsVerified === words.length
  // Sem registros na página (capa, índice, verso) a validação não se aplica.
  const validationDone = recordsVerified === records.length

  const pct = (part: number, total: number) => (total ? part / total : 0)
  const segmentDisabled = Boolean(segmenting) || !canSegment
  const segmentLabel = segmenting ? 'A segmentar…' : 'Segmentar página inteira'

  const steps: Step[] = [
    {
      key: 'regions',
      title: '1. Regiões',
      hint: containers.length === 0
        ? 'Desenhe as regiões no canvas (ferramenta de desenho) ou execute a segmentação para a IA propor a estrutura. Cada região precisa de uma etiqueta: registro paroquial, número de página, selo, margem…'
        : 'Classifique cada região e registro — números de página, termos de abertura, selos, registros paroquiais e o que houver dentro deles. As etiquetas editam-se na aba Transcrição.',
      metric: containers.length
        ? `${classifiedRegions}/${regions.length} regiões classificadas · ${records.length} registros`
        : 'sem regiões — segmentar ou desenhar primeiro',
      progress: pct(classifiedRegions + records.length, containers.length),
      done: regionsDone,
      actions: [
        ...(containers.length === 0 && onSegment
          ? [{ label: segmentLabel, segment: true, disabled: segmentDisabled, primary: true }]
          : []),
        { label: 'Desenhar região', action: 'draw-region' as FlowAction },
        ...(containers.length > 0
          ? [{ label: 'Etiquetas na Transcrição', action: 'transcription' as FlowAction }]
          : []),
      ],
    },
    {
      key: 'lines',
      title: '2. Linhas de texto',
      hint: 'Corrija o que a IA propôs: apague linhas erradas, desenhe as que faltam (ferramenta de linha) e arraste cada linha para a região certa na aba Transcrição. A baseline define a leitura; o contorno vem no passo seguinte.',
      metric: lines.length
        ? `${lines.length} linhas · ${lineOrphans} sem região · ${linesNoText} sem texto`
        : 'sem linhas — segmentar a página ou desenhar com a ferramenta de linha',
      progress: pct(linesStructured, lines.length),
      done: linesDone,
      actions: [
        ...(lines.length === 0 && onSegment
          ? [{ label: segmentLabel, segment: true, disabled: segmentDisabled, primary: true }]
          : []),
        { label: 'Adicionar linha', action: 'add-line' as FlowAction, primary: lines.length === 0 },
        ...(lines.length > 0
          ? [
            { label: 'Confirmar linhas (rápido)', action: 'confirm-lines' as FlowAction, primary: true },
            { label: 'Linhas na Transcrição', action: 'transcription' as FlowAction },
          ]
          : []),
      ],
    },
    {
      key: 'line-shapes',
      title: '3. Contorno das linhas',
      hint: 'Reveja cada linha: o contorno (polígono) deve abraçar o texto sem cortar ascendentes/descendentes nem engolir a linha vizinha; a baseline segue a curvatura da escrita. Confirme cada uma — o que confirmar vira treino.',
      metric: lines.length ? `${linesVerified}/${lines.length} linhas verificadas` : 'sem linhas',
      progress: pct(linesVerified, lines.length),
      done: lineShapesDone,
      actions: lines.length
        ? [{ label: 'Revisar próxima linha', action: 'review-lines' as FlowAction, primary: true }]
        : [],
    },
    {
      key: 'word-shapes',
      title: '4. Contorno das palavras',
      hint: 'Ajuste os retângulos das palavras para envolver cada palavra sem invadir a vizinha. Confirme-as — palavras verificadas alimentam as menções de campos na validação.',
      metric: words.length ? `${wordsVerified}/${words.length} palavras verificadas` : 'sem palavras',
      progress: pct(wordsVerified, words.length),
      done: wordShapesDone,
      actions: words.length
        ? [{ label: 'Revisar próxima palavra', action: 'review-words' as FlowAction, primary: true }]
        : [],
    },
    {
      key: 'validation',
      title: '5. Validação dos dados',
      hint: 'Com a página revista, dê semântica ao conteúdo: marque na transcrição o que cada trecho significa (nomes, datas, sponsors…) e valide os registros.',
      metric: records.length ? `${recordsVerified}/${records.length} registros validados` : 'sem registros',
      progress: pct(recordsVerified, records.length),
      done: validationDone,
      actions: [{ label: 'Abrir Validação', to: '/validation', primary: true }],
    },
  ]

  const currentIndex = steps.findIndex(step => !step.done)
  const allDone = currentIndex < 0
  const progress = segmenting ? segmentProgress : null
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!progress) { setElapsed(0); return }
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [progress != null]) // eslint-disable-line react-hooks/exhaustive-deps
  const stageLabel = SEGMENT_STAGES[progress?.stage ?? ''] ?? 'A processar'
  const percent = progress?.percent ?? null
  const linesInfo = progress?.lines_done != null && progress?.lines_total
    ? ` · linha ${progress.lines_done}/${progress.lines_total}` : ''

  const runAction = (action: StepAction) => {
    if (action.segment) { onSegment?.(); return }
    if (action.action) onAction?.(action.action)
  }

  return (
    <div className="flow-panel">
      <p className="flow-intro">
        {allDone
          ? <>Esta página está <strong>completa e revista</strong> — o estado passa a «Revisada» ao guardar. Siga para a validação dos dados.</>
          : <>Esta página está na etapa <strong>{steps[currentIndex].title}</strong>. Siga os passos — cada confirmação alimenta o treino das IAs. As alterações são guardadas automaticamente.</>}
      </p>
      {allDone && (
        <div className="flow-complete">
          <Check size={16} />
          <div>
            <strong>Página completa</strong>
            <small>Todas as regiões, linhas e palavras foram revistas. O treino só usa dados verificados.</small>
          </div>
        </div>
      )}
      <ol className="flow-steps">
        {steps.map((step, index) => {
          const state = step.done ? 'done' : index === currentIndex ? 'current' : 'pending'
          return (
            <li className={`flow-step is-${state}`} key={step.key}>
              <span className="flow-marker">{step.done ? <Check size={13} /> : index + 1}</span>
              <div className="flow-body">
                <strong>{step.title}</strong>
                <p>{step.hint}</p>
                <small>{step.metric}</small>
                {!step.done && step.progress > 0 && (
                  <span className="flow-progress"><span style={{ width: `${Math.round(step.progress * 100)}%` }} /></span>
                )}
                {step.actions?.map(action => action.to ? (
                  <Link className="secondary-button flow-action" key={action.label} to={action.to}>
                    {action.label} <ChevronRight size={14} />
                  </Link>
                ) : (
                  <button
                    className={`secondary-button flow-action ${action.primary ? 'flow-action-primary' : ''}`}
                    disabled={action.disabled}
                    key={action.label}
                    onClick={() => runAction(action)}
                    type="button"
                  >
                    {action.segment ? <ScanLine size={14} /> : null}
                    {action.label}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ol>
      {progress && (
        <div className="segment-progress" role="status" aria-live="polite">
          <div className="segment-progress-head">
            <Loader2 className="spin" size={15} />
            <strong>{stageLabel}</strong>
            {percent != null && <span className="segment-percent">{percent}%</span>}
          </div>
          <div className="segment-bar"><div className="segment-bar-fill" style={{ width: `${percent ?? 8}%` }} /></div>
          <small>
            {percent != null ? `${percent}%${linesInfo}` : 'a processar…'}
            {` · ${elapsed}s decorridos`}
            {progress.detail ? ` — ${progress.detail}` : ''}
          </small>
        </div>
      )}
    </div>
  )
}
