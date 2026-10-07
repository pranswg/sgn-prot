import { nanoid } from 'nanoid'
import type {
  ChoirPosition,
  Member,
  MembershipType,
  Trainee,
} from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'

export interface ExtractedTextItem {
  x: number
  y: number
  str: string
}

export interface RosterCandidate {
  id: string
  section: string
  isTrainee: boolean
  firstName: string
  middleName?: string
  lastName: string
  gender: 'male' | 'female'
  voicePosition: string
  isActive: boolean
  notes: string
  duplicate: boolean
  selected: boolean
  /**
   * Fields below are only populated when the file was a spreadsheet export
   * from Master List, which carries more detail than the roster PDF.
   */
  membershipType?: MembershipType
  positions?: ChoirPosition[]
  dateAdded?: string
}

export interface RosterParseResult {
  candidates: RosterCandidate[]
  pageCount: number
}

interface SectionInfo {
  title: string
  kind: 'voice' | 'trainee' | 'leaders' | 'organista'
  voiceId?: string
  gender?: 'male' | 'female'
}

const COLUMN_SPLIT_X = 350

const BANNED_NAME_TOKENS = new Set([
  'BLG',
  'PANGALAN',
  'GAMPANIN',
  'STATUS',
  'ACTIVE',
  'INACTIVE',
  'BALIK-TUNGKULIN',
  'SICK',
  'LEAVE',
  'WALA',
  'PO',
  'NA',
  'II',
  'PANGULONG',
  'MANG-AAWIT',
  'MGA',
  'KATUWANG',
  'ORGANISTA',
  'NAGSASANAY',
  'NAGBABALIK',
  'TSV',
  'PNK',
  'OIC',
  'ATPA',
  'LEAD',
])

const SURNAME_PARTICLES = new Set(['DELA', 'DE', 'DA', 'LA', 'DEL', 'SAN', 'STA'])
const SUFFIXES = new Set(['JR', 'JR.', 'SR', 'SR.', 'I', 'II', 'III', 'IV', 'V'])

