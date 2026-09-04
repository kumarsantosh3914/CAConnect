import 'server-only'

/**
 * The AI provider seam.
 *
 * Call sites use ONLY this interface. The vendor SDK is imported in exactly
 * one file (lib/ai/openai.ts), so moving to Claude — or to any other model —
 * means adding a sibling implementation and changing the factory below.
 * No route, no component, and no prompt file knows which vendor is in use.
 */

export type NoticeDraftInput = {
  noticeText: string
  noticeType?: string | null
  clientName?: string | null
  firmName?: string | null
}

export type AiProvider = {
  readonly model: string
  /** Streams the draft back as plain text chunks. */
  draftNoticeResponse(input: NoticeDraftInput): AsyncIterable<string>
}

/** A failure the CA can act on, rather than a raw vendor error. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean = true
  ) {
    super(message)
    this.name = 'AiError'
  }
}

let cached: AiProvider | undefined

export async function getAiProvider(): Promise<AiProvider> {
  if (!cached) {
    // The single place the vendor is named. Swap this import to change models.
    const { createOpenAiProvider } = await import('./openai')
    cached = createOpenAiProvider()
  }
  return cached
}
