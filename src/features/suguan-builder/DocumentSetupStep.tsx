import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  docMarginsMm,
  docPaperDimensionsMm,
  FONT_SIZE_PRESETS,
  PAPER_SIZE_LABELS,
} from '@/lib/suguanUtils'
import type {
  DocFontSize,
  DocMargins,
  DocPaperSize,
  DocScaling,
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

function CardRow<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  options: { id: T; label: string; description?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div
        className={cn(
          'grid gap-2',
          options.length === 2
            ? 'grid-cols-2'
            : options.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded-lg border px-3 py-2.5 text-left transition-colors',
              value === o.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/50 hover:bg-accent/50',
            )}
          >
            <span className="block text-sm font-semibold">{o.label}</span>
            {o.description && (
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {o.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DocumentSetupStep({ value, onChange }: DocumentSetupStepProps) {
  const dims = useMemo(() => docPaperDimensionsMm(value), [value])
  const margins = useMemo(() => docMarginsMm(value), [value])
  const set = (p: Partial<SuguanDocFormat>) => onChange({ ...value, ...p })

  return (
    <div className="flex flex-col gap-6">
      <CardRow<DocPaperSize>
        label="Paper size"
        hint="Match the printer paper used for the printed sheet."
        value={value.paperSize}
        onChange={(v) => set({ paperSize: v })}
        options={[
          { id: 'letter', label: PAPER_SIZE_LABELS.letter.short, description: '8.5 × 11 in' },
          { id: 'a4', label: PAPER_SIZE_LABELS.a4.short, description: '210 × 297 mm' },
          { id: 'legal', label: PAPER_SIZE_LABELS.legal.short, description: '8.5 × 14 in' },
          { id: 'custom', label: 'Custom', description: 'Enter your own' },
        ]}
      />

      {value.paperSize === 'custom' && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
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

      <CardRow<'portrait' | 'landscape'>
        label="Orientation"
        value={value.orientation}
        onChange={(v) => set({ orientation: v })}
        options={[
          { id: 'portrait', label: 'Portrait', description: 'Default — narrower date columns' },
          { id: 'landscape', label: 'Landscape', description: 'Wider, best for many columns' },
        ]}
      />

      <CardRow<DocMargins>
        label="Margins"
        value={value.margins}
        onChange={(v) => set({ margins: v })}
        options={[
          { id: 'normal', label: 'Normal', description: '10 mm sides' },
          { id: 'narrow', label: 'Narrow', description: '5 mm all round' },
          { id: 'custom', label: 'Custom', description: 'Enter your own' },
        ]}
      />

      {value.margins === 'custom' && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
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

      <CardRow<DocScaling>
        label="Scaling / fit"
        hint="Controls how the table fills the page when it is exported."
        value={value.scaling}
        onChange={(v) => set({ scaling: v })}
        options={[
          { id: 'auto', label: 'Automatic', description: 'Natural size' },
          { id: 'fit-width', label: 'Fit width', description: 'One page wide' },
          { id: 'fit-page', label: 'Fit page', description: 'One page total' },
        ]}
      />

      <CardRow<DocFontSize>
        label="Font size"
        hint="Applies to the PDF, Excel, and on-screen preview."
        value={value.fontSize}
        onChange={(v) => set({ fontSize: v })}
        options={[
          { id: 'small', label: 'Small', description: 'Most members' },
          { id: 'normal', label: 'Normal', description: 'Balanced' },
          { id: 'large', label: 'Large', description: 'Easiest to read' },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        {FONT_SIZE_PRESETS[value.fontSize]?.label} ·{' '}
        {dims.width.toFixed(0)} × {dims.height.toFixed(0)} mm · margins{' '}
        {margins.top}/{margins.bottom}/{margins.left}/{margins.right} mm
      </p>
    </div>
  )
}
