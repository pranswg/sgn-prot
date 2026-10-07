import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Eye, FileDown, Music4, PenLine, Plus, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { toast } from 'sonner'
import { DocumentSetupStep } from '@/features/suguan-builder/DocumentSetupStep'
import type { SuguanDocFormat } from '@/core/types/suguan'
import {
  DEFAULT_DOC_FORMAT,
  docMarginsMm,
  docPaperDimensionsMm,
  normalizeDocFormat,
  resolveFontSizePreset,
  worshipWeekFromRehearsal,
} from '@/lib/suguanUtils'
import { formatDateKeyNumeric, weekdayOf } from '@/lib/phDate'
import { fullName } from '@/lib/format'
import { useMemberStore } from '@/store/memberStore'
import { useOrganistaSuguanStore } from '@/store/organistaSuguanStore'
import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import segoeScriptUrl from '@/assets/fonts/SegoeScript.ttf'

let segoeScriptBase64: string | null = null
async function segoeScriptBase64Once(): Promise<string> {
  if (segoeScriptBase64) return segoeScriptBase64
  const bytes = new Uint8Array(await (await fetch(segoeScriptUrl)).arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  segoeScriptBase64 = btoa(binary)
  return segoeScriptBase64
}
import { organistaDateLabel } from './organistaDateLabel'

type OrganistaService = OrganistaSuguanService

const createService = (heading: string): OrganistaService => ({
  id: crypto.randomUUID(),
  heading,
  organist: '',
  reserve: '',
})

const defaultServices = (): OrganistaService[] => [
  createService('Wednesday 7:00 pm'),
  createService('Thursday 6:00 am'),
  createService('Thursday 7:00 pm'),
  createService('Saturday 6:00 pm'),
  createService('Sunday 6:00 am'),
  createService('PNK Sunday 8:00 am'),
  createService('Sunday 10:00 am'),
]

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'LINGGO',
  3: 'MIYERKULES',
  4: 'HUWEBES',
  6: 'SABADO',
}

