import { describe, expect, it } from 'vitest'
import { splitSubjectAndBody } from './client-email'

describe('splitSubjectAndBody', () => {
  it('splits a well-formed subject and body', () => {
    const result = splitSubjectAndBody('Subject: GSTR-3B due in 3 days\n\nDear Ramesh,\n\nYour filing is due soon.')
    expect(result.subject).toBe('GSTR-3B due in 3 days')
    expect(result.body).toBe('Dear Ramesh,\n\nYour filing is due soon.')
  })

  it('trims surrounding whitespace from both parts', () => {
    const result = splitSubjectAndBody('Subject:   Reminder  \n\n  Hello there.  ')
    expect(result.subject).toBe('Reminder')
    expect(result.body).toBe('Hello there.')
  })

  it('handles CRLF line endings the same as LF', () => {
    const result = splitSubjectAndBody('Subject: Test\r\n\r\nBody text.')
    expect(result.subject).toBe('Test')
    expect(result.body).toBe('Body text.')
  })

  it('falls back to treating the whole text as the body when there is no subject line', () => {
    // Streaming: partial output before "Subject:" has fully arrived, or a
    // model that ignores the format instruction. Losing the CA's content to
    // a strict parse failure would be worse than a missing subject.
    const result = splitSubjectAndBody('Dear client, just a note with no subject line.')
    expect(result.subject).toBe('')
    expect(result.body).toBe('Dear client, just a note with no subject line.')
  })

  it('does not treat a mid-body colon as a false subject match', () => {
    const result = splitSubjectAndBody('Subject: Update\n\nNote: please see attached.')
    expect(result.subject).toBe('Update')
    expect(result.body).toBe('Note: please see attached.')
  })
})
