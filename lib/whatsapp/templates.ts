/**
 * WhatsApp message templates.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * These are NOT free text. A business-initiated WhatsApp message must use a
 * template that Meta has reviewed and approved in advance, and the parameter
 * count here must match the approved template exactly or the send fails with
 * a 132000-series error.
 *
 * So the body text below is not documentation — it is the contract. Register
 * each template in Meta Business Manager with the EXACT text shown, in the
 * 'utility' category, then keep the two in step. Changing a word here without
 * re-submitting there breaks sending; changing it there without changing here
 * silently reorders the parameters.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Category note: these are all transactional (a filing is due, documents are
 * needed) so they belong in 'utility', which is cheaper than 'marketing' and
 * far more likely to be approved. Nothing here may promote anything.
 */

export type TemplateParam = { type: 'text'; text: string }

export type WhatsAppTemplate = {
  /** The name registered with Meta. Lowercase and underscores only. */
  name: string
  language: string
  /** Body text as approved, for reference and for the registration checklist. */
  body: string
  params: TemplateParam[]
}

/** Meta rejects parameters containing newlines or runs of 4+ spaces. */
function param(value: string): TemplateParam {
  return { type: 'text', text: value.replace(/\s+/g, ' ').trim() }
}

/**
 * Register as: deadline_reminder (utility, en)
 *
 *   Hello {{1}}, this is a reminder from {{2}}. Your {{3}} for {{4}} is due on
 *   {{5}}. Please share any pending documents so we can file on time.
 */
export function deadlineReminderTemplate(input: {
  clientName: string
  firmName: string
  label: string
  periodLabel: string
  dueDate: string
}): WhatsAppTemplate {
  return {
    name: 'deadline_reminder',
    language: 'en',
    body:
      'Hello {{1}}, this is a reminder from {{2}}. Your {{3}} for {{4}} is due on {{5}}. ' +
      'Please share any pending documents so we can file on time.',
    params: [
      param(input.clientName),
      param(input.firmName),
      param(input.label),
      param(input.periodLabel),
      param(input.dueDate),
    ],
  }
}

/**
 * Register as: document_request (utility, en)
 *
 *   Hello {{1}}, {{2}} needs some documents from you for {{3}}: {{4}}. You can
 *   upload them here, no login needed: {{5}}
 *
 * The link is a body parameter rather than a URL button on purpose. A button's
 * dynamic part is appended to a fixed prefix, which cannot express our
 * per-request tokens without pinning the domain into the approved template —
 * and that would have to be re-approved every time the domain changes.
 */
export function documentRequestTemplate(input: {
  clientName: string
  firmName: string
  title: string
  outstanding: string[]
  uploadUrl: string
}): WhatsAppTemplate {
  return {
    name: 'document_request',
    language: 'en',
    body:
      'Hello {{1}}, {{2}} needs some documents from you for {{3}}: {{4}}. ' +
      'You can upload them here, no login needed: {{5}}',
    params: [
      param(input.clientName),
      param(input.firmName),
      param(input.title),
      param(input.outstanding.join(', ')),
      param(input.uploadUrl),
    ],
  }
}

/** Everything that must exist in Meta Business Manager before sending works. */
export const REQUIRED_TEMPLATES = ['deadline_reminder', 'document_request'] as const
