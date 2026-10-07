import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, FileText, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
CUSTOM_BODY_FONT_MAX,
  CUSTOM_BODY_FONT_MIN,
  docMarginsMm,
  docPaperDimensionsMm,
  normalizeDocFormat,
  PAPER_SIZE_LABELS,
  resolveFontSizePreset,
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

/**
 * Numeric input for the "custom" fields. Shared by margins and font size so the
 * two custom panels cannot drift in styling or in how they handle a cleared box.
 */
function UnitInput({
  label,
  value,
  onChange,
  unit = 'mm',
  min = 0,
  max,
  step = 0.5,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  unit?: string
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
        placeholder={unit}
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

/**
 * Mobile-only disclosure trigger. The desktop layout keeps every section open
 * in a two-column row, so this button is `lg:hidden` and its content panel is
 * `lg:flex` regardless of the open flag.
 */
function DisclosureButton({
  open,
  onToggle,
  icon: Icon,
  children,
}: {
  open: boolean
  onToggle: () => void
  icon: typeof FileText
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onToggle}
      className="w-full justify-between lg:hidden"
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        {children}
      </span>
      <ChevronDown
        className={cn(
          'size-4 text-muted-foreground transition-transform',
          open && 'rotate-180',
        )}
      />
    </Button>
  )
}

export function DocumentSetupStep({ value, onChange }: DocumentSetupStepProps) {
  const dims = useMemo(() => docPaperDimensionsMm(value), [value])
  const margins = useMemo(() => docMarginsMm(value), [value])
  const set = (p: Partial<SuguanDocFormat>) => onChange({ ...value, ...p })

  /**
   * Mobile only: step 1 stacks coverage above the document options, so the
   * document panel and its margins/scaling group would fill the screen before
   * anything else is reachable. Both start collapsed on small screens.
   */
  const [docOpen, setDocOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)

  // Read the live preset so the derived sizes shown next to the custom input are
  // the ones the renderers will actually use, including after a clamp.
  const normalized = normalizeDocFormat(value)
  const fs = resolveFontSizePreset(normalized)

  return (
    <div className="flex flex-col gap-6">
      <DisclosureButton
        open={docOpen}
        onToggle={() => setDocOpen((o) => !o)}
        icon={FileText}
      >
        Document setup
      </DisclosureButton>

      <div
        className={cn(
          'flex-col gap-6 lg:flex',
          docOpen ? 'flex' : 'hidden',
        )}
      >
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
          <UnitInput
            label="Width (mm)"
            value={value.customWidthMm}
            onChange={(v) => set({ customWidthMm: v })}
          />
          <UnitInput
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

      <CardRow<DocFontSize>
        label="Font size"
        hint="Applies to the PDF, Excel, and on-screen preview."
        value={value.fontSize}
        onChange={(v) => set({ fontSize: v })}
        options={[
          { id: 'small', label: 'Small', description: 'Most members' },
          { id: 'normal', label: 'Normal', description: 'Balanced' },
          { id: 'large', label: 'Large', description: 'Easiest to read' },
          { id: 'custom', label: 'Custom', description: 'Enter your own' },
        ]}
      />

      {value.fontSize === 'custom' && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
          <UnitInput
            label="Body font size (pt)"
            value={value.customBodyFontSize}
            onChange={(v) => set({ customBodyFontSize: v })}
            unit="pt"
            min={CUSTOM_BODY_FONT_MIN}
            max={CUSTOM_BODY_FONT_MAX}
            step={0.5}
          />
          <div className="grid gap-1 self-end">
            <p className="text-xs text-muted-foreground">
              Title, header, and signature text scale to match automatically.
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {fs.titleFontSize} pt title · {fs.headerFontSize} pt header ·{' '}
              {fs.sigFontSize} pt signature
            </p>
          </div>
        </div>
      )}

      <DisclosureButton
        open={layoutOpen}
        onToggle={() => setLayoutOpen((o) => !o)}
        icon={SlidersHorizontal}
      >
        Margins &amp; scaling
      </DisclosureButton>

      <div
        className={cn(
          'flex-col gap-6 lg:flex',
          layoutOpen ? 'flex' : 'hidden',
        )}
      >
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
            <UnitInput
              label="Top margin (mm)"
              value={value.customMarginTopMm}
              onChange={(v) => set({ customMarginTopMm: v })}
            />
            <UnitInput
              label="Bottom margin (mm)"
              value={value.customMarginBottomMm}
              onChange={(v) => set({ customMarginBottomMm: v })}
            />
            <UnitInput
              label="Left margin (mm)"
              value={value.customMarginLeftMm}
              onChange={(v) => set({ customMarginLeftMm: v })}
            />
            <UnitInput
              label="Right margin (mm)"
              value={value.customMarginRightMm}
              onChange={(v) => set({ customMarginRightMm: v })}
            />
          </div>
        )}

        <CardRow<DocScaling>
          label="Scaling / fit"
          hint="Automatically scales to one page when readable; otherwise starts a new page only when needed."
          value={value.scaling}
          onChange={(v) => set({ scaling: v })}
          options={[
            { id: 'auto', label: 'Automatic', description: 'Fit when possible' },
            { id: 'fit-width', label: 'Fit width', description: 'One page wide' },
            { id: 'fit-page', label: 'Fit page', description: 'One page total' },
          ]}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {resolveFontSizePreset(normalized).label} ·{' '}
        {dims.width.toFixed(0)} × {dims.height.toFixed(0)} mm · margins{' '}
        {margins.top}/{margins.bottom}/{margins.left}/{margins.right} mm
      </p>
      </div>
    </div>
  )
}
