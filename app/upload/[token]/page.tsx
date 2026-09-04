import type { Metadata } from 'next'
import { lookupUploadRequest } from '@/lib/documents/public'
import { UploadForm } from '@/components/documents/upload-form'
import { formatDate } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Upload documents',
  // A client-facing link should never end up in search results.
  robots: { index: false, follow: false },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <div className="rounded-lg border bg-card p-6 shadow-sm">{children}</div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Secured by CAConnect · Your files are visible only to your CA
      </p>
    </main>
  )
}

export default async function UploadPage(props: PageProps<'/upload/[token]'>) {
  const { token } = await props.params
  const result = await lookupUploadRequest(token)

  if (!result.ok) {
    const copy = {
      not_found: {
        title: 'This link is not valid',
        body: 'Please check the link your CA sent you, or ask them for a new one.',
      },
      expired: {
        title: 'This link has expired',
        body: 'Upload links are time-limited for your security. Ask your CA to send a fresh one.',
      },
      completed: {
        title: 'All documents received',
        body: 'Your CA already has everything they asked for. Nothing more to do.',
      },
    }[result.reason]

    return (
      <Shell>
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
      </Shell>
    )
  }

  const { request } = result

  return (
    <Shell>
      <div className="space-y-1">
        {request.firm_name && (
          <p className="text-sm font-medium text-muted-foreground">{request.firm_name}</p>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{request.title}</h1>
        <p className="text-sm text-muted-foreground">
          For {request.client_name} · Link valid until {formatDate(request.expires_at)}
        </p>
      </div>

      {request.message && (
        <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{request.message}</p>
      )}

      <UploadForm token={token} items={request.items} />
    </Shell>
  )
}
