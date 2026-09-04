'use client'

import { useRef, useState } from 'react'
import { Check, Loader2, Paperclip, Upload } from 'lucide-react'
import { UPLOAD_LIMITS } from '@/lib/documents/tokens'
import { formatFileSize } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type Item = { id: string; label: string; is_required: boolean; fulfilled: boolean }

type ItemState = {
  status: 'idle' | 'uploading' | 'done' | 'error'
  fileName?: string
  error?: string
}

/**
 * The client-facing upload form. No login, no app — this opens from a
 * WhatsApp link on a phone, so the whole design target is "one tap per
 * document, on a mid-range Android, on patchy data".
 */
export function UploadForm({ token, items }: { token: string; items: Item[] }) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, item.fulfilled ? { status: 'done' as const } : { status: 'idle' as const }])
    )
  )
  const [extraFiles, setExtraFiles] = useState<string[]>([])
  const [extraState, setExtraState] = useState<ItemState>({ status: 'idle' })
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const extraRef = useRef<HTMLInputElement | null>(null)

  async function send(file: File, itemId?: string) {
    const body = new FormData()
    body.append('file', file)
    if (itemId) body.append('item_id', itemId)

    const response = await fetch(`/api/upload/${token}`, { method: 'POST', body })
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      fileName?: string
    }
    if (!response.ok) throw new Error(payload.error || 'That upload did not go through.')
    return payload
  }

  function validate(file: File): string | null {
    if (file.size > UPLOAD_LIMITS.maxFileBytes) {
      return `That file is ${formatFileSize(file.size)}. The limit is 10 MB.`
    }
    if (!UPLOAD_LIMITS.allowedMimeTypes.includes(file.type as never)) {
      return 'Please choose a PDF or a photo.'
    }
    return null
  }

  async function onPick(itemId: string, file: File | undefined) {
    if (!file) return
    const problem = validate(file)
    if (problem) {
      setState((prev) => ({ ...prev, [itemId]: { status: 'error', error: problem } }))
      return
    }

    setState((prev) => ({ ...prev, [itemId]: { status: 'uploading', fileName: file.name } }))
    try {
      const result = await send(file, itemId)
      setState((prev) => ({ ...prev, [itemId]: { status: 'done', fileName: result.fileName } }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        [itemId]: { status: 'error', error: (error as Error).message },
      }))
    }
  }

  async function onPickExtra(file: File | undefined) {
    if (!file) return
    const problem = validate(file)
    if (problem) return setExtraState({ status: 'error', error: problem })

    setExtraState({ status: 'uploading', fileName: file.name })
    try {
      const result = await send(file)
      setExtraFiles((prev) => [...prev, result.fileName ?? file.name])
      setExtraState({ status: 'idle' })
    } catch (error) {
      setExtraState({ status: 'error', error: (error as Error).message })
    }
  }

  const requiredRemaining = items.filter(
    (item) => item.is_required && state[item.id]?.status !== 'done'
  ).length
  const allDone = items.length > 0 && requiredRemaining === 0

  return (
    <div className="mt-6 space-y-4">
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => {
            const current = state[item.id] ?? { status: 'idle' as const }
            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-lg border p-3',
                  current.status === 'done' && 'border-green-500/40 bg-green-50 dark:bg-green-950/30',
                  current.status === 'error' && 'border-destructive/50'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.label}
                      {!item.is_required && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          optional
                        </span>
                      )}
                    </p>
                    {current.status === 'done' && (
                      <p className="truncate text-xs text-green-700 dark:text-green-400">
                        {current.fileName ? `Received · ${current.fileName}` : 'Received'}
                      </p>
                    )}
                    {current.status === 'uploading' && (
                      <p className="truncate text-xs text-muted-foreground">Uploading…</p>
                    )}
                    {current.status === 'error' && (
                      <p className="text-xs text-destructive">{current.error}</p>
                    )}
                  </div>

                  {current.status === 'done' ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                      <Check className="size-4" aria-hidden />
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={current.status === 'uploading'}
                      onClick={() => inputRefs.current[item.id]?.click()}
                    >
                      {current.status === 'uploading' ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="size-4" aria-hidden />
                      )}
                      {current.status === 'error' ? 'Retry' : 'Upload'}
                    </Button>
                  )}
                </div>

                {/*
                  capture="environment" opens the phone camera directly, which
                  is how most clients will actually send a document. No app,
                  works on iOS and Android.
                */}
                <input
                  ref={(element) => {
                    inputRefs.current[item.id] = element
                  }}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  aria-label={`Upload ${item.label}`}
                  onChange={(event) => {
                    void onPick(item.id, event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}

      {allDone && (
        <Alert>
          <AlertDescription>
            All done — your CA has everything they asked for. You can close this page.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-dashed p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Something else</p>
            <p className="text-xs text-muted-foreground">
              {extraFiles.length > 0
                ? `${extraFiles.length} extra file${extraFiles.length === 1 ? '' : 's'} sent`
                : 'Add any other document your CA may need'}
            </p>
            {extraState.status === 'error' && (
              <p className="text-xs text-destructive">{extraState.error}</p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={extraState.status === 'uploading'}
            onClick={() => extraRef.current?.click()}
          >
            {extraState.status === 'uploading' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Paperclip className="size-4" aria-hidden />
            )}
            Add file
          </Button>
        </div>
        <input
          ref={extraRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          aria-label="Upload another document"
          onChange={(event) => {
            void onPickExtra(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        PDF or photo · up to 10 MB each
      </p>
    </div>
  )
}
