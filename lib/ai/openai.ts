import 'server-only'
import OpenAI from 'openai'
import { env } from '@/lib/env'
import { AiError, type AiProvider, type StreamTextInput } from './provider'

/**
 * The ONLY file that imports the OpenAI SDK, and the only file that knows
 * anything about the Responses API. It has no idea what a "notice" or a
 * "client email" is — that knowledge lives in lib/ai/prompts/, one file per
 * feature. Adding a feature never touches this file.
 */

const DEFAULT_MAX_OUTPUT_TOKENS = 4000

/** Maps vendor failures onto something a CA can act on, per CLAUDE.md. */
function toAiError(error: unknown): AiError {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) {
      return new AiError(
        'The AI service rejected our credentials. Please contact support — this is not something you can fix.',
        false
      )
    }
    if (error.status === 429) {
      return new AiError('The AI service is busy right now. Please try again in a moment.', true)
    }
    if (error.status === 400) {
      return new AiError(
        'That request could not be processed — it may be too long. Try shortening it.',
        false
      )
    }
    if (error.status && error.status >= 500) {
      return new AiError('The AI service is temporarily unavailable. Please try again shortly.', true)
    }
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new AiError('The draft was cancelled.', false)
  }
  return new AiError('Something went wrong generating the draft. Please try again.', true)
}

export function createOpenAiProvider(): AiProvider {
  const client = new OpenAI({ apiKey: env.openaiApiKey() })
  const model = env.openaiModel()

  return {
    model,

    async *streamText({
      instructions,
      input,
      maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
    }: StreamTextInput): AsyncIterable<string> {
      let stream
      try {
        stream = await client.responses.create({
          model,
          instructions,
          input,
          max_output_tokens: maxOutputTokens,
          stream: true,
        })
      } catch (error) {
        throw toAiError(error)
      }

      try {
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            yield event.delta
          }
        }
      } catch (error) {
        throw toAiError(error)
      }
    },
  }
}
