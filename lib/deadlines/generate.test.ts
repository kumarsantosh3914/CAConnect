import { describe, expect, it } from 'vitest'
import { expandTemplate, generateForClient, type DeadlineClient } from './generate'
import type { DeadlineTemplateRow } from '@/types/database'

/**
 * The compliance calendar is the subtlest code in CAConnect: Indian financial
 * years run April–March, a return filed on the 11th covers the PREVIOUS month,
 * and an ITR due 31 July 2026 assesses FY2025-26 as AY2026-27. Getting any of
 * that wrong shows a CA the wrong date for a statutory filing.
 *
 * Fixtures mirror supabase/migrations/0003_seed_deadline_templates.sql exactly.
 * If that seed changes, these must change with it.
 */

const template = (over: Partial<DeadlineTemplateRow>): DeadlineTemplateRow => ({
  id: 'tpl-' + (over.code ?? 'x'),
  code: 'x',
  service_type: 'other',
  label: 'X',
  frequency: 'monthly',
  rule: {},
  applies_when: null,
  description: null,
  sort_order: 0,
  ...over,
})

const GSTR1 = template({
  code: 'gstr1_monthly',
  service_type: 'gstr1',
  label: 'GSTR-1',
  frequency: 'monthly',
  rule: { day: 11 },
})

const GSTR3B = template({
  code: 'gstr3b_monthly',
  service_type: 'gstr3b',
  label: 'GSTR-3B',
  frequency: 'monthly',
  rule: { day: 20 },
})

const TDS = template({
  code: 'tds_quarterly',
  service_type: 'tds',
  label: 'TDS return',
  frequency: 'quarterly',
  rule: { months: [7, 10, 1, 5], day: 15 },
})

const ITR_NON_AUDIT = template({
  code: 'itr_non_audit',
  service_type: 'itr',
  label: 'ITR filing (non-audit)',
  frequency: 'annual',
  rule: { month: 7, day: 31 },
  applies_when: { is_audit_case: false },
})

const ITR_AUDIT = template({
  code: 'itr_audit',
  service_type: 'itr',
  label: 'ITR filing (audit case)',
  frequency: 'annual',
  rule: { month: 10, day: 31 },
  applies_when: { is_audit_case: true },
})

const ROC = template({
  code: 'roc_annual_return',
  service_type: 'roc',
  label: 'ROC annual return',
  frequency: 'event',
  rule: { offset_days: 60, anchor: 'agm_date' },
})

const client = (over: Partial<DeadlineClient> = {}): DeadlineClient => ({
  id: 'client-1',
  is_audit_case: false,
  agm_date: null,
  services: [],
  ...over,
})

/** Fixed "today" so tests do not drift as real time passes. */
const FROM = new Date(2026, 8, 4) // 4 September 2026

describe('service tag gating', () => {
  it('generates nothing for a service the client is not tagged with', () => {
    const result = expandTemplate(GSTR1, client({ services: ['itr'] }), { from: FROM })
    expect(result).toEqual([])
  })

  it('generates only for tagged services', () => {
    const result = generateForClient([GSTR1, GSTR3B, TDS], client({ services: ['gstr1'] }), {
      from: FROM,
    })
    expect(new Set(result.map((d) => d.service_type))).toEqual(new Set(['gstr1']))
  })
})

describe('monthly returns', () => {
  const result = expandTemplate(GSTR1, client({ services: ['gstr1'] }), { from: FROM })

  it('falls due on the rule day of each month', () => {
    expect(result.every((d) => d.due_date.endsWith('-11'))).toBe(true)
  })

  it('covers the PREVIOUS month — a return filed 11 Jun is for May', () => {
    const june = result.find((d) => d.due_date === '2026-06-11')
    expect(june?.period_label).toBe('May 2026')
  })

  it('rolls the year over correctly at the January boundary', () => {
    const january = result.find((d) => d.due_date === '2027-01-11')
    expect(january?.period_label).toBe('Dec 2026')
  })

  it('looks back 3 months so a CA joining mid-year sees what they already owe', () => {
    // From 4 Sep 2026, the earliest due date should be 11 Jun 2026.
    expect(result[0].due_date).toBe('2026-06-11')
  })

  it('respects the horizon', () => {
    const short = expandTemplate(GSTR1, client({ services: ['gstr1'] }), {
      from: FROM,
      horizonMonths: 2,
      lookbackMonths: 0,
    })
    expect(short.map((d) => d.due_date)).toEqual(['2026-09-11', '2026-10-11'])
  })

  it('uses the rule day, whichever it is', () => {
    const result3b = expandTemplate(GSTR3B, client({ services: ['gstr3b'] }), { from: FROM })
    expect(result3b.every((d) => d.due_date.endsWith('-20'))).toBe(true)
  })
})

