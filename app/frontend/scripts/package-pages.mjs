import { copyFile, mkdir } from 'node:fs/promises'

const output = new URL('../dist/', import.meta.url)
const landing = new URL('../../../site/', import.meta.url)
const destination = new URL('site/', output)

await mkdir(destination, { recursive: true })
await Promise.all(
  ['index.html', 'site.css', 'script.js', 'favicon.svg', 'alfama.webp'].map(file =>
    copyFile(new URL(file, landing), new URL(file, destination)),
  ),
)
