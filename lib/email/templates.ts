import { formatDate, formatPaise } from '@/lib/format'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * One shell for every email. Inline styles only — Gmail and Outlook strip
 * <style> blocks, and Indian SMBs read these on phones.
 */
function shell({
  heading,
  body,
  ctaLabel,
  ctaUrl,
  firmName,
}: {
  heading: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
  firmName: string
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e6e6e2;">
    <tr><td style="padding:28px;">
      <p style="margin:0 0 18px;font-size:13px;color:#6b6b66;">${escapeHtml(firmName)}</p>
      <h1 style="margin:0 0 12px;font-size:19px;line-height:1.35;">${escapeHtml(heading)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#3a3a36;">${body}</div>
      ${
        ctaLabel && ctaUrl
          ? `<p style="margin:24px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:15px;font-weight:500;">${escapeHtml(ctaLabel)}</a></p>`
          : ''
      }
    </td></tr>
  </table>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#8a8a84;text-align:center;">
    Sent by ${escapeHtml(firmName)} via CAConnect
  </p>
</body></html>`
}

export function deadlineReminderEmail({
  clientName,
  firmName,
  label,
  periodLabel,
  dueDate,
  daysAway,
}: {
  clientName: string
  firmName: string
  label: string
  periodLabel: string
  dueDate: string
  daysAway: number
}) {
  const when =
    daysAway <= 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`

  return {
    subject: `Reminder: ${label} (${periodLabel}) is due ${when}`,
    html: shell({
      firmName,
      heading: `${label} is due ${when}`,
      body: `
        <p style="margin:0 0 12px;">Dear ${escapeHtml(clientName)},</p>
        <p style="margin:0 0 12px;">This is a reminder that your <strong>${escapeHtml(label)}</strong> filing for <strong>${escapeHtml(periodLabel)}</strong> is due on <strong>${escapeHtml(formatDate(dueDate))}</strong>.</p>
        <p style="margin:0;">If we are still waiting on any documents from you, please send them across at the earliest so we can file on time.</p>
      `,
    }),
  }
}

export function documentNudgeEmail({
  clientName,
  firmName,
  title,
  outstanding,
  uploadUrl,
}: {
  clientName: string
  firmName: string
  title: string
  outstanding: string[]
  uploadUrl: string
}) {
  return {
    subject: `Still awaiting your documents — ${title}`,
    html: shell({
      firmName,
      heading: 'A few documents are still pending',
      body: `
        <p style="margin:0 0 12px;">Dear ${escapeHtml(clientName)},</p>
        <p style="margin:0 0 12px;">We are still waiting on the following for <strong>${escapeHtml(title)}</strong>:</p>
        <ul style="margin:0 0 12px;padding-left:20px;">
          ${outstanding.map((item) => `<li style="margin-bottom:4px;">${escapeHtml(item)}</li>`).join('')}
        </ul>
        <p style="margin:0;">You can upload them from your phone — no login needed.</p>
      `,
      ctaLabel: 'Upload documents',
      ctaUrl: uploadUrl,
    }),
  }
}

/**
 * Sent to the consumer the moment they book. This email carries their ONLY
 * credential — the booking link — so it matters more than a receipt: lose it
 * and they cannot see the booking or leave a review afterwards.
 */
export function bookingReceivedEmail({
  contactName,
  caName,
  bookingUrl,
  packageTitle,
  amountPaise,
}: {
  contactName: string
  caName: string
  bookingUrl: string
  packageTitle: string | null
  amountPaise: number | null
}): { subject: string; html: string } {
  const what = packageTitle
    ? `<p style="margin:0 0 12px;">You asked about <strong>${escapeHtml(packageTitle)}</strong>${
        amountPaise !== null ? ` — ${escapeHtml(formatPaise(amountPaise))}` : ''
      }.</p>`
    : ''

  return {
    subject: `Your request to ${caName}`,
    html: shell({
      firmName: 'CAConnect',
      heading: `Your request has reached ${caName}`,
      body: `
        <p style="margin:0 0 12px;">Hello ${escapeHtml(contactName)},</p>
        ${what}
        <p style="margin:0 0 12px;">They will get back to you directly. You can check the
        status of your request any time using the link below — keep this email,
        it is the only way back to it.</p>
      `,
      ctaLabel: 'View your request',
      ctaUrl: bookingUrl,
    }),
  }
}

/** Sent to the CA when a marketplace lead arrives. */
export function newBookingEmail({
  firmName,
  contactName,
  city,
  packageTitle,
  amountPaise,
  message,
  dashboardUrl,
}: {
  firmName: string
  contactName: string
  city: string | null
  packageTitle: string | null
  amountPaise: number | null
  message: string | null
  dashboardUrl: string
}): { subject: string; html: string } {
  const rows = [
    packageTitle ? `<li>${escapeHtml(packageTitle)}${amountPaise !== null ? ` — ${escapeHtml(formatPaise(amountPaise))}` : ''}</li>` : '',
    city ? `<li>${escapeHtml(city)}</li>` : '',
  ]
    .filter(Boolean)
    .join('')

  return {
    subject: `New enquiry from ${contactName}`,
    html: shell({
      firmName,
      heading: `${contactName} wants to work with you`,
      body: `
        <p style="margin:0 0 12px;">A new enquiry came in through your CAConnect listing.</p>
        ${rows ? `<ul style="margin:0 0 12px;padding-left:18px;">${rows}</ul>` : ''}
        ${message ? `<p style="margin:0 0 12px;padding:12px;background:#f6f6f4;border-radius:8px;">${escapeHtml(message)}</p>` : ''}
        <p style="margin:0;">Accept it in your dashboard and it becomes a client automatically.</p>
      `,
      ctaLabel: 'Open your bookings',
      ctaUrl: dashboardUrl,
    }),
  }
}