const ROLE_MARKERS = [
  'PANGULONG',
  'KALIHIM',
  'MANG-AAWIT',
  'KATUWANG',
  'PNK',
  'TSV',
  'OIC',
  'ATPA',
  'ORGANISTA',
  'LEAD',
  'NAGBABALIK',
]

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeNameKey(lastName: string, firstName: string): string {
  return `${lastName}|${firstName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildExistingSet(
  members: Member[],
  trainees: Trainee[],
): Map<string, { gender: 'male' | 'female'; voicePosition: string }> {
  const map = new Map<string, { gender: 'male' | 'female'; voicePosition: string }>()
  for (const m of members) {
    map.set(normalizeNameKey(m.lastName, m.firstName), {
      gender: m.gender,
      voicePosition: m.voicePosition,
    })
  }
  for (const t of trainees) {
    if (!map.has(normalizeNameKey(t.lastName, t.firstName))) {
      map.set(normalizeNameKey(t.lastName, t.firstName), {
        gender: t.gender,
        voicePosition: t.voicePosition,
      })
    }
  }
  return map
}

function recognizeSection(norm: string, voices: VoicePosition[]): SectionInfo | null {
  if (norm.includes('NAGSASANAY')) {
    if (norm.includes('BABAE')) return { title: norm, kind: 'trainee', gender: 'female' }
    if (norm.includes('LALAKI')) return { title: norm, kind: 'trainee', gender: 'male' }
    return { title: norm, kind: 'organista' }
  }
  if (norm.includes('PANGULUHAN')) return { title: norm, kind: 'leaders' }
  if (norm.includes('ORGANISTA')) return { title: norm, kind: 'organista' }
  const voice = voices.find((v) => norm === v.name.toUpperCase())
  if (voice) return { title: norm, kind: 'voice', voiceId: voice.id, gender: voice.gender }
  return null
}

function cleanNote(value: string): string {
  return collapseSpaces(value.replace(/[\u2013\u2014-]+/g, ' '))
}

function appendNote(notes: string, value: string): string {
  const cleaned = cleanNote(value)
  if (!cleaned) return notes
  return notes ? `${notes}; ${cleaned}` : cleaned
}

function isNumberToken(token: string): boolean {
  return /^\d+\.?$/.test(token)
}

function normalizeToken(token: string): string {
  return token.toUpperCase().replace(/\./g, '')
}

function hasComma(token: string): boolean {
  return token.includes(',')
}

function looksLikeName(candidate: string): boolean {
  const tokens = candidate.split(/\s+/).filter(Boolean)
  if (tokens.length < 2 || tokens.length > 8) return false
  if (tokens.some((t) => /^\d/.test(t))) return false
  if (tokens.some((t) => t.includes('/'))) return false
  if (tokens.some((t) => BANNED_NAME_TOKENS.has(normalizeToken(t)))) return false
  if (tokens.every((t) => t === t.toUpperCase())) return false
  if (!/[A-ZÀ-ÖØ]/.test(tokens[0])) return false
  return true
}

function isSurnameParticle(token: string): boolean {
  return SURNAME_PARTICLES.has(normalizeToken(token))
}

function stripRoleSuffix(givenName: string): { firstName: string; role: string } {
  const tokens = givenName.split(/\s+/).filter(Boolean)
  const markerIndex = tokens.findIndex((token) =>
    ROLE_MARKERS.some((marker) => normalizeToken(token).includes(marker)),
  )
  if (markerIndex <= 0) return { firstName: givenName, role: '' }
  return {
    firstName: tokens.slice(0, markerIndex).join(' '),
    role: tokens.slice(markerIndex).join(' '),
  }
}

function splitName(
  candidate: string,
  splitRoles: boolean,
): { firstName: string; lastName: string; role: string } {
  const tokens = candidate.split(/\s+/).filter(Boolean)
  const commaIndex = tokens.findIndex(hasComma)

  if (commaIndex >= 0) {
    const lastName = tokens
      .slice(0, commaIndex + 1)
      .join(' ')
      .replace(/,/g, '')
      .trim()
    const givenRaw = tokens.slice(commaIndex + 1).join(' ')
    if (splitRoles) {
      const { firstName, role } = stripRoleSuffix(givenRaw)
      return { firstName, lastName, role }
    }
    return { firstName: givenRaw, lastName, role: '' }
  }

  const particleIndex = tokens.findIndex(
    (token, index) => index > 0 && isSurnameParticle(token),
  )
  if (particleIndex > 0) {
    return {
      firstName: tokens.slice(0, particleIndex).join(' '),
      lastName: tokens.slice(particleIndex).join(' '),
      role: '',
    }
  }

  const lastToken = tokens[tokens.length - 1]
  if (SUFFIXES.has(lastToken.toUpperCase()) && tokens.length > 2) {
    return {
      lastName: tokens[0],
      firstName: tokens.slice(1).join(' '),
      role: '',
    }
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(' '),
    role: '',
  }
}

function splitColumns(items: ExtractedTextItem[]): ExtractedTextItem[][] {
  const hasRight = items.some((i) => i.x >= COLUMN_SPLIT_X)
  if (!hasRight) return [items]
  return [
    items.filter((i) => i.x < COLUMN_SPLIT_X),
    items.filter((i) => i.x >= COLUMN_SPLIT_X),
  ]
}

function toLines(column: ExtractedTextItem[]): string[] {
  const groups = new Map<number, ExtractedTextItem[]>()
  for (const item of column) {
    const y = Math.round(item.y)
    const bucket = groups.get(y)
    if (bucket) bucket.push(item)
    else groups.set(y, [item])
  }
  const ys = [...groups.keys()].sort((a, b) => b - a)
  return ys.map((y) =>
    collapseSpaces(
      groups
        .get(y)!
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str)
        .join(' '),
    ),
  )
}

export function parseRosterPages(
  pages: ExtractedTextItem[][],
  voices: VoicePosition[],
  members: Member[],
  trainees: Trainee[],
): RosterCandidate[] {
  const existing = buildExistingSet(members, trainees)
  const seen = new Set<string>()
  const candidates: RosterCandidate[] = []
  let section: SectionInfo | null = null
  let pendingStatus: 'active' | 'inactive' | undefined

  for (const page of pages) {
    for (const column of splitColumns(page)) {
      for (const line of toLines(column)) {
        if (!line) continue

        if (line === line.toUpperCase()) {
          const asSection = recognizeSection(collapseSpaces(line), voices)
          if (asSection) {
            section = asSection
            pendingStatus = undefined
            continue
          }
        }

        if (!section) continue

        const raw = line
          .split(/\s+/)
          .filter((token) => token && token !== '–' && token !== '-')

        const hasNumber = raw.some(isNumberToken)

        const isSingleLetter = (token: string) =>
          token.replace(/\./g, '').length === 1

        const meaningful = raw.filter((token) => {
          const upper = token.toUpperCase()
          return (
            !isNumberToken(token) &&
            upper !== 'ACTIVE' &&
            upper !== 'INACTIVE' &&
            upper !== 'BALIK-TUNGKULIN'
          )
        })
        const keepSingleLetters = meaningful.filter(isSingleLetter).length === meaningful.length

        let nameTokens: string[] = []
        let status: 'active' | 'inactive' | undefined
        let notes: string[] = []

        for (const token of raw) {
          const upper = token.toUpperCase()
          if (isNumberToken(token) || upper === 'ACTIVE' || upper === 'INACTIVE') {
            if (upper === 'ACTIVE') status = 'active'
            else if (upper === 'INACTIVE') status = 'inactive'
          } else if (upper === 'BALIK-TUNGKULIN') {
            notes.push('Balik-Tungkulin')
          } else if (isSingleLetter(token) && !keepSingleLetters) {
            // Drop stray single-letter markers (e.g. "D" in "Dalendeg, Lyka D ...").
          } else {
            nameTokens.push(token)
          }
        }

        const commaIndex = nameTokens.findIndex(hasComma)
        let name = nameTokens.join(' ')
        if (commaIndex >= 0) {
          name = nameTokens.slice(0, commaIndex + 1).join(' ').replace(/,+$/, '').trim()
          const givenPart = nameTokens.slice(commaIndex + 1).join(' ')
          if (givenPart) name = `${name}, ${givenPart}`
        }

        if (!nameTokens.length) {
          if (hasNumber && status) {
            const last = candidates[candidates.length - 1]
            if (last) last.isActive = status !== 'inactive'
          } else if (!hasNumber && status) {
            pendingStatus = status
          }
          continue
        }

        if (!looksLikeName(name)) continue

        const effectiveStatus = status ?? pendingStatus
        pendingStatus = undefined

        const splitRoles = section.kind === 'leaders' || section.kind === 'organista'
        const { firstName, lastName, role } = splitName(name, splitRoles)
        if (role) notes.push(role)
        if (!firstName || !lastName) continue

        const key = normalizeNameKey(lastName, firstName)
        const duplicate = seen.has(key) || existing.has(key)
        seen.add(key)

        let gender: 'male' | 'female' = section.gender ?? 'female'
        let voicePosition = section.kind === 'voice' ? section.voiceId ?? '' : ''
        if (splitRoles) {
          const match = existing.get(key)
          if (match) {
            gender = match.gender
            voicePosition = match.voicePosition
          }
        }

        candidates.push({
          id: nanoid(),
          section: section.title,
          isTrainee: section.kind === 'trainee',
          firstName,
          lastName,
          gender,
          voicePosition,
          isActive: effectiveStatus !== 'inactive',
          notes: appendNote('', notes.join(' ')),
          duplicate,
          selected: !duplicate,
        })
      }
    }
  }

  return candidates
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  }
  return pdfjs
}

export async function extractRosterFromPdf(
  file: File,
  voices: VoicePosition[],
  members: Member[],
  trainees: Trainee[],
): Promise<RosterParseResult> {
  const pdfjs = await loadPdfjs()
  const buffer = await file.arrayBuffer()
  const document = await pdfjs.getDocument({ data: buffer }).promise

  const pages: ExtractedTextItem[][] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const items: ExtractedTextItem[] = []
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        items.push({
          x: item.transform[4],
          y: item.transform[5],
          str: item.str,
        })
      }
    }
    pages.push(items)
  }

  return {
    candidates: parseRosterPages(pages, voices, members, trainees),
    pageCount: document.numPages,
  }
}