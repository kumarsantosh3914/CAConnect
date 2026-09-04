import type { Database } from '@/types/database'

type ServiceType = Database['public']['Enums']['service_type']
type DeadlineTemplate = Database['public']['Tables']['deadline_templates']['Row']

export type MonthlyRule = { day: number }
export type QuarterlyRule = { months: number[]; day: number }
export type AnnualRule = { month: number; day: number }
export type EventRule = { offset_days: number; anchor: 'agm_date' }

export type GeneratedDeadline = {
  template_id: string
  service_type: ServiceType
  label: string
  period_label: string
  due_date: string // yyyy-mm-dd
}

export type DeadlineClient = {
  id: string
  is_audit_case: boolean
  agm_date: string | null
  services: ServiceType[]
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** yyyy-mm-dd in local terms, avoiding the UTC shift that toISOString() causes. */
function toDateString(year: number, month1: number, day: number): string {
  // Clamp to the real last day of the month (e.g. a "31st" rule in February).
  const lastDay = new Date(year, month1, 0).getDate()
  const safeDay = Math.min(day, lastDay)
  return `${year}-${String(month1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Indian financial year runs 1 April – 31 March. A date in Jan–Mar belongs to
 * the FY that started the previous calendar year.
 */
function financialYear(year: number, month1: number): string {
  const startYear = month1 >= 4 ? year : year - 1
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** The assessment year for income earned in the FY ending in `year`. */
function assessmentYear(dueYear: number, dueMonth1: number): string {
  // ITR filed in Jul/Oct of year Y assesses income of FY (Y-1)-Y.
  const startYear = dueMonth1 >= 4 ? dueYear - 1 : dueYear - 2
  return `AY${startYear + 1}-${String((startYear + 2) % 100).padStart(2, '0')}`
}

/**
 * Which quarter a filing in a given month actually covers.
 *
 * Do NOT assume "the previous month" — the gap is not constant. TDS returns
 * are due 15 Jul, 15 Oct, 15 Jan and 15 May, so three of them fall one month
 * after the quarter ends but the Q4 return (Jan–Mar) falls two months after.
 * Treating May as "April minus a month" labels it Q1 of the NEXT financial
 * year, which collides with the July filing on
 * (client_id, template_id, period_label) — and the upsert then silently drops
 * one of the CA's real TDS deadlines.
 *
 * The reliable rule: find the most recent Indian FY quarter end (Jun, Sep,
 * Dec, Mar) strictly before the filing month.
 */
function quarterCoveredByFiling(
  filingYear: number,
  filingMonth1: number
): { quarter: number; financialYear: string } {
  const QUARTER_ENDS = [3, 6, 9, 12]

  let endMonth = 0
  let endYear = filingYear
  for (const candidate of QUARTER_ENDS) {
    if (candidate < filingMonth1) endMonth = candidate
  }
  if (endMonth === 0) {
    // Filing falls in January to March: the last completed quarter ended in
    // December of the previous calendar year.
    endMonth = 12
    endYear = filingYear - 1
  }

  // Jun → Q1, Sep → Q2, Dec → Q3, Mar → Q4 (the Indian FY starts in April).
  const quarter = Math.floor(((endMonth - 4 + 12) % 12) / 3) + 1
  return { quarter, financialYear: financialYear(endYear, endMonth) }
}

/**
 * Expands one template into every occurrence between today and `horizonMonths`
 * ahead. Also looks back `lookbackMonths` so a CA onboarding mid-year still
 * sees the filings they are currently late on — the whole reason they signed up.
 */
export function expandTemplate(
  template: DeadlineTemplate,
  client: DeadlineClient,
  options: { from?: Date; horizonMonths?: number; lookbackMonths?: number } = {}
): GeneratedDeadline[] {
  const from = options.from ?? new Date()
  const horizonMonths = options.horizonMonths ?? 12
  const lookbackMonths = options.lookbackMonths ?? 3

  if (!client.services.includes(template.service_type)) return []

  // applies_when narrows a template to a subset of clients, e.g. audit cases.
  const applies = template.applies_when as Record<string, unknown> | null
  if (applies && 'is_audit_case' in applies && applies.is_audit_case !== client.is_audit_case) {
    return []
  }

  const start = new Date(from.getFullYear(), from.getMonth() - lookbackMonths, 1)
  const end = new Date(from.getFullYear(), from.getMonth() + horizonMonths, 1)
  const results: GeneratedDeadline[] = []

  const base = {
    template_id: template.id,
    service_type: template.service_type,
    label: template.label,
  }

  switch (template.frequency) {
    case 'monthly': {
      const rule = template.rule as MonthlyRule
      const cursor = new Date(start)
      while (cursor < end) {
        const year = cursor.getFullYear()
        const month1 = cursor.getMonth() + 1
        // A return filed on the 11th of month M covers month M-1.
        const periodDate = new Date(year, cursor.getMonth() - 1, 1)
        results.push({
          ...base,
          period_label: `${MONTHS[periodDate.getMonth()]} ${periodDate.getFullYear()}`,
          due_date: toDateString(year, month1, rule.day),
        })
        cursor.setMonth(cursor.getMonth() + 1)
      }
      break
    }

    case 'quarterly': {
      const rule = template.rule as QuarterlyRule
      const cursor = new Date(start)
      while (cursor < end) {
        const month1 = cursor.getMonth() + 1
        if (rule.months.includes(month1)) {
          const year = cursor.getFullYear()
          const { quarter, financialYear: fy } = quarterCoveredByFiling(year, month1)
          results.push({
            ...base,
            period_label: `Q${quarter} ${fy}`,
            due_date: toDateString(year, month1, rule.day),
          })
        }
        cursor.setMonth(cursor.getMonth() + 1)
      }
      break
    }

    case 'annual': {
      const rule = template.rule as AnnualRule
      for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
        const dueDate = toDateString(year, rule.month, rule.day)
        const due = new Date(dueDate)
        if (due < start || due >= end) continue
        results.push({
          ...base,
          period_label: assessmentYear(year, rule.month),
          due_date: dueDate,
        })
      }
      break
    }

    case 'event': {
      const rule = template.rule as EventRule
      // ROC annual return: 60 days after the AGM. Without an AGM date on the
      // client there is nothing to anchor to, so we generate nothing rather
      // than inventing a date the CA would have to correct.
      if (rule.anchor !== 'agm_date' || !client.agm_date) break
      const agm = new Date(client.agm_date)
      if (Number.isNaN(agm.getTime())) break
      const due = addDays(agm, rule.offset_days)
      results.push({
        ...base,
        period_label: financialYear(agm.getFullYear(), agm.getMonth() + 1),
        due_date: toDateString(due.getFullYear(), due.getMonth() + 1, due.getDate()),
      })
      break
    }
  }

  return results
}

export function generateForClient(
  templates: DeadlineTemplate[],
  client: DeadlineClient,
  options?: { from?: Date; horizonMonths?: number; lookbackMonths?: number }
): GeneratedDeadline[] {
  return templates.flatMap((template) => expandTemplate(template, client, options))
}
