import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ReferenceField, ReferenceValues } from './referenceList'

interface ReferenceFormProps {
  fields: ReferenceField[]
  values: ReferenceValues
  onChange: (key: string, value: string) => void
  /** Why the form cannot be saved yet, shown under the fields. */
  problem: string | null
  onSubmit: () => void
  /** Cancel/Save buttons, rendered inside the form so Enter and click agree. */
  children: ReactNode
}

/**
 * The add/edit form for a reference list.
 *
 * One component serves both the desktop dialog and the mobile bottom sheet, so
 * a rule enforced on one breakpoint cannot be missing on the other. Enter
 * submits, and a blank name simply disables the Save button rather than
 * scolding the user before they have typed anything.
 */
export function ReferenceForm({
  fields,
  values,
  onChange,
  problem,
  onSubmit,
  children,
}: ReferenceFormProps) {
  const firstKey = fields[0]?.key
  const name = firstKey ? (values[firstKey] ?? '') : ''
  // Only speak up once there is something to complain about: a duplicate is
  // worth explaining, an untouched empty form is not.
  const hint = problem && name.trim() ? problem : null

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!problem) onSubmit()
      }}
    >
      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            {field.options ? (
              <>
                <span className="text-sm font-medium text-foreground">
                  {field.label}
                </span>
                <div
                  role="group"
                  aria-label={field.label}
                  className="grid grid-cols-2 gap-1.5"
                >
                  {field.options.map((option) => {
                    const selected = values[field.key] === option.value
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        aria-pressed={selected}
                        onClick={() => onChange(field.key, option.value)}
                      >
                        {option.label}
                      </Button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <Label htmlFor={`ref-${field.key}`}>{field.label}</Label>
                <Input
                  id={`ref-${field.key}`}
                  value={values[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={cn('h-9', field.className ?? 'w-full')}
                  autoComplete="off"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {hint && (
        <p role="alert" className="text-xs text-destructive">
          {hint}
        </p>
      )}

      {children}
    </form>
  )
}
