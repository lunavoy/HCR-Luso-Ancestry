import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  shortcut?: string
  active?: boolean
  children: ReactNode
}

export function IconButton({ label, shortcut, active, children, className = '', ...props }: IconButtonProps) {
  return (
    <button
      className={`icon-button ${active ? 'is-active' : ''} ${className}`}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      type="button"
      {...props}
    >
      {children}
      <span className="tooltip">
        {label}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  )
}
