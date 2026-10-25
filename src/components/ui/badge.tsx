import React from 'react'
import { cn } from '@/lib/utils/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline'
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-blue-100 text-blue-800 border-transparent',
    success: 'bg-emerald-100 text-emerald-800 border-transparent',
    warning: 'bg-amber-100 text-amber-800 border-transparent',
    danger: 'bg-rose-100 text-rose-800 border-transparent',
    outline: 'border-slate-300 text-slate-700 bg-transparent',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
