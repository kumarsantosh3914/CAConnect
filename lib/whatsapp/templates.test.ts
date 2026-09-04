import { describe, expect, it } from 'vitest'
import {
  REQUIRED_TEMPLATES,
  deadlineReminderTemplate,
  documentRequestTemplate,
} from './templates'

/**
 * The parameter count must match what Meta approved, or every send fails with
 * a 132000 error that only shows up in production. Counting the {{n}} markers
 * in the body against the params we build is the one check that catches a
 * template edited on one side and not the other.
 */
function placeholderCount(body: string): number {
  return new Set(body.match(/\{\{\d+\}\}/g) ?? []).size
}

const deadline = deadlineReminderTemplate({
  clientName: 'Ramesh Traders',
  firmName: 'Sharma & Associates',
  label: 'GSTR-1 filing',
  periodLabel: 'Aug 2026',
  dueDate: '11 Sept 2026',
})

const documents = documentRequestTemplate({
  clientName: 'Ramesh Traders',
  firmName: 'Sharma & Associates',
  title: 'GST documents',
  outstanding: ['Sales register', 'Purchase register'],
  uploadUrl: 'https://www.bevritti.in/upload/abc',
})

describe('template contracts', () => {
  it('supplies exactly one parameter per placeholder', () => {
    expect(deadline.params).toHaveLength(placeholderCount(deadline.body))
    expect(documents.params).toHaveLength(placeholderCount(documents.body))
  })

  it('registers under the names the send path asks for', () => {
    expect(REQUIRED_TEMPLATES).toContain(deadline.name)
    expect(REQUIRED_TEMPLATES).toContain(documents.name)
  })

  it('uses names Meta accepts — lowercase and underscores only', () => {
    for (const name of REQUIRED_TEMPLATES) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })
})

describe('parameter sanitising', () => {
  it('strips newlines, which Meta rejects outright', () => {
    const t = deadlineReminderTemplate({
      clientName: 'Ramesh\nTraders',
      firmName: 'Sharma\r\n& Associates',
      label: 'GSTR-1',
      periodLabel: 'Aug 2026',
      dueDate: '11 Sept 2026',
    })
    for (const p of t.params) {
      expect(p.text).not.toMatch(/[\r\n]/)
    }
  })

  it('collapses long runs of spaces, which Meta also rejects', () => {
    const t = deadlineReminderTemplate({
      clientName: 'Ramesh     Traders',
      firmName: 'Sharma',
      label: 'GSTR-1',
      periodLabel: 'Aug 2026',
      dueDate: '11 Sept 2026',
    })
    expect(t.params[0].text).toBe('Ramesh Traders')
  })

  it('keeps the upload link intact — it is the point of the message', () => {
    expect(documents.params[4].text).toBe('https://www.bevritti.in/upload/abc')
  })

  it('lists every outstanding document', () => {
    expect(documents.params[3].text).toBe('Sales register, Purchase register')
  })
})
