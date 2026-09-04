import 'server-only'

/**
 * The AI provider seam.
 *
 * Call sites use ONLY this interface. The vendor SDK is imported in exactly
 * one file (lib/ai/openai.ts), so moving to Claude — or to any other model —
 * means adding a sibling implementation and changing the factory below.
 * No route, no component, and no prompt file knows which vendor is in use.
 *
 * Generic on purpose: streamText takes a system prompt and a user prompt and
 * streams text back. Every AI feature (notice drafts, client emails, whatever
 * comes next) builds its own prompt in lib/ai/prompts/ and calls this one
 * method — the alternative is a new provider method and a new copy of the
 * streaming/error-handling code in openai.ts per feature, which is exactly
 * the duplication this seam exists to prevent.
 */

export type StreamTextInput = {
  instructions: string
  input: string
  maxOutputTokens?: number
}

export type AiProvider = {
  readonly model: string
  /** Streams the completion back as plain text chunks. */
  streamText(input: StreamTextInput): AsyncIterable<string>
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
