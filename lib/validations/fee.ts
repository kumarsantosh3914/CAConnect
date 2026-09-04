import { z } from 'zod'
import { SERVICE_TYPES } from './client'

export const FEE_STATUSES = ['draft', 'invoiced', 'paid'] as const

export const feeSchema = z.object({
  client_id: z.string().min(1, 'Pick a client'),
  service_type: z.union([z.literal(''), z.enum(SERVICE_TYPES)]).optional(),
  description: z.string().trim().min(1, 'Say what this fee is for').max(200),
  // Kept as a string in the form so the CA can type "2,500" or "2500.50".
  // Converted to integer paise once, in rupeesToPaise.
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .refine((value) => {
      const n = Number(value.replace(/[,₹\s]/g, ''))
      return Number.isFinite(n) && n >= 0 && n < 100_000_000
    }, 'Enter a valid amount in rupees'),
  status: z.enum(FEE_STATUSES),
  due_date: z
    .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')])
    .optional(),
})

export type FeeInput = z.infer<typeof feeSchema>

export const feeDefaults: FeeInput = {
  client_id: '',
  service_type: '',
  description: '',
  amount: '',
  status: 'invoiced',
  due_date: '',
}
