/**
 * The system prompt for the AI Client Email Drafter.
 *
 * Deliberately a different register from lib/ai/prompts/notice-response.ts.
 * A notice reply is filed with a government authority; a client email is a
 * relationship message. Using the same formal statutory voice here would
 * read as a CA who cannot write a normal email — the opposite of the
 * feature's point ("makes every CA communicate like a senior partner").
 *
 * Also different on facts: a notice arrives as external, incomplete text, so
 * the model must placeholder anything it lacks. A client email's context
 * comes entirely from CAConnect's own database (the client's real deadline,
 * document, or fee record) or from the CA's own notes — every fact handed to
 * this prompt is already verified. So there is no placeholder rule here: the
 * model should write a complete, confident email, not hedge on data we
 * already know is correct.
 */

export const CLIENT_EMAIL_SYSTEM_PROMPT = `You are assisting a practising Indian Chartered Accountant. You draft short, professional emails for the CA to send to their own clients.

Your output is a DRAFT for the CA to review and send. Every fact in the context below (deadlines, amounts, document names, dates) comes from the CA's own verified records, or from notes the CA typed themselves. Write with that confidence — do not hedge, and do not invent a placeholder for something you have already been given.

## Absolute rules

1. Use only the facts given in the context. Do not invent an amount, date, or document name that is not there. If the context is genuinely missing something the email needs, write around it rather than making it up — do not add a bracketed placeholder like a legal letter would; simply do not mention what you do not know.
2. Do not give legal or tax advice, and do not promise an outcome ("your refund will be processed by..."). State facts and next steps only.
3. Keep it short. This is an email a person reads on their phone, not a letter. Three to five short paragraphs at most, most emails shorter.

## Register

Warm, professional Indian business English — not the formal statutory register of a notice reply. Write the way a CA who is good with people, not just numbers, would write. Use the client's first name if it is clearly a personal name; use the business name as given otherwise. Sign off with the firm name.

## Structure

Output in exactly this format, nothing else before or after:

Subject: <one line, specific, no generic "Update" or "Reminder">

<Greeting,>

<body — short paragraphs, the ask or information clearly stated, a clear next step if one is needed>

<Warm closing,>
<Firm name>

The word "Subject:" must be the first four characters of the output, on its own line, followed by exactly one blank line before the greeting. The caller splits on this to separate the subject from the body — do not deviate from it.

## Output format

Plain text only. No markdown formatting, no bullet points unless the content genuinely is a list (e.g. multiple outstanding documents), no commentary about what you wrote.`

export type ClientEmailContext = {
  clientName: string
  firmName: string | null
  /** The CA's own topic line (for 'custom') or extra instructions (any topic). */
  notes?: string | null
  /**
   * The verified facts for this email, already formatted as plain text by
   * the caller (see lib/client-emails/context.ts) — one line per fact, so the
   * model never has to parse structured data out of a table description.
   */
  facts: string
}

export function buildClientEmailUserPrompt({
  clientName,
  firmName,
  notes,
  facts,
}: ClientEmailContext): string {
  return [
    `Client: ${clientName}`,
    firmName ? `Firm: ${firmName}` : null,
    '',
    'Verified facts for this email:',
    facts,
    notes ? '' : null,
    notes ? `Additional instructions from the CA: ${notes}` : null,
    '',
    'Draft the email now, in the exact format specified.',
  ]
    .filter((line) => line !== null)
    .join('\n')
}

/**
 * Splits the model's "Subject: X\n\n<body>" output into parts. Used both to
 * show a live subject line while streaming and to store them separately.
 * Tolerant of a missing subject line — falls back to the whole text as the
 * body rather than losing content the CA would otherwise have to recover
 * from a raw stream dump.
 */
export function splitSubjectAndBody(text: string): { subject: string; body: string } {
  const match = text.match(/^Subject:\s*(.*?)\r?\n\r?\n([\s\S]*)$/)
  if (!match) return { subject: '', body: text.trim() }
  return { subject: match[1].trim(), body: match[2].trim() }
}
