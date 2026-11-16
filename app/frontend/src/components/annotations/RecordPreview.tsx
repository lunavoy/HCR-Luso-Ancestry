import { useEffect, useRef, useState } from 'react'
import { apiDataService } from '../../services/dataService'

interface PreviewPolygon { pageId: string; pageNumber?: number; polygon?: unknown }

const toPoints = (value: unknown): { x: number; y: number }[] => {
  if (!Array.isArray(value)) return []
  return value.map(point => {
    if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) }
    const object = point as Record<string, unknown>
    return { x: Number(object.x), y: Number(object.y) }
  }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()
const loadImage = (url: string) => {
  let cached = imageCache.get(url)
  if (!cached) {
    cached = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('image load failed'))
      image.src = url
    })
    imageCache.set(url, cached)
  }
  return cached
}

// Miniatura do retângulo do assento sobre a página — ajuda a reconhecer
// o registro no seletor sem depender só do número/nome.
export function RecordPreview({ preview }: { preview?: PreviewPolygon }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const points = toPoints(preview?.polygon)

  useEffect(() => {
    setFailed(false)
    const canvas = canvasRef.current
    if (!preview?.pageId || points.length < 3 || !canvas) return
    let cancelled = false
    apiDataService.getPage(preview.pageId)
      .then(page => loadImage(page.imageUrl))
      .then(image => {
        if (cancelled) return
        const xs = points.map(point => point.x)
        const ys = points.map(point => point.y)
        const minX = Math.min(...xs); const minY = Math.min(...ys)
        const width = Math.max(...xs) - minX; const height = Math.max(...ys) - minY
        if (width <= 0 || height <= 0) return
        const W = 132; const H = 84
        canvas.width = W; canvas.height = H
        const scale = Math.min(W / width, H / height)
        const offsetX = (W - width * scale) / 2
        const offsetY = (H - height * scale) / 2
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(image,
          minX, minY, width, height,
          offsetX, offsetY, width * scale, height * scale)
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.beginPath()
        points.forEach((point, index) => {
          const px = offsetX + (point.x - minX) * scale
          const py = offsetY + (point.y - minY) * scale
          if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        })
        ctx.closePath(); ctx.stroke()
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.pageId, preview?.polygon])

  if (!preview?.pageId || points.length < 3 || failed) return null
  return <canvas className="record-preview" ref={canvasRef} />
}
