import { z } from 'zod'
import { GSTIN_REGEX, PAN_REGEX } from './india'

export const SERVICE_TYPES = [
  'itr',
  'gstr1',
  'gstr3b',
  'tds',
  'roc',
  'company_registration',
  'other',
] as const

export const CLIENT_TYPES = ['individual', 'company', 'firm', 'llp', 'huf', 'trust'] as const

/**
 * An untouched optional input posts '' — treat that as "not provided" rather
 * than as a value that fails format validation.
 */
const blankToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** PAN and GSTIN are always stored uppercase, whatever the CA typed. */
const blankToUndefinedUpper = (value: unknown) => {
  const result = blankToUndefined(value)
  return typeof result === 'string' ? result.toUpperCase() : result
}

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(120, 'Client name is too long'),
  client_type: z.enum(CLIENT_TYPES),
  pan: z.preprocess(
    blankToUndefinedUpper,
    z.string().regex(PAN_REGEX, 'PAN should look like ABCDE1234F').optional()
  ),
  gstin: z.preprocess(
    blankToUndefinedUpper,
    z
      .string()
      .regex(GSTIN_REGEX, 'GSTIN should be 15 characters, like 27ABCDE1234F1Z5')
      .optional()
  ),
  email: z.preprocess(blankToUndefined, z.email('Enter a valid email address').optional()),
  phone: z.preprocess(
    blankToUndefined,
    z.string().regex(/^[0-9+\-\s()]{7,20}$/, 'Enter a valid phone number').optional()
  ),
  notes: z.preprocess(blankToUndefined, z.string().max(2000).optional()),
  // ROC annual return is due within 60 days of the AGM, so we need the date.
  agm_date: z.preprocess(
    blankToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date').optional()
  ),
  // Audit cases file ITR by 31 Oct instead of 31 Jul.
  is_audit_case: z.boolean(),
  services: z.array(z.enum(SERVICE_TYPES)),
})

export type ClientInput = z.infer<typeof clientSchema>

export const clientDefaults: ClientInput = {
  name: '',
  client_type: 'individual',
  pan: undefined,
  gstin: undefined,
  email: undefined,
  phone: undefined,
  notes: undefined,
  agm_date: undefined,
  is_audit_case: false,
  services: [],
}
