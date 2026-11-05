import express, { type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const app = express()
const port = Number(process.env.PORT ?? 5100)
const pythonUrl = process.env.PYTHON_API_URL ?? 'http://127.0.0.1:8000'
const aiUrl = process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:5000'
const distRoot = join(import.meta.dirname, '..', 'dist')

// Corpo bruto: preserva uploads multipart (imagens) além de JSON.
app.use(express.raw({ type: () => true, limit: '200mb' }))

async function forward(req: Request, res: Response, baseUrl: string, targetPath: string) {
  const headers: Record<string, string> = {}
  const contentType = req.get('content-type')
  if (contentType) headers['content-type'] = contentType
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length > 0
  try {
    const response = await fetch(`${baseUrl}${targetPath}`, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
    })
    res.status(response.status)
    response.headers.forEach((value, key) => {
      if (!['content-length', 'transfer-encoding', 'content-encoding', 'connection'].includes(key)) res.setHeader(key, value)
    })
    res.send(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error(`Falha ao encaminhar ${req.method} ${targetPath} para ${baseUrl}:`, error)
    res.status(502).json({ detail: `Serviço Python indisponível em ${baseUrl}. Ele está em execução?` })
  }
}

app.post('/recognize', (req, res) => void forward(req, res, aiUrl, '/api/recognize'))
app.post('/detect-layout', (req, res) => void forward(req, res, aiUrl, '/api/detect-layout'))
app.use('/api', (req, res) => void forward(req, res, pythonUrl, req.originalUrl))

if (existsSync(distRoot)) {
  app.use(express.static(distRoot))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(distRoot, 'index.html')))
} else {
  app.get('/', (_req, res) => res.status(200).send('Frontend Vite ativo. Execute npm run dev para desenvolvimento.'))
}

app.listen(port, '127.0.0.1', () => {
  console.log(`Node API pública: http://127.0.0.1:${port}`)
  console.log(`API FastAPI (Supabase): ${pythonUrl}`)
  console.log(`Serviço de IA (Flask): ${aiUrl}`)
})
