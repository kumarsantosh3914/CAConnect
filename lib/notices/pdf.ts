import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'

/**
 * Pulls text out of a notice PDF.
 *
 * Deliberately provider-agnostic: we extract here and hand plain text to the
 * model, so switching AI vendors never depends on that vendor's file-input
 * support. It also means the CA can see exactly what the model was given.
 *
 * Scanned notices (an image with no text layer) come back empty — the caller
 * tells the CA to paste the text instead, rather than sending nothing and
 * getting a confident reply to an empty document.
 */
export async function extractPdfText(file: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(file))
  const { text } = await extractText(pdf, { mergePages: true })
  return (Array.isArray(text) ? text.join('\n') : text).replace(/\r\n/g, '\n').trim()
}

export const PDF_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  /** Below this a "PDF" is almost certainly a scan with no text layer. */
  minExtractedChars: 120,
  /** Guards both the token bill and the 400 the API returns on huge inputs. */
  maxChars: 60_000,
} as const