describe('short months', () => {
  it('clamps a 31st rule to the real last day of the month', () => {
    // 31st of every month, over a window that includes February 2027.
    const thirtyFirst = template({
      code: 'test_31',
      service_type: 'gstr1',
      label: 'Something due on the 31st',
      frequency: 'monthly',
      rule: { day: 31 },
    })
    const result = expandTemplate(thirtyFirst, client({ services: ['gstr1'] }), {
      from: FROM,
      lookbackMonths: 0,
      horizonMonths: 12,
    })
    const february = result.find((d) => d.due_date.startsWith('2027-02'))
    // 2027 is not a leap year.
    expect(february?.due_date).toBe('2027-02-28')
  })

  it('handles February in a leap year', () => {
    const thirtyFirst = template({
      code: 'test_31',
      service_type: 'gstr1',
      label: 'Something due on the 31st',
      frequency: 'monthly',
      rule: { day: 31 },
    })
    const result = expandTemplate(thirtyFirst, client({ services: ['gstr1'] }), {
      from: new Date(2028, 0, 1),
      lookbackMonths: 0,
      horizonMonths: 3,
    })
    const february = result.find((d) => d.due_date.startsWith('2028-02'))
    expect(february?.due_date).toBe('2028-02-29')
  })
})

describe('quarterly TDS returns', () => {
  const result = expandTemplate(TDS, client({ services: ['tds'] }), {
    from: FROM,
    lookbackMonths: 3,
    horizonMonths: 12,
  })

  it('falls only in the four filing months', () => {
    const months = new Set(result.map((d) => Number(d.due_date.slice(5, 7))))
    expect([...months].sort((a, b) => a - b)).toEqual([1, 5, 7, 10])
  })

  it('always falls on the 15th', () => {
    expect(result.every((d) => d.due_date.endsWith('-15'))).toBe(true)
  })

  it('labels the quarter that just ended, in the correct financial year', () => {
    // Filed 15 Oct 2026 → covers Jul–Sep 2026 → Q2 of FY2026-27.
    const october = result.find((d) => d.due_date === '2026-10-15')
    expect(october?.period_label).toBe('Q2 FY2026-27')
  })

  it('keeps a January filing inside the financial year that began the prior April', () => {
    // Filed 15 Jan 2027 → covers Oct–Dec 2026 → Q3 of FY2026-27, not FY2027-28.
    const january = result.find((d) => d.due_date === '2027-01-15')
    expect(january?.period_label).toBe('Q3 FY2026-27')
  })

  it('labels the final quarter of the financial year correctly', () => {
    // Filed 15 May 2027 → covers Jan–Mar 2027 → Q4 of FY2026-27.
    const may = result.find((d) => d.due_date === '2027-05-15')
    expect(may?.period_label).toBe('Q4 FY2026-27')
  })
})

describe('annual ITR', () => {
  it('uses 31 July for a non-audit client', () => {
    const result = expandTemplate(ITR_NON_AUDIT, client({ services: ['itr'] }), { from: FROM })
    expect(result.map((d) => d.due_date)).toContain('2026-07-31')
  })

  it('labels the assessment year, not the calendar year', () => {
    // Filed 31 July 2026 assesses FY2025-26, which is AY2026-27.
    const result = expandTemplate(ITR_NON_AUDIT, client({ services: ['itr'] }), { from: FROM })
    const y2026 = result.find((d) => d.due_date === '2026-07-31')
    expect(y2026?.period_label).toBe('AY2026-27')
  })

  it('uses 31 October for an audit case', () => {
    const result = expandTemplate(ITR_AUDIT, client({ services: ['itr'], is_audit_case: true }), {
      from: FROM,
    })
    expect(result.every((d) => d.due_date.endsWith('-10-31'))).toBe(true)
  })

  it('gives an audit case the same assessment year as a non-audit one', () => {
    const result = expandTemplate(ITR_AUDIT, client({ services: ['itr'], is_audit_case: true }), {
      from: FROM,
    })
    const y2026 = result.find((d) => d.due_date === '2026-10-31')
    expect(y2026?.period_label).toBe('AY2026-27')
  })
})

