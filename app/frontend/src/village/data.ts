import type { Annotation } from '../types/domain'

export type Profile = 'homem' | 'mulher' | 'crianca' | 'idoso'
export type Precision = 'documentada' | 'aproximada' | 'ilustrativa'
export type House = {
  id: string
  name: string
  locality: string
  latitude: number
  longitude: number
  precision: Precision
  example?: boolean
}
export type Resident = {
  id: string
  houseId: string
  name: string
  locality: string
  profile: Profile
  birth?: string
  baptism?: string
  death?: string
  deathSource?: string
  source?: string
  occupation?: string
  occupationSource?: string
  activity?: boolean
}
export type Action = 'Arar' | 'Colher' | 'Preparar comida' | 'Lavar roupa' | 'Repousar'

export const profiles: Record<Profile, string> = {
  homem: 'Homem adulto', mulher: 'Mulher adulta', crianca: 'Criança', idoso: 'Pessoa idosa',
}

const example: House = {
  id: 'example', name: 'Casa da família Ribeiro', locality: 'Alfama, Lisboa',
  latitude: 38.711, longitude: -9.129, precision: 'ilustrativa', example: true,
}

const exampleResidents: Resident[] = [
  { id: 'manuel', name: 'Manuel Ribeiro', profile: 'homem', birth: '1812-03-02', baptism: '1812-03-05' },
  { id: 'rosa', name: 'Rosa Ribeiro', profile: 'mulher', baptism: '1816-10-17' },
  { id: 'ines', name: 'Inês Ribeiro', profile: 'crianca', birth: '1843-06-09', baptism: '1843-06-12' },
  { id: 'joao', name: 'João Ribeiro', profile: 'idoso', baptism: '1782-01-20', death: '1854-01-15' },
].map(person => ({ ...person, profile: person.profile as Profile, houseId: example.id, locality: example.locality }))

function read<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

export function villageRepository(user: string) {
  const prefix = `genealogy-village:v1:${user}`
  const housesKey = `${prefix}:houses`
  const residentsKey = (houseId: string) => `${prefix}:residents:${houseId}`
  return {
    listHouses([west, south, east, north]: [number, number, number, number]) {
      return [example, ...read<House[]>(housesKey, [])].filter(({ longitude, latitude }) =>
        longitude >= west && longitude <= east && latitude >= south && latitude <= north)
    },
    createHouse(house: House) {
      write(housesKey, [...read<House[]>(housesKey, []), house])
    },
    getResidents(houseId: string) {
      return read<Resident[]>(residentsKey(houseId), houseId === example.id ? exampleResidents : [])
    },
    saveResident(resident: Resident) {
      const key = residentsKey(resident.houseId)
      const residents = this.getResidents(resident.houseId)
      const index = residents.findIndex(item => item.id === resident.id)
      if (index < 0) residents.push(resident)
      else residents[index] = resident
      write(key, residents)
      return residents
    },
  }
}

type LineProgress = Record<string, 'validated' | 'pending'>

export function readProgress(user: string) {
  const statuses = Object.values(read<LineProgress>(`genealogy-village:v1:${user}:lines`, {}))
  return {
    validated: statuses.filter(status => status === 'validated').length,
    pending: statuses.filter(status => status === 'pending').length,
  }
}

export function recordLineProgress(user: string, pageId: string, before: Annotation[], after: Annotation[]) {
  const key = `genealogy-village:v1:${user}:lines`
  const progress = read<LineProgress>(key, {})
  const previous = new Map(before.map(line => [line.id, line]))
  const saved = new Set(after.map(line => `${pageId}:${line.id}`))
  for (const id of Object.keys(progress)) {
    if (id.startsWith(`${pageId}:`) && !saved.has(id) && progress[id] === 'pending') delete progress[id]
  }
  for (const line of after) {
    if (line.type !== 'line') continue
    const id = `${pageId}:${line.id}`
    if (progress[id] === 'validated') continue
    const original = previous.get(line.id)
    const text = line.correctedText?.trim()
    if (!text || text === line.predictedText?.trim()) {
      if (line.correctedText !== original?.correctedText) delete progress[id]
      continue
    }
    if (text !== original?.correctedText?.trim() || progress[id] === 'pending') {
      progress[id] = line.status === 'verified' ? 'validated' : 'pending'
    }
  }
  write(key, progress)
}

export function actionsFor(resident: Resident, validated: number): Action[] {
  if (resident.profile === 'crianca' || resident.profile === 'idoso') return ['Repousar']
  if (!resident.activity || validated < 50) return []
  const actions: Action[] = resident.profile === 'homem' ? ['Arar'] : ['Preparar comida']
  if (validated >= 100) actions.push(resident.profile === 'homem' ? 'Colher' : 'Lavar roupa')
  return actions
}
