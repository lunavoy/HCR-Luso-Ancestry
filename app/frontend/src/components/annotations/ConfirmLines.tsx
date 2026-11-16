import { Check, ChevronLeft, ChevronRight, Expand, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Annotation, LexiconSuggestion, Page } from '../../types/domain'
import { polygonBounds } from '../../utils/geometry'

// Confirmação rápida por LINHA: mostra o recorte da imagem, o texto que a
// IA leu e o que o léxico sugere. Enter confirma, digitar corrige, → pula.
// É o passo que alimenta o treino — polygons não se editam aqui.
// Save é manual ("Salvar agora") — nada de autosave aqui.

function LineCrop({ line, page }: { line: Annotation; page: Page }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !line.polygon.length) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const bounds = polygonBounds(line.polygon)
      const pad = 6
      const x0 = Math.max(0, bounds.x - pad)
      const y0 = Math.max(0, bounds.y - pad)
      const w = Math.min(page.width - x0, bounds.width + pad * 2)
      const h = Math.min(page.height - y0, bounds.height + pad * 2)
      const scale = Math.min(4, 140 / Math.max(h, 1))
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(scale, scale)
      ctx.beginPath()
      line.polygon.forEach((point, index) => {
        const x = point.x - x0
        const y = point.y - y0
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(img, -x0, -y0)
      ctx.restore()
      ctx.strokeStyle = '#e8590c'
      ctx.lineWidth = 1.5 / scale
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
    }
    img.src = page.imageUrl
  }, [line.id, line.polygon, page.imageUrl, page.width, page.height])

  return <canvas className="confirm-crop" ref={canvasRef} />
}

// Recorte ampliado: a linha atual + vizinhas acima/abaixo, para ler o
// contexto do assento sem sair da confirmação.
const CONTEXT_LINES = 3

function ContextCrop({ line, lines, page }: { line: Annotation; lines: Annotation[]; page: Page }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ordered = [...lines].sort((a, b) => {
        const ab = polygonBounds(a.polygon)
        const bb = polygonBounds(b.polygon)
        return ab.y - bb.y || ab.x - bb.x || a.readingOrder - b.readingOrder
      })
      const index = Math.max(0, ordered.findIndex(item => item.id === line.id))
      const windowLines = ordered.slice(Math.max(0, index - CONTEXT_LINES), index + CONTEXT_LINES + 1)
      const bounds = windowLines.reduce((acc, item) => {
        const b = polygonBounds(item.polygon)
        return {
          x: Math.min(acc.x, b.x), y: Math.min(acc.y, b.y),
          x2: Math.max(acc.x2, b.x + b.width), y2: Math.max(acc.y2, b.y + b.height),
        }
      }, { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity })
      const pad = 18
      const x0 = Math.max(0, bounds.x - pad)
      const y0 = Math.max(0, bounds.y - pad)
      const w = Math.min(page.width - x0, bounds.x2 - bounds.x + pad * 2)
      const h = Math.min(page.height - y0, bounds.y2 - bounds.y + pad * 2)
      const scale = Math.min(2.2, 460 / Math.max(h, 1))
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(scale, scale)
      ctx.translate(-x0, -y0)
      ctx.beginPath()
      ctx.rect(x0, y0, w, h)
      ctx.clip()
      ctx.drawImage(img, 0, 0, page.width, page.height)
      for (const item of windowLines) {
        const isCurrent = item.id === line.id
        ctx.beginPath()
        item.polygon.forEach((point, pIndex) => {
          if (pIndex === 0) ctx.moveTo(point.x, point.y)
          else ctx.lineTo(point.x, point.y)
        })
        ctx.closePath()
        ctx.fillStyle = isCurrent ? 'rgba(232,89,12,.14)' : 'rgba(79,124,255,.07)'
        ctx.fill()
        ctx.strokeStyle = isCurrent ? '#e8590c' : 'rgba(79,124,255,.45)'
        ctx.lineWidth = isCurrent ? 2 : 1
        ctx.stroke()
      }
      ctx.restore()
    }
    img.src = page.imageUrl
  }, [line.id, lines, page.imageUrl, page.width, page.height])

  return <canvas className="confirm-crop confirm-crop-context" ref={canvasRef} />
}

