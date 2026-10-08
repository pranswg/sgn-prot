import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { ArrowDown, ArrowUp, CalendarDays, Copy, Eye, FileDown, FileText, GripVertical, Music4, Pencil, Piano, Plus, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reorderList } from '@/lib/reorderList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { DisclosureButton, DocumentSetupStep } from '@/features/suguan-builder/DocumentSetupStep'
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
import { useWorshipScheduleStore } from '@/store/worshipScheduleStore'
import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import { MemberPicker } from './memberPicker'
import {
  SchedulePicker,
  type SelectedWorshipSchedule,
} from './schedulePicker'
import {
  createServiceFromSchedule,
  servicesFromCategories,
} from './organistaSuguanService'
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

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'LINGGO',
  3: 'MIYERKULES',
  4: 'HUWEBES',
  6: 'SABADO',
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
  const [services, setServices] = useState<OrganistaService[]>(() => {
    const { midweek, weekend } = useWorshipScheduleStore.getState()
    return servicesFromCategories({
      midweek: midweek.filter((s) => !s.disabled),
      weekend: weekend.filter((s) => !s.disabled),
    })
  })
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
  const [documentSetupOpen, setDocumentSetupOpen] = useState(false)
  const [dragServiceId, setDragServiceId] = useState<string | null>(null)
  const [overServiceId, setOverServiceId] = useState<string | null>(null)
  const [newServiceId, setNewServiceId] = useState<string | null>(null)
  const [schedulePicker, setSchedulePicker] = useState<
    | { mode: 'add' }
    | { mode: 'replace'; serviceId: string }
    | null
  >(null)
  const newServiceCardRef = useRef<HTMLDivElement>(null)

  const takenScheduleIds = useMemo(
    () =>
      new Set(
        services
          .map((service) => service.scheduleId)
          .filter((id): id is string => Boolean(id)),
      ),
    [services],
  )
  const currentPickedScheduleId =
    schedulePicker?.mode === 'replace'
      ? services.find((service) => service.id === schedulePicker.serviceId)
          ?.scheduleId
      : undefined

  useEffect(() => {
    if (!newServiceId) return
    newServiceCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    newServiceCardRef.current?.querySelector('input')?.focus()
  }, [newServiceId])

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
    field: 'organist' | 'reserve',
    value: string,
  ) => {
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, [field]: value } : service,
      ),
    )
  }

  const confirmSchedulePick = (selection: SelectedWorshipSchedule) => {
    if (!schedulePicker) return
    if (schedulePicker.mode === 'add') {
      const service = createServiceFromSchedule(
        selection.schedule,
        selection.category,
      )
      setServices((current) => [...current, service])
      setNewServiceId(service.id)
      setSchedulePicker(null)
      toast.success(`Added ${selection.schedule.scheduleTime} service.`)
      return
    }
    setServices((current) =>
      current.map((service) =>
        service.id === schedulePicker.serviceId
          ? {
              ...createServiceFromSchedule(
                selection.schedule,
                selection.category,
              ),
              id: service.id,
              organist: service.organist,
              reserve: service.reserve,
            }
          : service,
      ),
    )
    setSchedulePicker(null)
    toast.success('Worship schedule updated.')
  }

  const duplicateService = (id: string) => {
    setServices((current) => {
      const index = current.findIndex((service) => service.id === id)
      if (index === -1) return current
      const copy = { ...current[index], id: nanoid() }
      const next = [...current]
      next.splice(index + 1, 0, copy)
      return next
    })
  }

  const removeService = (id: string) => {
    setServices((current) =>
      current.length > 1 ? current.filter((item) => item.id !== id) : current,
    )
  }

  const moveService = (id: string, direction: -1 | 1) => {
    const from = services.findIndex((service) => service.id === id)
    const toIndex = from + direction
    if (from === -1 || toIndex < 0 || toIndex >= services.length) return
    setServices(reorderList(services, id, toIndex))
  }

  const moveServiceTo = (id: string, toIndex: number) => {
    if (!services.some((service) => service.id === id)) return
    setServices(reorderList(services, id, toIndex))
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
            <Piano className="size-5" />
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
              placeholder="e.g. Templo Central"
            />
          </div>

          <div className="mt-6">
            <DisclosureButton
              open={coverageOpen}
              onToggle={() => setCoverageOpen((o) => !o)}
              icon={CalendarDays}
            >
              Coverage
            </DisclosureButton>

            {coverageOpen && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Pick the Pagsasanay date — the Wednesday, Thursday, Saturday, and
                  Sunday services of that week are derived automatically.
                </p>
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
              </div>
            )}
          </div>

          <div className="mt-6">
            <DisclosureButton
              open={documentSetupOpen}
              onToggle={() => setDocumentSetupOpen((o) => !o)}
              icon={FileText}
            >
              Document setup
            </DisclosureButton>

            {documentSetupOpen && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  These document options are applied to the exported PDF.
                </p>
                <DocumentSetupStep
                  value={docFormat}
                  onChange={setDocFormat}
                  embedded
                />
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Schedule rows</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSchedulePicker({ mode: 'add' })}
            >
              <Plus className="size-4" />
              Add Worship Schedule
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Services come from the Worship Service Schedule Settings. Changing a
            schedule there affects new picks; saved records keep theirs.
          </p>

          <div className="mt-4 space-y-4">
            {services.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
                <Music4 className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No worship schedules are enabled. Add worship schedules in
                  Settings, or build a service list from the current settings.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSchedulePicker({ mode: 'add' })}
                >
                  <Plus className="size-4" />
                  Add Worship Schedule
                </Button>
              </div>
            )}
            {services.map((service, index) => (
              <div
                key={service.id}
                ref={service.id === newServiceId ? newServiceCardRef : undefined}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  if (dragServiceId && dragServiceId !== service.id) {
                    setOverServiceId(service.id)
                  }
                }}
                onDragLeave={() => {
                  if (overServiceId === service.id) setOverServiceId(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragServiceId && dragServiceId !== service.id) {
                    moveServiceTo(dragServiceId, index)
                  }
                  setDragServiceId(null)
                  setOverServiceId(null)
                }}
                className={cn(
                  'rounded-lg border border-border/70 bg-background/80 p-3 transition-colors',
                  overServiceId === service.id &&
                    'border-primary ring-1 ring-primary',
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Service {index + 1}
                  </p>
                  {services.length > 1 && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Move up"
                        aria-label={`Move ${service.heading || `Service ${index + 1}`} up`}
                        disabled={index === 0}
                        onClick={() => moveService(service.id, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Move down"
                        aria-label={`Move ${service.heading || `Service ${index + 1}`} down`}
                        disabled={index === services.length - 1}
                        onClick={() => moveService(service.id, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Drag to reorder"
                        aria-label={`Drag ${service.heading || `Service ${index + 1}`} to reorder`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', service.id)
                          setDragServiceId(service.id)
                        }}
                        onDragEnd={() => {
                          setDragServiceId(null)
                          setOverServiceId(null)
                        }}
                      >
                        <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Duplicate service"
                        aria-label={`Duplicate ${service.heading || `Service ${index + 1}`}`}
                        onClick={() => duplicateService(service.id)}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${service.heading}`}
                        onClick={() => removeService(service.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mb-4 border-t border-border/70 pt-3">
                  {service.dayName ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSchedulePicker({
                          mode: 'replace',
                          serviceId: service.id,
                        })
                      }
                      aria-label={`Change the worship schedule of ${service.heading}`}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-left transition-colors hover:border-primary/50"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">
                          {service.dayName}
                        </span>
                        <span className="block text-lg leading-tight font-semibold text-foreground">
                          {service.scheduleTime}
                        </span>
                        {service.categoryLabel && (
                          <span className="mt-0.5 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {service.categoryLabel}
                          </span>
                        )}
                      </span>
                      <Pencil className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                      {service.heading}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`service-organist-${service.id}`}>Organista</Label>
                    <MemberPicker
                      id={`service-organist-${service.id}`}
                      label="Organista"
                      value={service.organist}
                      onChange={(name) =>
                        updateService(service.id, 'organist', name)
                      }
                      exclude={[service.reserve]}
                      placeholder="Select Organista…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`service-reserve-${service.id}`}>Reserba</Label>
                    <MemberPicker
                      id={`service-reserve-${service.id}`}
                      label="Backup Organista"
                      value={service.reserve}
                      onChange={(name) =>
                        updateService(service.id, 'reserve', name)
                      }
                      exclude={[service.organist]}
                      allowNA
                      placeholder="Select backup Organista…"
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

        <SchedulePicker
          open={schedulePicker !== null}
          confirmLabel={
            schedulePicker?.mode === 'replace' ? 'Change Schedule' : 'Add Schedule'
          }
          takenScheduleIds={takenScheduleIds}
          currentScheduleId={currentPickedScheduleId}
          onClose={() => setSchedulePicker(null)}
          onConfirm={confirmSchedulePick}
        />
        </div>
  )
}