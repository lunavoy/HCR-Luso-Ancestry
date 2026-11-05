import { AlertTriangle, ArrowLeft, Check, FileImage, Trash2, UploadCloud, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiDataService } from '../services/dataService'
import { useAppStore } from '../stores/useAppStore'
import type { ImportCandidate } from '../types/domain'
import { formatBytes } from '../utils/format'

const acceptedTypes = ['image/jpeg', 'image/png', 'image/tiff']

async function inspectFile(file: File): Promise<ImportCandidate> {
  const previewUrl = URL.createObjectURL(file)
  const candidate: ImportCandidate = {
    id: crypto.randomUUID(),
    file,
    previewUrl,
    progress: 0,
    state: 'ready',
  }
  if (!acceptedTypes.includes(file.type)) return { ...candidate, error: 'Formato não suportado', state: 'error' }
  try {
    const bitmap = await createImageBitmap(file)
    const result = { ...candidate, width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return result
  } catch {
    return { ...candidate, error: file.type === 'image/tiff' ? 'Pré-visualização TIFF indisponível no navegador' : 'Imagem inválida', state: 'error' }
  }
}

export function ImportPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const document = useAppStore(state => state.documents.find(item => item.id === documentId))
  const addPages = useAppStore(state => state.addPages)
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [dragging, setDragging] = useState(false)
  const intervalRef = useRef<number | undefined>(undefined)
  const candidatesRef = useRef<ImportCandidate[]>([])

  useEffect(() => {
    candidatesRef.current = candidates
  }, [candidates])

  useEffect(() => () => {
    candidatesRef.current.forEach(candidate => URL.revokeObjectURL(candidate.previewUrl))
    if (intervalRef.current) window.clearInterval(intervalRef.current)
  }, [])

  const addFiles = async (files: FileList | File[]) => {
    const inspected = await Promise.all(Array.from(files).map(inspectFile))
    setCandidates(current => [...current, ...inspected])
  }

  const importFiles = async () => {
    if (!documentId) return
    setCandidates(current => current.map(candidate => candidate.error ? candidate : { ...candidate, state: 'uploading', progress: 8 }))
    intervalRef.current = window.setInterval(() => setCandidates(current => current.map(candidate =>
      candidate.state === 'uploading' ? { ...candidate, progress: Math.min(92, candidate.progress + 12) } : candidate,
    )), 180)
    const valid = candidates.filter(candidate => !candidate.error)
    const pages = await apiDataService.importImages(documentId, valid.map(candidate => candidate.file))
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    setCandidates(current => current.map(candidate => candidate.error ? candidate : { ...candidate, state: 'complete', progress: 100 }))
    addPages(pages.map((page, index) => ({
      ...page,
      width: valid[index]?.width ?? page.width,
      height: valid[index]?.height ?? page.height,
      imageUrl: valid[index]?.previewUrl ?? page.imageUrl,
    })))
    window.setTimeout(() => navigate(`/documents/${documentId}`), 700)
  }

  return (
    <main className="page-shell import-page">
      <Link className="back-link" to={`/documents/${documentId}`}><ArrowLeft size={15} /> {document?.title ?? 'Livro'}</Link>
      <section className="page-heading"><p className="eyebrow">Entrada de acervo</p><h1>Importar imagens</h1><p>Os originais serão preservados sem redimensionamento ou compressão.</p></section>
      <div
        className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={event => { event.preventDefault(); setDragging(true) }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files) }}
      >
        <UploadCloud size={28} />
        <h2>Arraste imagens para esta área</h2>
        <p>JPG, JPEG, PNG ou TIFF · nomes originais preservados</p>
        <label className="secondary-button">Selecionar ficheiros<input hidden multiple accept=".jpg,.jpeg,.png,.tif,.tiff" onChange={event => event.target.files && void addFiles(event.target.files)} type="file" /></label>
      </div>
      {candidates.length > 0 && (
        <section className="import-queue">
          <div className="section-heading"><div><h2>Fila de importação</h2><p>{candidates.length} ficheiros selecionados · {formatBytes(candidates.reduce((sum, item) => sum + item.file.size, 0))}</p></div><button className="quiet-button" onClick={() => setCandidates([])} type="button"><Trash2 size={15} /> Limpar fila</button></div>
          <div className="queue-list">
            {candidates.map(candidate => (
              <div className="queue-item" key={candidate.id}>
                <div className="queue-preview">{candidate.error ? <FileImage size={21} /> : <img src={candidate.previewUrl} alt="" />}</div>
                <div className="queue-name"><strong>{candidate.file.name}</strong><span>{candidate.width && candidate.height ? `${candidate.width} × ${candidate.height} px · ` : ''}{formatBytes(candidate.file.size)}</span>{candidate.error && <small className="error-text"><AlertTriangle size={13} /> {candidate.error}</small>}</div>
                {candidate.state === 'uploading' && <div className="progress-block"><div className="progress-track"><span style={{ width: `${candidate.progress}%` }} /></div><span>{candidate.progress}%</span></div>}
                {candidate.state === 'complete' && <span className="complete-label"><Check size={15} /> Importada</span>}
                <button className="icon-button always-visible bare" onClick={() => setCandidates(current => current.filter(item => item.id !== candidate.id))} title="Remover" type="button"><X size={17} /></button>
              </div>
            ))}
          </div>
          <div className="queue-footer"><span><AlertTriangle size={15} /> Esta etapa usa armazenamento local simulado.</span><button className="primary-button" disabled={!candidates.some(candidate => !candidate.error) || candidates.some(candidate => candidate.state === 'uploading')} onClick={() => void importFiles()} type="button"><UploadCloud size={16} /> Importar {candidates.filter(candidate => !candidate.error).length} imagens</button></div>
        </section>
      )}
    </main>
  )
}
