'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { saveNoticeEdit } from '@/app/(dashboard)/notices/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function NoticeDetail({
  noticeId,
  title,
  noticeText,
  draftResponse,
  editedResponse,
}: {
  noticeId: string
  title: string
  noticeText: string
  draftResponse: string | null
  editedResponse: string | null
}) {
  const router = useRouter()
  // The CA's edits live in their own column, so the original AI draft is never
  // overwritten and "revert" always has something to go back to.
  const [text, setText] = useState(editedResponse ?? draftResponse ?? '')
  const [isSaving, startSave] = useTransition()

  const isDirty = text !== (editedResponse ?? draftResponse ?? '')
  const hasEdits = editedResponse !== null && editedResponse !== draftResponse

  function onSave() {
    startSave(async () => {
      const result = await saveNoticeEdit(noticeId, text)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Draft saved')
      router.refresh()
    })
  }

  function onRevert() {
    setText(draftResponse ?? '')
    toast.info('Reverted to the original AI draft')
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }

  function onDownload() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/[^\w.-]+/g, '-')}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Tabs defaultValue="draft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="draft">Draft reply</TabsTrigger>
          <TabsTrigger value="notice">Original notice</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-2">
          {hasEdits && (
            <Button variant="outline" size="sm" onClick={onRevert}>
              <RotateCcw className="size-4" aria-hidden />
              Revert to AI draft
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="size-4" aria-hidden />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="size-4" aria-hidden />
            .txt
          </Button>
          <Button size="sm" disabled={!isDirty || isSaving} onClick={onSave}>
            {isSaving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      <TabsContent value="draft" className="space-y-3">
        {draftResponse ? (
          <>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={30}
              className="font-mono text-xs leading-relaxed"
              aria-label="Draft reply"
            />
            <Alert>
              <AlertDescription className="text-xs">
                <strong>AI-generated draft — review before sending.</strong> Check every figure,
                date and section reference against the notice. Placeholders in [square brackets]
                need your input. This is a drafting aid, not a legal opinion — you remain
                professionally responsible for what you file.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No draft was generated for this notice.
          </p>
        )}
      </TabsContent>

      <TabsContent value="notice">
        <pre className="max-h-[70svh] overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {noticeText}
        </pre>
      </TabsContent>
    </Tabs>
  )
}
