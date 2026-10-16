import { useState } from 'react'
import type * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  /** Classes for the positioning wrapper, e.g. `flex-1` inside a flex row. */
  containerClassName?: string
}

/**
 * The app's password field: an `Input` with a show/hide toggle pinned to its
 * right edge. Every password entry in the app goes through this, so the eye
 * button behaves the same on the sign-in screen, the forced password change and
 * both Administration dialogs instead of being copied four times.
 */
export function PasswordInput({
  className,
  containerClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={cn('relative', containerClassName)}>
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