describe('applies_when narrowing', () => {
  it('excludes the audit template from a non-audit client', () => {
    const result = expandTemplate(ITR_AUDIT, client({ services: ['itr'], is_audit_case: false }), {
      from: FROM,
    })
    expect(result).toEqual([])
  })

  it('excludes the non-audit template from an audit client', () => {
    const result = expandTemplate(
      ITR_NON_AUDIT,
      client({ services: ['itr'], is_audit_case: true }),
      { from: FROM }
    )
    expect(result).toEqual([])
  })

  it('gives an ITR client exactly one annual deadline per year, never both', () => {
    const audit = generateForClient(
      [ITR_NON_AUDIT, ITR_AUDIT],
      client({ services: ['itr'], is_audit_case: true }),
      { from: FROM }
    )
    const byYear = new Map<string, number>()
    for (const d of audit) {
      const year = d.due_date.slice(0, 4)
      byYear.set(year, (byYear.get(year) ?? 0) + 1)
    }
    expect([...byYear.values()].every((count) => count === 1)).toBe(true)
  })
})

describe('event-anchored ROC filing', () => {
  it('falls 60 days after the AGM', () => {
    const result = expandTemplate(
      ROC,
      client({ services: ['roc'], agm_date: '2026-09-30' }),
      { from: FROM }
    )
    // 30 Sep 2026 + 60 days = 29 Nov 2026.
    expect(result[0]?.due_date).toBe('2026-11-29')
  })

  it('generates nothing without an AGM date, rather than inventing one', () => {
    const result = expandTemplate(ROC, client({ services: ['roc'], agm_date: null }), {
      from: FROM,
    })
    expect(result).toEqual([])
  })

  it('ignores an unparseable AGM date instead of producing NaN', () => {
    const result = expandTemplate(ROC, client({ services: ['roc'], agm_date: 'not-a-date' }), {
      from: FROM,
    })
    expect(result).toEqual([])
  })

  it('crosses a year boundary correctly', () => {
    const result = expandTemplate(
      ROC,
      client({ services: ['roc'], agm_date: '2026-12-15' }),
      { from: FROM }
    )
    // 15 Dec 2026 + 60 days = 13 Feb 2027.
    expect(result[0]?.due_date).toBe('2027-02-13')
  })
})

describe('idempotency key', () => {
  it('produces a unique (template, period) pair for every occurrence', () => {
    // The database enforces uniqueness on (client_id, template_id, period_label).
    // If the engine ever emitted a duplicate pair, re-syncing would silently
    // drop a real deadline.
    const all = generateForClient(
      [GSTR1, GSTR3B, TDS, ITR_NON_AUDIT, ROC],
      client({
        services: ['gstr1', 'gstr3b', 'tds', 'itr', 'roc'],
        agm_date: '2026-09-30',
      }),
      { from: FROM }
    )
    const keys = all.map((d) => `${d.template_id}|${d.period_label}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('is deterministic — the same inputs give the same output', () => {
    const run = () =>
      generateForClient([GSTR1, TDS, ITR_NON_AUDIT], client({ services: ['gstr1', 'tds', 'itr'] }), {
        from: FROM,
      })
    expect(run()).toEqual(run())
  })
})

describe('a realistic client', () => {
  it('produces the full calendar for a GST + ITR trader', () => {
    const all = generateForClient(
      [GSTR1, GSTR3B, TDS, ITR_NON_AUDIT, ITR_AUDIT, ROC],
      client({ services: ['gstr1', 'gstr3b', 'itr'] }),
      { from: FROM }
    )
    const counts = all.reduce<Record<string, number>>((acc, d) => {
      acc[d.service_type] = (acc[d.service_type] ?? 0) + 1
      return acc
    }, {})

    // 15 months of monthly returns (3 back + 12 forward), 2 ITR years.
    expect(counts.gstr1).toBe(15)
    expect(counts.gstr3b).toBe(15)
    expect(counts.itr).toBe(2)
    // Not tagged, so nothing at all.
    expect(counts.tds).toBeUndefined()
    expect(counts.roc).toBeUndefined()
  })
})