export function ConfirmLines({ page, annotations, suggestions, pendingCount, saving, saveError, registerDraft, onConfirmText, onSaveNow, onClose }: {
  page: Page
  annotations: Annotation[]
  suggestions?: LexiconSuggestion[]
  pendingCount: number
  saving: boolean
  saveError: string
  registerDraft: (commit?: () => void) => void
  onConfirmText: (lineId: string, text: string, verified: boolean) => void
  onSaveNow: () => void
  onClose: () => void
}) {
  const queue = useMemo(() => annotations
    .filter(annotation => annotation.type === 'line' && annotation.status !== 'verified')
    .sort((a, b) => {
      const ab = polygonBounds(a.polygon)
      const bb = polygonBounds(b.polygon)
      return ab.y - bb.y || ab.x - bb.x || a.readingOrder - b.readingOrder
    }), [annotations])

  const allLines = useMemo(
    () => annotations.filter(annotation => annotation.type === 'line'),
    [annotations])

  const [cursorId, setCursorId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sessionConfirmed, setSessionConfirmed] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [showContext, setShowContext] = useState(false)

  const cursorIndex = Math.max(0, queue.findIndex(line => line.id === cursorId))
  const current = queue[cursorIndex] ?? queue[0]

  useEffect(() => {
    if (current) setDraft(current.correctedText ?? current.predictedText ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  const suggestionByLine = useMemo(() => {
    const map = new Map<string, LexiconSuggestion>()
    for (const suggestion of suggestions ?? []) {
      if (suggestion.status === 'pending' && !map.has(suggestion.line_id)) {
        map.set(suggestion.line_id, suggestion)
      }
    }
    return map
  }, [suggestions])

  const goTo = (line: Annotation | undefined) => {
    setCursorId(line?.id ?? null)
    if (line) setDraft(line.correctedText ?? line.predictedText ?? '')
  }

  const next = () => {
    const index = queue.findIndex(line => line.id === current?.id)
    goTo(queue[index + 1])
  }

  const previous = () => {
    const index = queue.findIndex(line => line.id === current?.id)
    if (index > 0) goTo(queue[index - 1])
  }

  const confirm = (verified: boolean) => {
    if (!current) return
    onConfirmText(current.id, draft.trim(), verified)
    setSessionConfirmed(count => count + 1)
    next()
  }

  const skip = () => {
    if (!current) return
    setSkipped(count => count + 1)
    next()
  }

  const useSuggestion = () => {
    const suggestion = current ? suggestionByLine.get(current.id) : undefined
    if (suggestion?.suggested_text) setDraft(suggestion.suggested_text)
  }

  const confidence = current?.confidence != null
    ? `${Math.round(current.confidence * (current.confidence <= 1 ? 100 : 1))}%`
    : '—'

  const draftChanged = Boolean(current && draft !== (current.correctedText ?? current.predictedText ?? ''))
  useEffect(() => {
    if (current && draftChanged) {
      registerDraft(() => onConfirmText(current.id, draft.trim(), false))
    } else {
      registerDraft()
    }
    return () => registerDraft()
  }, [current, draft, draftChanged, onConfirmText, registerDraft])

  const save = () => {
    if (current && draftChanged) onConfirmText(current.id, draft.trim(), false)
    onSaveNow()
  }
  const close = () => {
    if (current && draftChanged) onConfirmText(current.id, draft.trim(), false)
    onClose()
  }

  if (!queue.length) {
    return (
      <div className="confirm-lines">
        <header className="confirm-header">
          <strong>Todas as linhas estão verificadas</strong>
          <button className="secondary-button" disabled={saving || !pendingCount} onClick={save} type="button">{saving ? 'Salvando…' : 'Salvar agora'}</button>
          <button className="secondary-button" onClick={close} type="button">Voltar ao editor</button>
        </header>
        {saveError && <p className="error-text" role="alert">{saveError}</p>}
        <p className="confirm-empty">{sessionConfirmed} linhas confirmadas nesta sessão{skipped ? ` · ${skipped} saltadas` : ''}.</p>
      </div>
    )
  }

  const suggestion = current ? suggestionByLine.get(current.id) : undefined
  const position = queue.findIndex(line => line.id === current?.id) + 1

  return (
    <div className="confirm-lines">
      <header className="confirm-header">
        <div className="confirm-progress">
          <strong>Confirmação de linhas</strong>
          <span>linha {position} de {queue.length} pendentes</span>
        </div>
        <div className="confirm-actions-head">
          <span className="confirm-counter" title="Alterações locais ainda não gravadas no servidor">
            {pendingCount || draftChanged ? 'Alterações pendentes' : 'Tudo guardado'}
          </span>
          <button className="secondary-button" disabled={saving || (!pendingCount && !draftChanged)} onClick={save} type="button">{saving ? 'Salvando…' : 'Salvar agora'}</button>
          <button className="icon-button bare" onClick={close} title="Voltar ao editor" type="button"><X size={17} /></button>
        </div>
      </header>
      {saveError && <p className="error-text" role="alert">{saveError}</p>}
      <div className="confirm-body">
        {current && (
          <>
            {showContext
              ? <ContextCrop line={current} lines={allLines} page={page} />
              : <LineCrop line={current} page={page} />}
            <div className="confirm-meta">
              <button
                className="secondary-button"
                onClick={() => setShowContext(value => !value)}
                title="Mostrar a linha no contexto das linhas vizinhas"
                type="button"
              >
                <Expand size={13} /> {showContext ? 'Só a linha' : 'Ver no contexto'}
              </button>
              <span>confiança da IA: <strong>{confidence}</strong></span>
              {suggestion && (
                <button className="lexicon-suggestion" onClick={useSuggestion} title={suggestion.original_text} type="button">
                  <Sparkles size={11} /> léxico sugere: {suggestion.suggested_text}
                </button>
              )}
            </div>
            <textarea
              autoFocus
              className="confirm-text"
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); confirm(true) }
                if (event.key === 'ArrowRight' && event.ctrlKey) { event.preventDefault(); skip() }
                if (event.key === 'ArrowLeft' && event.ctrlKey) { event.preventDefault(); previous() }
              }}
              rows={3}
              spellCheck={false}
              value={draft}
            />
            <div className="confirm-footer">
              <span className="confirm-hint">Enter confirma · Shift+Enter marca incerta · Ctrl+→ pula · Ctrl+← volta</span>
              <div className="confirm-buttons">
                <button className="secondary-button" onClick={previous} type="button"><ChevronLeft size={14} /> Anterior</button>
                <button className="secondary-button" onClick={skip} type="button">Pular <ChevronRight size={14} /></button>
                <button className="secondary-button" onClick={() => confirm(false)} title="Li, mas não tenho certeza — fica para revisar depois, fora do treino verificado" type="button">Incerta</button>
                <button className="primary-button" onClick={() => confirm(true)} type="button"><Check size={15} /> Confirmar e avançar</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
