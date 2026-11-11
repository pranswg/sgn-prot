import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { CalendarDays, Eye, FileDown, FileText, MapPin, Music4, PenLine, Plus, Save, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reorderList } from '@/lib/reorderList'
import { Button } from '@/components/ui/button'
import { DisclosureSection } from '@/components/DisclosureSection'
import { FieldCard, FieldCardGroup } from '@/components/FieldCard'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { DocumentSetupStep } from '@/features/suguan-builder/DocumentSetupStep'
import type { SuguanDocFormat } from '@/core/types/suguan'
import {
  DEFAULT_DOC_FORMAT,
  docMarginsMm,
  docPaperDimensionsMm,
  normalizeDocFormat,
  PAPER_SIZE_LABELS,
  resolveFontSizePreset,
  worshipWeekFromRehearsal,
} from '@/lib/suguanUtils'
import { formatDateKeyNumeric, weekdayOf } from '@/lib/phDate'
import { fullName } from '@/lib/format'
import { exportFileName } from '@/lib/exportNaming'
import { openPdfPreviewWindow, showPdfPreview } from '@/lib/pdfPreview'
import { useMemberStore } from '@/store/memberStore'
import { membersOf } from '@/lib/choirs'
import { useOrganistaSuguanStore } from '@/store/organistaSuguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import { resolvePmDutyRole } from '@/core/constants/dutyRoles'
import { memberHasRank } from '@/lib/memberRanks'
import { useWorshipScheduleStore } from '@/store/worshipScheduleStore'
import { useExportPreview } from '@/hooks/useExportPreview'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import { OrganistaServiceCard } from './OrganistaServiceCard'
import {
  SchedulePicker,
  type SelectedWorshipSchedule,
} from './schedulePicker'
import {
  createServiceFromSchedule,
  servicesFromCategories,
} from './organistaSuguanService'
import { buildOrganistaSuguanDocx } from './organistaSuguanDocx'
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
  const spacingBeforeMm =
    (normalizedFormat.tableSpacingBeforePt ?? 0) * ptToMm
  const spacingAfterMm =
    (normalizedFormat.tableSpacingAfterPt ?? 0) * ptToMm
  const tableSpacingMm = spacingBeforeMm + spacingAfterMm
  const churchLineHeight = churchFontSizePt * ptToMm * 1.1
  const scriptLineHeight = scriptFontSizePt * ptToMm * 1.1
  const dateLineHeight = dateLine ? dateFontSizePt * ptToMm * 1.1 : 0
  const headingGap = 0.4
  const headingHeight =
    churchLineHeight +
    scriptLineHeight +
    dateLineHeight +
    headingGap * (dateLine ? 2 : 1)
  const serviceHeadingBaseHeight = fontPreset.headerFontSize * 0.42 + 2
  const headerRowBaseHeight = Math.max(
    8.5,
    fontPreset.smallFontSize * 0.42 * 2 + 1,
  )
  const rowBaseHeight = Math.max(8, fontPreset.bodyFontSize * 0.72)
  const serviceGap = 2.5
  const signatureNameHeight = Math.max(8, fontPreset.bodyFontSize * 0.8)
  const signatureRoleHeight = Math.max(5, fontPreset.smallFontSize * 0.5)
  const signatureHeight = signatureNameHeight + signatureRoleHeight + 4
  const signatureGapMm = 16
  const contentHeight =
    headingHeight +
    3 +
    services.length *
      (serviceHeadingBaseHeight +
        headerRowBaseHeight +
        rowBaseHeight * 2 +
        serviceGap) +
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

  const topRowHeight = headerRowBaseHeight * scale
  const scaledRowHeight = rowBaseHeight * scale + tableSpacingMm
  const scaledServiceHeadingHeight = serviceHeadingBaseHeight * scale
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
    scaledServiceHeadingHeight +
    topRowHeight +
    scaledRowHeight * 2 +
    serviceGap * scale
  const scaledSignatureHeight = signatureHeight * scale

  for (const service of services) {
    if (y + serviceHeight > pageHeight - margins.bottom) {
      pdf.addPage([dimensions.width, dimensions.height], normalizedFormat.orientation)
      y = await drawPageHeading()
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(fontPreset.headerFontSize * scale)
    pdf.text(
      (service.heading || 'Service').toUpperCase(),
      margins.left,
      y + scaledServiceHeadingHeight * 0.7,
    )
    y += scaledServiceHeadingHeight
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
            rowTop +
              rowBaseHeight * scale * 0.67 +
              spacingBeforeMm,
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

/**
 * The Organist Suguan maker. Shares the Extra Occasion maker's layout
 * primitives (`occasion-page-header`, `occasion-form`, `occasion-field`,
 * `occasion-disclosure`, `occasion-actions` from `extraOccasion.css`) so both
 * document makers read as one screen: a title block, a card of fields, folded
 * document setup, the roster, and one sticky action bar.
 */
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
  const allMembers = useMemberStore((state) => state.members)
  const members = useMemo(() => membersOf(allMembers, 'aws'), [allMembers])
  const dutyRoles = useSettingsStore((state) => state.dutyRoles)
  const pmRole = resolvePmDutyRole(dutyRoles)
  const pmMember = members.find(
    (member) =>
      member.isActive &&
      pmRole !== undefined &&
      memberHasRank(member, pmRole.id, dutyRoles),
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
  const [documentSetupOpen, setDocumentSetupOpen] = useState(false)
  const [dragServiceId, setDragServiceId] = useState<string | null>(null)
  const [overServiceId, setOverServiceId] = useState<string | null>(null)
  const [newServiceId, setNewServiceId] = useState<string | null>(null)
  const [schedulePicker, setSchedulePicker] = useState<
    | { mode: 'add' }
    | { mode: 'replace'; serviceId: string }
    | null
  >(null)
  const newServiceCardRef = useRef<HTMLElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const { exportPreview, requestExport } = useExportPreview()

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
  const normalizedFormat = normalizeDocFormat(docFormat)
  const documentSummary = [
    PAPER_SIZE_LABELS[normalizedFormat.paperSize].short,
    normalizedFormat.orientation === 'portrait' ? 'Portrait' : 'Landscape',
    `${
      normalizedFormat.fontSize.charAt(0).toUpperCase() +
      normalizedFormat.fontSize.slice(1)
    } ${resolveFontSizePreset(normalizedFormat).bodyFontSize} pt`,
  ].join(' · ')
  const assignedCount = services.filter((service) =>
    service.organist.trim(),
  ).length

  const updatePagsasanayDate = (value: string) => {
    setPagsasanayDate(value)
  }

  const requirePagsasanayDate = () => {
    if (dateHeading) return true
    toast.error('Choose a Petsa ng Pagsasanay date before previewing or exporting.')
    dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    dateInputRef.current?.focus()
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

  const exportPdf = () => {
    if (!requirePagsasanayDate()) return
    const fileName = exportFileName('Organist Suguan', 'pdf')
    requestExport({
      filename: fileName,
      onConfirm: () => void runExportPdf(fileName),
    })
  }

  const exportDocx = () => {
    if (!requirePagsasanayDate()) return
    const fileName = exportFileName('Organist Suguan', 'docx')
    requestExport({
      filename: fileName,
      onConfirm: () => void runExportDocx(fileName),
    })
  }

  const runExportDocx = async (fileName: string) => {
    try {
      const blob = await buildOrganistaSuguanDocx(
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
      link.download = fileName
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
      toast.success('Organist Suguan Word document exported.')
    } catch (error) {
      console.error(error)
      toast.error('Could not export the Organist Suguan Word document.')
    }
  }

  const runExportPdf = async (fileName: string) => {
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
      link.download = fileName
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
    const previewWindow = openPdfPreviewWindow()
    if (!previewWindow) {
      toast.error('Allow pop-ups to preview the Organist Suguan PDF.')
      return
    }

    try {
      const blob = await buildOrganistaSuguanPdf(
        churchName,
        pagsasanayDate,
        services,
        docFormat,
        pmName,
        destinadoName,
      )
      showPdfPreview(
        previewWindow,
        blob,
        `${churchName.trim() ? `${churchName.trim()} - ` : ''}Organist Suguan`,
      )
    } catch (error) {
      previewWindow.close()
      console.error(error)
      toast.error('Could not create the Organist Suguan PDF preview.')
    }
  }

  const [saveOrganistSuguan, savingOrganistSuguan] = useAsyncAction(saveToHistory)
  const [previewOrganistSuguan, previewingOrganistSuguan] = useAsyncAction(previewPdf)
  const [exportOrganistSuguan, exportingOrganistSuguan] = useAsyncAction(exportPdf)

  const exportButtons = (
    <div className="grid min-w-0 grid-cols-2 gap-2 lg:flex lg:flex-wrap">
      <Button
        variant="outline"
        className="col-span-2 lg:col-auto"
        onClick={() => void previewOrganistSuguan()}
        loading={previewingOrganistSuguan}
        disabled={exportingOrganistSuguan}
      >
        <Eye className="size-4" />
        Preview PDF
      </Button>
      <Button
        variant="outline"
        onClick={() => void exportOrganistSuguan()}
        loading={exportingOrganistSuguan}
        disabled={previewingOrganistSuguan}
      >
        <FileDown className="size-4" />
        <span>
          <span className="hidden lg:inline">Export </span>
          PDF
        </span>
      </Button>
      <Button
        variant="outline"
        onClick={exportDocx}
        disabled={previewingOrganistSuguan || exportingOrganistSuguan}
      >
        <FileText className="size-4" />
        <span>
          <span className="hidden lg:inline">Export </span>
          Word
        </span>
      </Button>
    </div>
  )

  return (
    <div className="occasion-maker">
      {exportPreview}

      <header className="occasion-page-header">
        <div className="min-w-0">
          <h1>Organist Suguan</h1>
          <p className="truncate">
            {[
              churchName.trim() || 'No locale yet',
              dateHeading || 'Pagsasanay date not set',
            ].join(' · ')}
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline-flex">
          {services.length} {services.length === 1 ? 'service' : 'services'}
        </span>
      </header>

      <div className="occasion-form">
        <div className="grid min-w-0 gap-3 lg:grid-cols-2 lg:items-start">
          <FieldCardGroup className="occasion-field-group">
            <FieldCard
              icon={MapPin}
              label="Locale Congregation Name"
              tone="emerald"
              className="occasion-field"
            >
              <Input
                id="church-name"
                aria-label="Locale Congregation Name"
                className="h-10"
                value={churchName}
                onChange={(event) => setChurchName(event.target.value)}
                placeholder="e.g. Templo Central"
              />
            </FieldCard>

            <FieldCard
              icon={CalendarDays}
              label="Petsa ng Pagsasanay"
              tone="amber"
              className="occasion-field"
            >
              <div className="occasion-control">
                <Input
                  id="organista-coverage-rehearsal-date"
                  ref={dateInputRef}
                  type="date"
                  aria-label="Petsa ng Pagsasanay"
                  className="h-10"
                  value={pagsasanayDate}
                  onChange={(event) =>
                    updatePagsasanayDate(event.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {dateHeading
                    ? `Prints as ${dateHeading}`
                    : 'Pick a date to set the printed heading.'}
                </p>
                {weekDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {weekDates.map((date) => {
                      const weekend =
                        weekdayOf(date) === 6 || weekdayOf(date) === 0
                      return (
                        <span
                          key={date}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold',
                            weekend
                              ? 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
                          )}
                        >
                          {WEEKDAY_LABELS[weekdayOf(date)]}
                          <span className="font-normal opacity-70">
                            {formatDateKeyNumeric(date)}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </FieldCard>
          </FieldCardGroup>

          <FieldCardGroup className="occasion-field-group">
            <FieldCard
              icon={User}
              label="Pangulong Mang-aawit"
              tone="sky"
              className="occasion-field"
            >
              <div className="occasion-control">
                <Input
                  id="organista-pangulong-mang-aawit"
                  className="h-10"
                  aria-label="Pangulong Mang-aawit"
                  value={
                    pmName || 'No active Pangulong Mang-aawit in Master List'
                  }
                  readOnly
                  aria-readonly="true"
                />
                <p className="text-xs text-muted-foreground">
                  Taken from the active Master List member holding this
                  position.
                </p>
              </div>
            </FieldCard>

            <FieldCard
              icon={PenLine}
              label="Destinado"
              tone="violet"
              className="occasion-field"
            >
              <div className="occasion-control">
                <Input
                  id="organista-destinado"
                  list="organista-destinado-options"
                  aria-label="Destinado"
                  className="h-10"
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
            </FieldCard>
          </FieldCardGroup>
        </div>

        <DisclosureSection
          open={documentSetupOpen}
          onToggle={() => setDocumentSetupOpen((open) => !open)}
          icon={FileText}
          title="Document setup"
          summary={documentSummary}
          className="occasion-disclosure"
        >
          <div className="space-y-4 p-4">
            <p className="text-xs text-muted-foreground">
              Applies to the exported PDF and Word files.
            </p>
            <DocumentSetupStep
              value={docFormat}
              onChange={setDocFormat}
              embedded
              nameOnlyFontSize={false}
            />
          </div>
        </DisclosureSection>

        {/* Phones carry the export row here, under the sheet settings, rather
            than at the end of a long roster; the sticky bar keeps Save in reach
            while these stay one screen away. */}
        <div className="lg:hidden">{exportButtons}</div>

        <section
          aria-labelledby="organist-services-heading"
          className="flex flex-col gap-3"
        >
          <div className="occasion-roster-head">
            <div className="min-w-0">
              <h2 id="organist-services-heading">Schedule rows</h2>
              <p className="occasion-roster-count">
                {services.length}{' '}
                {services.length === 1 ? 'service' : 'services'} ·{' '}
                {assignedCount} with an Organista
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSchedulePicker({ mode: 'add' })}
            >
              <Plus className="size-4" />
              Add schedule
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Rows come from Worship Service Schedule Settings. Changing a
            schedule there affects new picks; saved records keep theirs.
          </p>

          {services.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
              <Music4 className="size-6 text-muted-foreground" />
              <p className="max-w-md text-sm text-muted-foreground">
                No worship schedules are enabled. Add worship schedules in
                Settings, or add a service row from the current settings.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSchedulePicker({ mode: 'add' })}
              >
                <Plus className="size-4" />
                Add schedule
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {services.map((service, index) => (
                <OrganistaServiceCard
                  key={service.id}
                  service={service}
                  index={index}
                  count={services.length}
                  dragging={dragServiceId === service.id}
                  dropTarget={overServiceId === service.id}
                  cardRef={
                    service.id === newServiceId ? newServiceCardRef : undefined
                  }
                  onOrganistChange={(name) =>
                    updateService(service.id, 'organist', name)
                  }
                  onReserveChange={(name) =>
                    updateService(service.id, 'reserve', name)
                  }
                  onChangeSchedule={() =>
                    setSchedulePicker({
                      mode: 'replace',
                      serviceId: service.id,
                    })
                  }
                  onMove={(direction) => moveService(service.id, direction)}
                  onDuplicate={() => duplicateService(service.id)}
                  onRemove={() => removeService(service.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', service.id)
                    setDragServiceId(service.id)
                  }}
                  onDragEnd={() => {
                    setDragServiceId(null)
                    setOverServiceId(null)
                  }}
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
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="occasion-actions">
        <div className="hidden lg:block">{exportButtons}</div>
        <div className="occasion-save-actions">
          <Button
            onClick={() => void saveOrganistSuguan()}
            loading={savingOrganistSuguan}
            disabled={previewingOrganistSuguan || exportingOrganistSuguan}
          >
            <Save className="size-4" />
            Save to History
          </Button>
        </div>
      </footer>

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
