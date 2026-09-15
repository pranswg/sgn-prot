import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  docMarginsMm,
  docPaperDimensionsMm,
  PAPER_SIZE_LABELS,
  FONT_SIZE_PRESETS,
} from '@/lib/suguanUtils'
import type {
  DocMargins,
  DocPaperSize,
  DocScaling,
  DocFontSize,
  SuguanDocFormat,
} from '@/core/types/suguan'

interface DocumentSetupStepProps {
  value: SuguanDocFormat
  onChange: (format: SuguanDocFormat) => void
}

function MmInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        step={0.5}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
        placeholder="mm"
      />
    </div>
  )
}

export function DocumentSetupStep({ value, onChange }: DocumentSetupStepProps) {
  const dims = useMemo(() => docPaperDimensionsMm(value), [value])
  const margins = useMemo(() => docMarginsMm(value), [value])
  const set = (p: Partial<SuguanDocFormat>) => onChange({ ...value, ...p })

  const described =
    value.scaling === 'fit-width'
      ? 'The full table is squeezed to a single page width.'
      : value.scaling === 'fit-page'
        ? 'The full table is scaled to fit on one page.'
        : 'The sheet exports at its natural size with normal scaling.'

  const maxW = 430
  const scale = Math.min(1, maxW / dims.width)
  const pageW = dims.width * scale
  const pageH = dims.height * scale
  const contentX = Math.round(margins.left * scale)
  const contentY = Math.round(margins.top * scale)
  const contentW = pageW - contentX - Math.round(margins.right * scale)
  const contentH = pageH - contentY - Math.round(margins.bottom * scale)

  const titleH = Math.round(contentH * 0.1)
  const subH = Math.round(contentH * 0.06)
  const headerH = Math.round(contentH * 0.16)
  const sigH = Math.round(contentH * 0.16)
  const rowsH = contentH - titleH - subH - headerH - sigH
  const columns = 6

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Setup</CardTitle>
        <CardDescription>
          Choose how the final Suguan document will be printed. These settings
          are applied to the Excel and PDF exports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Paper Size</Label>
                <Select
                  value={value.paperSize}
                  onValueChange={(v) => set({ paperSize: v as DocPaperSize })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letter">
                      {PAPER_SIZE_LABELS.letter.label}
                    </SelectItem>
                    <SelectItem value="a4">{PAPER_SIZE_LABELS.a4.label}</SelectItem>
                    <SelectItem value="legal">
                      {PAPER_SIZE_LABELS.legal.label}
                    </SelectItem>
                    <SelectItem value="custom">
                      {PAPER_SIZE_LABELS.custom.label}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Orientation</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => set({ orientation: 'portrait' })}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      value.orientation === 'portrait'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-accent',
                    )}
                  >
                    Portrait
                  </button>
                  <button
                    type="button"
                    onClick={() => set({ orientation: 'landscape' })}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      value.orientation === 'landscape'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-accent',
                    )}
                  >
                    Landscape
                  </button>
                </div>
                {value.orientation === 'landscape' ? (
                  <p className="text-xs text-muted-foreground">
                    Recommended for Suguan sheets, which carry many date and
                    signature columns.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Portrait sheets will have narrower date columns.
                  </p>
                )}
              </div>
            </div>

            {value.paperSize === 'custom' && (
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                <MmInput
                  label="Width (mm)"
                  value={value.customWidthMm}
                  onChange={(v) => set({ customWidthMm: v })}
                />
                <MmInput
                  label="Height (mm)"
                  value={value.customHeightMm}
                  onChange={(v) => set({ customHeightMm: v })}
                />
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Margins</Label>
                <Select
                  value={value.margins}
                  onValueChange={(v) => set({ margins: v as DocMargins })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="narrow">Narrow</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Scaling / Fit</Label>
                <Select
                  value={value.scaling}
                  onValueChange={(v) => set({ scaling: v as DocScaling })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fit-width">
                      Fit table to one page width
                    </SelectItem>
                    <SelectItem value="fit-page">
                      Fit table to one page
                    </SelectItem>
                    <SelectItem value="auto">Automatic scaling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Font Size</Label>
              <Select
                value={value.fontSize}
                onValueChange={(v) => set({ fontSize: v as DocFontSize })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {FONT_SIZE_PRESETS[value.fontSize]?.label}
              </p>
            </div>

            {value.margins === 'custom' && (
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                <MmInput
                  label="Top margin (mm)"
                  value={value.customMarginTopMm}
                  onChange={(v) => set({ customMarginTopMm: v })}
                />
                <MmInput
                  label="Bottom margin (mm)"
                  value={value.customMarginBottomMm}
                  onChange={(v) => set({ customMarginBottomMm: v })}
                />
                <MmInput
                  label="Left margin (mm)"
                  value={value.customMarginLeftMm}
                  onChange={(v) => set({ customMarginLeftMm: v })}
                />
                <MmInput
                  label="Right margin (mm)"
                  value={value.customMarginRightMm}
                  onChange={(v) => set({ customMarginRightMm: v })}
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">{described}</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-primary" />
              Live Preview
            </div>
            <div className="flex justify-center rounded-lg border bg-muted/30 p-4">
              <div
                className="relative overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-foreground/15"
                style={{ width: pageW, height: pageH }}
              >
                <div
                  className="flex flex-col"
                  style={{
                    position: 'absolute',
                    left: contentX,
                    top: contentY,
                    width: contentW,
                    height: contentH,
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-t border border-foreground/30 bg-muted/70"
                    style={{ height: titleH }}
                  >
                    <div
                      className="h-1/4 w-3/4 rounded bg-foreground/10"
                      title="Title"
                    />
                  </div>
                  <div
                    className="flex items-center justify-center border border-foreground/30 bg-muted/30"
                    style={{ height: subH }}
                  >
                    <div className="h-1/3 w-1/4 rounded bg-foreground/10" />
                  </div>
                  <div
                    className="grid"
                    style={{
                      height: headerH,
                      gridTemplateColumns: `repeat(${columns + 2}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: columns + 2 }, (_, i) => (
                      <div
                        key={i}
                        className="flex flex-col justify-center gap-1 border border-foreground/25 px-1"
                        style={{
                          backgroundColor:
                            i < 2
                              ? 'rgba(0,0,0,0.06)'
                              : i % 2 === 0
                                ? 'rgba(255,242,204,0.7)'
                                : 'rgba(217,234,211,0.8)',
                        }}
                      >
                        <div className="mx-auto h-1/4 w-3/4 self-start rounded bg-foreground/15" />
                        <div className="mx-auto h-1/4 w-3/4 rounded bg-foreground/15" />
                      </div>
                    ))}
                  </div>
                  <div
                    className="flex flex-col justify-between"
                    style={{ height: rowsH, padding: `${rowsH * 0.04}px 0` }}
                  >
                    {Array.from({ length: 5 }, (_, r) => (
                      <div
                        key={r}
                        className="grid flex-1"
                        style={{
                          gridTemplateColumns: `repeat(${columns + 2}, 1fr)`,
                        }}
                      >
                        <div className="flex items-center justify-center border border-foreground/20 bg-foreground/5">
                          {r + 1}
                        </div>
                        <div className="flex items-center border border-foreground/20 bg-foreground/5 px-1">
                          <div className="h-1/2 w-4/5 rounded bg-foreground/10" />
                        </div>
                        {Array.from({ length: columns }, (_, c) => (
                          <div
                            key={c}
                            className="border border-foreground/20"
                            style={{
                              backgroundColor:
                                (r + c) % 2 === 0
                                  ? 'rgba(255,242,204,0.25)'
                                  : 'rgba(217,234,211,0.3)',
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div
                    className="grid"
                    style={{
                      height: sigH,
                      gridTemplateColumns: '1fr 1fr',
                    }}
                  >
                    <div className="flex flex-col justify-end px-2 pb-1">
                      <div className="rounded border border-foreground/15" />
                      <div className="mt-1 text-center text-[6px] text-foreground/40">
                        PANGULONG MANG-AAWIT
                      </div>
                    </div>
                    <div className="flex flex-col justify-end px-2 pb-1">
                      <div className="rounded border border-foreground/15" />
                      <div className="mt-1 text-center text-[6px] text-foreground/40">
                        DESTINADO
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {PAPER_SIZE_LABELS[value.paperSize].short} ·{' '}
              {value.orientation === 'landscape' ? 'Landscape' : 'Portrait'} ·{' '}
              {value.fontSize === 'normal'
                ? 'Normal text'
                : value.fontSize === 'small'
                  ? 'Small text'
                  : 'Large text'}{' '}
              · {dims.width.toFixed(0)} × {dims.height.toFixed(0)} mm
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}