/** Collapsible section header so the page stays short until a group is needed. */
function SectionDisclosure({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string
  description: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="mt-6 border-t border-border/70 pt-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </span>
        <ChevronDown
          className={cn(
            'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  )
}

/**
 * A name field that stays free-text but offers a dropdown that looks exactly
 * like the Special Duties member `Select` in step 3 of the Suguan maker, with
 * these additions: only Master List members holding the Organista (or ATPA
 * / Assistant Tagapagturo) position are offered, the list filters as the user
 * types, the pinned N/A entry stores the literal "N/A" so it shows in the
 * field and on the printed sheet (it no longer clears), and names in
 * `exclude` are hidden so the same person cannot be picked for both halves of
 * a service at once.
 *
 * The popover is driven manually (`PopoverAnchor` + `open` state) instead of
 * through `PopoverTrigger`, because a trigger toggles closed on the very click
 * that focuses the input, making the hybrid box feel read-only. The dropdown
 * only opens below the field, never above.
 */
function MemberCombobox({
  id,
  value,
  onChange,
  exclude,
  placeholder = 'Type a name or pick an Organista / ATPA member',
}: {
  id: string
  value: string
  onChange: (name: string) => void
  exclude: string[]
  placeholder?: string
}) {
  const members = useMemberStore((state) => state.members)
  const [open, setOpen] = useState(false)
  const [contentWidth, setContentWidth] = useState(0)
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openCombobox = () => {
    setContentWidth(anchorRef.current?.offsetWidth ?? 0)
    setOpen(true)
  }

  // Focuses the field so a name outside the Master List can be typed, with the
  // existing text highlighted so typing replaces it rather than appending.
  const focusTyping = () => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  const currentKey = value.trim().toLowerCase()
  const isNA = currentKey === 'n/a'

  const options = useMemo(() => {
    const query = isNA ? '' : currentKey
    const taken = new Set(exclude.map((name) => name.trim().toLowerCase()))
    return members
      .filter(
        (member) =>
          member.isActive &&
          member.positions.some(
            (position) =>
              position === 'organista' || position === 'assistant-tagapagturo',
          ),
      )
      .map((member) => fullName(member.firstName, member.lastName))
      .filter((name) => name.trim().toLowerCase() !== query)
      .filter((name) => !taken.has(name.trim().toLowerCase()))
      .filter((name) => (query ? name.toLowerCase().includes(query) : true))
      .sort((a, b) => a.localeCompare(b))
  }, [members, currentKey, isNA, exclude])

  // Mirrors the `SelectItem` styling in the Special Duties panel (step 3).
  const itemClasses =
    'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm select-none hover:bg-accent hover:text-accent-foreground'

  const selectName = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            onClick={openCombobox}
            className="relative"
          >
            <Input
              id={id}
              ref={inputRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onFocus={openCombobox}
              onBlur={() => setOpen(false)}
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              className="pr-9"
            />
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="end"
          side="bottom"
          avoidCollisions={false}
          className="max-h-72 min-w-36 gap-0 overflow-y-auto rounded-lg p-1"
          style={contentWidth > 0 ? { width: contentWidth } : undefined}
          onMouseDown={(event) => event.preventDefault()}
        >
            <button
              type="button"
              onClick={focusTyping}
              className={itemClasses}
            >
              <PenLine className="size-4 shrink-0 text-muted-foreground" />
              Type a name…
            </button>
            <div className="pointer-events-none mx-1 my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => selectName('N/A')}
              className={cn(
                itemClasses,
                isNA && 'bg-accent text-accent-foreground',
              )}
            >
              N/A
              {isNA && (
                <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                  <Check className="size-4" />
                </span>
              )}
            </button>
            <div className="pointer-events-none mx-1 my-1 h-px bg-border" />
            {options.length === 0 ? (
              <div className="py-1 pr-8 pl-1.5 text-sm text-muted-foreground">
                {isNA
                  ? 'No Organista or ATPA members in the Master List'
                  : currentKey
                    ? `No members match "${value.trim()}"`
                    : 'No Organista or ATPA members in the Master List'}
              </div>
            ) : (
              options.map((name) => {
                const isCurrent = name.toLowerCase() === currentKey
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectName(name)}
                    className={cn(
                      itemClasses,
                      isCurrent && 'bg-accent text-accent-foreground',
                    )}
                  >
                    {name}
                    {isCurrent && (
                      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                        <Check className="size-4" />
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </PopoverContent>
        </Popover>
    </div>
  )
}

export async function buildOrganistaSuguanPdf(
  churchName: string,
  pagsasanayDate: string,
  services: OrganistaService[],
  format: SuguanDocFormat,
  pmName: string,
  destinadoName: string,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')

  const normalizedFormat = normalizeDocFormat(format)
  const dimensions = docPaperDimensionsMm(normalizedFormat)
  const margins = docMarginsMm(normalizedFormat)
  const fontPreset = resolveFontSizePreset(normalizedFormat)
  const dateLine = organistaDateLabel(pagsasanayDate)
  const scriptFontSizePt = fontPreset.headerFontSize * 1.4
  const churchFontSizePt = fontPreset.headerFontSize * 1.25
  const dateFontSizePt = fontPreset.headerFontSize * 1.05
  const ptToMm = 25.4 / 72
  const churchLineHeight = churchFontSizePt * ptToMm * 1.1
  const scriptLineHeight = scriptFontSizePt * ptToMm * 1.1
  const dateLineHeight = dateLine ? dateFontSizePt * ptToMm * 1.1 : 0
  const headingGap = 0.4
  const headingHeight =
    churchLineHeight +
    scriptLineHeight +
    dateLineHeight +
    headingGap * (dateLine ? 2 : 1)
  const serviceHeadingHeight = fontPreset.headerFontSize * 0.42 + 2
  const headerRowHeight = Math.max(8.5, fontPreset.smallFontSize * 0.42 * 2 + 1)
  const rowHeight = Math.max(8, fontPreset.bodyFontSize * 0.72)
  const serviceGap = 2.5
  const signatureNameHeight = Math.max(8, fontPreset.bodyFontSize * 0.8)
  const signatureRoleHeight = Math.max(5, fontPreset.smallFontSize * 0.5)
  const signatureHeight = signatureNameHeight + signatureRoleHeight + 4
  const signatureGapMm = 16
  const contentHeight =
    headingHeight +
    3 +
    services.length * (serviceHeadingHeight + headerRowHeight + rowHeight * 2 + serviceGap) +
    signatureGapMm +
    signatureHeight
  const availableHeight =
    dimensions.height - margins.top - margins.bottom
  const autoScale =
    contentHeight <= availableHeight ? 1 : availableHeight / contentHeight
  const scale =
    normalizedFormat.scaling === 'fit-page'
      ? Math.min(1, autoScale)
      : normalizedFormat.scaling === 'auto' && autoScale >= 0.62
        ? autoScale
        : 1

  const pdf = new jsPDF({
    orientation: normalizedFormat.orientation,
    unit: 'mm',
    format: [dimensions.width, dimensions.height],
  })

  // The script heading is real text, not a raster. Register the same
  // Segoe Script the preview would use; if the file cannot be fetched,
  // fall back to a built-in serif rather than dropping the heading.
  let scriptFontName = 'times'
  let scriptFontStyle = 'bold'
  try {
    pdf.addFileToVFS('SegoeScript.ttf', await segoeScriptBase64Once())
    pdf.addFont('SegoeScript.ttf', 'SegoeScript', 'normal')
    scriptFontName = 'SegoeScript'
    scriptFontStyle = 'normal'
  } catch {
    // keep the built-in fallback
  }

  const pageWidth = dimensions.width
  const pageHeight = dimensions.height
  const contentWidth = pageWidth - margins.left - margins.right
  const centerX = pageWidth / 2
  let y = margins.top

  pdf.setDrawColor(0, 0, 0)
  pdf.setTextColor(0, 0, 0)
  pdf.setLineWidth(0.2)
  const drawPageHeading = () => {
    let headingY = margins.top + churchLineHeight * scale / 2
    pdf.setFont('times', 'normal')
    pdf.setFontSize(churchFontSizePt * scale)
    const churchLine = churchName.trim()
    if (churchLine) {
      pdf.text(`Lokal ng ${churchLine}`, centerX, headingY, {
        align: 'center',
        baseline: 'middle',
      })
    }
    headingY +=
      (churchLineHeight / 2 + headingGap + scriptLineHeight / 2) * scale

    pdf.setFont(scriptFontName, scriptFontStyle)
    pdf.setFontSize(scriptFontSizePt * scale)
    pdf.text('SUGUAN NG MGA ORGANISTA', centerX, headingY, {
      align: 'center',
      baseline: 'middle',
      maxWidth: contentWidth,
    })
    headingY +=
      (scriptLineHeight / 2 + headingGap + dateLineHeight / 2) * scale

    if (dateLine) {
      pdf.setFont('times', 'normal')
      pdf.setFontSize(dateFontSizePt * scale)
      pdf.text(dateLine, centerX, headingY, {
        align: 'center',
        baseline: 'middle',
        maxWidth: contentWidth,
      })
      headingY += dateLineHeight / 2 * scale
    }
    return headingY + 3 * scale
  }
  y = drawPageHeading()

  const topRowHeight = headerRowHeight * scale
  const scaledRowHeight = rowHeight * scale
  const columnWidths = [0.12, 0.28, 0.2, 0.2, 0.2].map(
    (ratio) => contentWidth * ratio,
  )
  const headers = [
    '',
    'Pangalan',
    'Contact Number',
    'Lagda sa Pagtanggap',
    'Lagda sa Pagtupad',
  ]

  const drawHeaders = (top: number) => {
    let x = margins.left
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(fontPreset.smallFontSize * scale)
    const lineHeight = fontPreset.smallFontSize * 0.42 * scale
    for (let index = 0; index < headers.length; index++) {
      const width = columnWidths[index]
      pdf.rect(x, top, width, topRowHeight)
      const lines = pdf.splitTextToSize(headers[index].toUpperCase(), width - 2)
      if (lines.length > 0 && lines[0] !== '') {
        const textHeight = lines.length * lineHeight
        pdf.text(lines, x + width / 2, top + (topRowHeight - textHeight) / 2 + lineHeight * 0.8, {
          align: 'center',
        })
      }
      x += width
    }
  }

  const serviceHeight =
    serviceHeadingHeight * scale + topRowHeight + scaledRowHeight * 2 + serviceGap * scale
  const scaledSignatureHeight = signatureHeight * scale

  for (const service of services) {
    if (y + serviceHeight > pageHeight - margins.bottom) {
      pdf.addPage([dimensions.width, dimensions.height], normalizedFormat.orientation)
      y = await drawPageHeading()
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(fontPreset.headerFontSize * scale)
    pdf.text((service.heading || 'Service').toUpperCase(), margins.left, y + serviceHeadingHeight * scale * 0.7)
    y += serviceHeadingHeight * scale
    drawHeaders(y)
    y += topRowHeight

    const rows = [
      { label: 'Organista', value: service.organist },
      { label: 'Reserba', value: service.reserve },
    ]

    for (const row of rows) {
      const rowTop = y
      let cellX = margins.left
      for (let index = 0; index < columnWidths.length; index++) {
        const width = columnWidths[index]
        pdf.rect(cellX, rowTop, width, scaledRowHeight)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(fontPreset.smallFontSize * scale)
        if (index === 0) {
          pdf.setFont('helvetica', 'normal')
          pdf.text(
            row.label.toUpperCase(),
            cellX + 2,
            rowTop + scaledRowHeight * 0.67,
            { maxWidth: width - 4 },
          )
        } else if (index === 1 && row.value.trim()) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(fontPreset.bodyFontSize * scale)
          pdf.text(
            row.value,
            cellX + 2,
            rowTop + scaledRowHeight * 0.67,
            { maxWidth: width - 4 },
          )
        }
        cellX += width
      }
      y += scaledRowHeight
    }
    y += serviceGap * scale
  }

  if (
    y + signatureGapMm * scale + scaledSignatureHeight >
    pageHeight - margins.bottom
  ) {
    pdf.addPage([dimensions.width, dimensions.height], normalizedFormat.orientation)
    y = await drawPageHeading()
  }

  const signatureColumnWidth = contentWidth / 2
  const signatureCenters = [
    margins.left + signatureColumnWidth / 2,
    margins.left + signatureColumnWidth * 1.5,
  ]
  const signatureNames = [pmName, destinadoName]
  const signatureRoles = ['PANGULONG MANG-AAWIT', 'DESTINADO']
  const nameY = y + signatureGapMm * scale

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(fontPreset.bodyFontSize * scale)
  for (let index = 0; index < signatureNames.length; index++) {
    const center = signatureCenters[index]
    const name = signatureNames[index].trim()
    pdf.text(name, center, nameY, {
      align: 'center',
      baseline: 'middle',
      maxWidth: signatureColumnWidth - 8,
    })
    const nameWidth = name
      ? Math.min(pdf.getTextWidth(name), signatureColumnWidth - 8)
      : 34 * scale
    pdf.setLineWidth(0.25)
    pdf.line(
      center - nameWidth / 2 - 2 * scale,
      nameY + signatureNameHeight * scale / 2,
      center + nameWidth / 2 + 2 * scale,
      nameY + signatureNameHeight * scale / 2,
    )
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(fontPreset.smallFontSize * scale)
    pdf.text(signatureRoles[index], center, nameY + signatureNameHeight * scale + signatureRoleHeight * scale / 2, {
      align: 'center',
      baseline: 'middle',
    })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(fontPreset.bodyFontSize * scale)
  }

  return pdf.output('blob')
}

export function OrganistaSuguanMakerPage() {
  const [churchName, setChurchName] = useState('')
  const [destinadoName, setDestinadoName] = useState('')
  const [services, setServices] = useState<OrganistaService[]>(() => defaultServices())
  const createRecord = useOrganistaSuguanStore((state) => state.createRecord)
  const members = useMemberStore((state) => state.members)
  const pmMember = members.find(
    (member) =>
      member.isActive && member.positions.includes('pangulong-mang-aawit'),
  )
  const pmName = pmMember
    ? fullName(pmMember.firstName, pmMember.lastName)
    : ''
  const activeMemberNames = members
    .filter((member) => member.isActive)
    .map((member) => fullName(member.firstName, member.lastName))
  const [docFormat, setDocFormat] = useState<SuguanDocFormat>({
    ...DEFAULT_DOC_FORMAT,
    fontSize: 'large',
  })
  const [pagsasanayDate, setPagsasanayDate] = useState('')
  const [coverageOpen, setCoverageOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)

  const week = useMemo(
    () => worshipWeekFromRehearsal(pagsasanayDate),
    [pagsasanayDate],
  )
  const weekDates = useMemo(
    () =>
      week ? [week.wednesday, week.thursday, week.saturday, week.sunday] : [],
    [week],
  )
  const dateHeading = organistaDateLabel(pagsasanayDate)

  const updatePagsasanayDate = (value: string) => {
    setPagsasanayDate(value)
  }

  const requirePagsasanayDate = () => {
    if (dateHeading) return true
    setCoverageOpen(true)
    toast.error('Choose a Petsa ng Pagsasanay date before previewing or exporting.')
    return false
  }

  const updateService = (
    id: string,
    field: 'heading' | 'organist' | 'reserve',
    value: string,
  ) => {
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, [field]: value } : service,
      ),
    )
  }

  const addService = () => {
    setServices((current) => [...current, createService(`Service ${current.length + 1}`)])
  }

  const removeService = (id: string) => {
    setServices((current) =>
      current.length > 1 ? current.filter((item) => item.id !== id) : current,
    )
  }

  const exportPdf = async () => {
    if (!requirePagsasanayDate()) return
    try {
      const blob = await buildOrganistaSuguanPdf(
        churchName,
        pagsasanayDate,
        services,
        docFormat,
        pmName,
        destinadoName,
      )
      const link = document.createElement('a')
      const fileUrl = URL.createObjectURL(blob)
      link.href = fileUrl
      const trimmedChurch = churchName.trim()
      link.download = `${(trimmedChurch ? trimmedChurch : 'Lokal')
        .replace(/\s+/g, '-')
        .toUpperCase()}-Organista-Suguan.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
      toast.success('Organist Suguan PDF exported.')
    } catch (error) {
      console.error(error)
      toast.error('Could not export the Organist Suguan PDF.')
    }
  }

  const saveToHistory = () => {
    if (!requirePagsasanayDate()) return
    createRecord({
      churchName: churchName.trim(),
      pagsasanayDate,
      services,
      docFormat,
      pangulongMangaawitName: pmName,
      destinadoName,
    })
    toast.success('Organist Suguan saved to history.')
  }

  const previewPdf = async () => {
    if (!requirePagsasanayDate()) return
    const previewWindow = window.open('', '_blank')

    if (!previewWindow) {
      toast.error('Allow pop-ups to preview the Organist Suguan PDF.')
      return
    }

    let pdfUrl: string | null = null
    let viewerUrl: string | null = null
    try {
      const blob = await buildOrganistaSuguanPdf(
        churchName,
        pagsasanayDate,
        services,
        docFormat,
        pmName,
        destinadoName,
      )
      pdfUrl = URL.createObjectURL(blob)
      const previewTitle = `${churchName.trim() ? `${churchName.trim()} - ` : ''}Organist Suguan`
        .replace(/[&<>"]/g, (character) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
        })[character] ?? character)
      const viewerHtml = `<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${previewTitle}</title>
            <style>
              html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; }
              body { overflow: hidden; }
            </style>
          </head>
          <body>
            <iframe title="Organist Suguan PDF preview" src="${pdfUrl}"></iframe>
            <script>
              window.addEventListener('pagehide', () => {
                URL.revokeObjectURL(${JSON.stringify(pdfUrl)})
                URL.revokeObjectURL(location.href)
              }, { once: true })
            </script>
          </body>
        </html>`
      viewerUrl = URL.createObjectURL(
        new Blob([viewerHtml], { type: 'text/html' }),
      )
      previewWindow.location.replace(viewerUrl)
    } catch (error) {
      previewWindow.close()
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      if (viewerUrl) URL.revokeObjectURL(viewerUrl)
      console.error(error)
      toast.error('Could not create the Organist Suguan PDF preview.')
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand-navy text-white">
            <Music4 className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Organist Suguan
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a printable organist sign-up sheet in the same style as the reference PDF.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveToHistory}>
            <Save className="size-4" />
            Save to History
          </Button>
          <Button variant="outline" onClick={() => void previewPdf()}>
            <Eye className="size-4" />
            Preview
          </Button>
          <Button onClick={() => void exportPdf()}>
            <FileDown className="size-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="church-name">Locale Congregation Name</Label>
            <Input
              id="church-name"
              value={churchName}
              onChange={(event) => setChurchName(event.target.value)}
            />
          </div>

          <SectionDisclosure
            title="Coverage"
            description="Pick the Pagsasanay date — the Wednesday, Thursday, Saturday, and Sunday services of that week are derived automatically."
            open={coverageOpen}
            onToggle={() => setCoverageOpen((o) => !o)}
          >
            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,260px)_1fr] md:items-start">
              <div className="space-y-1.5">
                <Label htmlFor="organista-coverage-rehearsal-date">
                  Petsa ng Pagsasanay
                </Label>
                <Input
                  id="organista-coverage-rehearsal-date"
                  type="date"
                  value={pagsasanayDate}
                  onChange={(event) => updatePagsasanayDate(event.target.value)}
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>PDF date heading</Label>
                  <p
                    aria-live="polite"
                    className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground"
                  >
                    {dateHeading || 'Select a Pagsasanay date to set the heading.'}
                  </p>
                </div>
                {weekDates.length > 0 && week && (
                  <div className="flex flex-wrap gap-2">
                    {weekDates.map((date) => (
                      <div
                        key={date}
                        className={`rounded-md border px-3 py-2 text-xs ${
                          weekdayOf(date) === 6 || weekdayOf(date) === 0
                            ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                            : 'border-amber-300/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'
                        }`}
                      >
                        <span className="font-bold uppercase">
                          {WEEKDAY_LABELS[weekdayOf(date)]}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {formatDateKeyNumeric(date)}
                        </span>
                      </div>
                    ))}
                    <p className="w-full text-xs text-muted-foreground">
                      The PDF heading shows the date ranges as midweek and weekend.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </SectionDisclosure>

          <SectionDisclosure
            title="Paper & layout"
            description="These document options are applied to the exported PDF."
            open={layoutOpen}
            onToggle={() => setLayoutOpen((o) => !o)}
          >
            <DocumentSetupStep value={docFormat} onChange={setDocFormat} />
          </SectionDisclosure>

          <div className="mt-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Schedule rows</h2>
            <Button type="button" variant="outline" size="sm" onClick={addService}>
              <Plus className="size-4" />
              Add service
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="rounded-lg border border-border/70 bg-background/80 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Service {index + 1}
                  </p>
                  {services.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${service.heading}`}
                      onClick={() => removeService(service.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor={`service-heading-${service.id}`}>Service title</Label>
                    <Input
                      id={`service-heading-${service.id}`}
                      value={service.heading}
                      onChange={(event) =>
                        updateService(service.id, 'heading', event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`service-organist-${service.id}`}>Organista</Label>
                    <MemberCombobox
                      id={`service-organist-${service.id}`}
                      value={service.organist}
                      onChange={(name) =>
                        updateService(service.id, 'organist', name)
                      }
                      exclude={[service.reserve]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`service-reserve-${service.id}`}>Reserba</Label>
                    <MemberCombobox
                      id={`service-reserve-${service.id}`}
                      value={service.reserve}
                      onChange={(name) =>
                        updateService(service.id, 'reserve', name)
                      }
                      exclude={[service.organist]}
                      placeholder="Type a name, pick from the Master List, or N/A"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="mt-6 border-t border-border/70 pt-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Signatories</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These names appear beneath the Organista schedule in the exported PDF.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organista-pangulong-mang-aawit">
                  Pangulong Mang-aawit
                </Label>
                <Input
                  id="organista-pangulong-mang-aawit"
                  value={pmName || 'No active Pangulong Mang-aawit in Master List'}
                  readOnly
                  aria-readonly="true"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically taken from the active Master List member with this position.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="organista-destinado">Destinado</Label>
                <Input
                  id="organista-destinado"
                  list="organista-destinado-options"
                  value={destinadoName}
                  onChange={(event) => setDestinadoName(event.target.value)}
                  placeholder="Select or type a name…"
                />
                <datalist id="organista-destinado-options">
                  {activeMemberNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Choose a Master List member or enter a name manually.
                </p>
              </div>
            </div>
          </section>
        </div>

        </div>
  )
}
