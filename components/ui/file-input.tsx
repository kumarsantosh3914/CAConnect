'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface FileInputProps {
  id?: string
  name: string
  accept?: string
  required?: boolean
  className?: string
}

export function FileInput({ id, name, accept, required, className }: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null)
  }

  return (
    <div
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-1.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className
      )}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="sr-only"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded border border-input bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
      >
        Browse
      </button>
      <span className="truncate text-muted-foreground">
        {fileName ?? 'No file chosen'}
      </span>
    </div>
  )
}
