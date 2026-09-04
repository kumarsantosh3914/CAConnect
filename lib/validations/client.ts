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

export type ServiceTypeValue = (typeof SERVICE_TYPES)[number]

/**
 * An untouched optional input posts ''. Accept it as "not provided" rather
 * than failing format validation.
 *
 * Validation only — normalisation (trim, uppercase, '' → null) is a separate
 * step in normalizeClient(). Keeping them apart means the schema's input and
 * output types match, which is what react-hook-form needs.
 */
const optional = <T extends z.ZodType<string>>(schema: T) =>
  z.union([z.literal(''), schema]).optional()

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(120, 'Client name is too long'),
  client_type: z.enum(CLIENT_TYPES),
  pan: optional(z.string().regex(PAN_REGEX, 'PAN should look like ABCDE1234F')),
  gstin: optional(
    z.string().regex(GSTIN_REGEX, 'GSTIN should be 15 characters, like 27ABCDE1234F1Z5')
  ),
  email: optional(z.email('Enter a valid email address')),
  phone: optional(z.string().regex(/^[0-9+\-\s()]{7,20}$/, 'Enter a valid phone number')),
  notes: optional(z.string().max(2000, 'Notes are too long')),
  // ROC annual return is due within 60 days of the AGM, so we need the date.
  agm_date: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')),
  // Audit cases file ITR by 31 October instead of 31 July.
  is_audit_case: z.boolean(),
  services: z.array(z.enum(SERVICE_TYPES)),
  // A firm member's user id, or '' for unassigned.
  assigned_to: z.union([z.literal(''), z.string().uuid()]).optional(),
})

export type ClientInput = z.infer<typeof clientSchema>

/** Form values → database row. Empty strings become null, identifiers uppercase. */
export function normalizeClient(input: ClientInput) {
  const blank = (value: string | undefined) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }
  const upper = (value: string | undefined) => blank(value)?.toUpperCase() ?? null

  return {
    name: input.name.trim(),
    client_type: input.client_type,
    pan: upper(input.pan),
    gstin: upper(input.gstin),
    email: blank(input.email),
    phone: blank(input.phone),
    notes: blank(input.notes),
    agm_date: blank(input.agm_date),
    is_audit_case: input.is_audit_case,
    assigned_to: input.assigned_to ? input.assigned_to : null,
  }
}

export const clientDefaults: ClientInput = {
  name: '',
  client_type: 'individual',
  pan: '',
  gstin: '',
  email: '',
  phone: '',
  notes: '',
  agm_date: '',
  is_audit_case: false,
  services: [],
  assigned_to: '',
}
