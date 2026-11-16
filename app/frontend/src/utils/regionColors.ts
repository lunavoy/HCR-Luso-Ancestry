// Cores das regiões.
// region_type é texto livre: tipos não classificados ficam cinza;
// qualquer tipo definido recebe um tom de rosa/magenta da paleta —
// mesmo tipo → mesma cor, e a página mantém uma identidade única.

const PINK_PALETTE = [
  '#ff3d81', '#e83e8c', '#ff5ea8', '#d946ef', '#ff2e88',
  '#f72585', '#ff71ce', '#e0218f', '#ff4fa3', '#ff8fb8',
]

const UNCLASSIFIED = '#adb5bd'

function hashKey(key: string): number {
  let hash = 5381
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(index)) >>> 0
  }
  return hash
}

export function regionColor(regionType?: string): string {
  const key = (regionType ?? 'unclassified').trim() || 'unclassified'
  if (key === 'unclassified' || key === 'other') return UNCLASSIFIED
  return PINK_PALETTE[hashKey(key) % PINK_PALETTE.length]
}

export function contrastingText(color: string): string {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1b2a41' : '#ffffff'
}
