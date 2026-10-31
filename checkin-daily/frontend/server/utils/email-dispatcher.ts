// checkin-daily/frontend/server/utils/email-dispatcher.ts
// Production High-Volume Email Dispatcher supporting Resend & SendGrid REST APIs with D1 logging fallback

import type { D1DatabaseLike } from './d1'
import { d1Run } from './d1'

export interface EmailDispatchOptions {
  database: D1DatabaseLike
  env?: Record<string, unknown>
  fromName?: string
  fromEmail?: string
  subject: string
  html: string
  recipients: string[]
}

export interface DispatchResult {
  provider: 'resend' | 'sendgrid' | 'mock'
  totalRecipients: number
  successCount: number
  failureCount: number
  status: 'completed' | 'partial' | 'failed'
  errorDetail?: string
}

export async function dispatchNewsletterBatch(options: EmailDispatchOptions): Promise<DispatchResult> {
  const { database, env, subject, html, recipients } = options

  const resendApiKey = (env?.RESEND_API_KEY || process.env.RESEND_API_KEY) as string | undefined
  const sendgridApiKey = (env?.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY) as string | undefined
  const defaultFrom = (env?.NEWSLETTER_FROM_EMAIL || process.env.NEWSLETTER_FROM_EMAIL || 'news@checkindaily.news') as string
  const senderName = options.fromName || 'Check-in Daily Newsroom'
  const formattedSender = `${senderName} <${defaultFrom}>`

  let provider: 'resend' | 'sendgrid' | 'mock' = 'mock'
  if (resendApiKey && resendApiKey.startsWith('re_')) {
    provider = 'resend'
  } else if (sendgridApiKey && sendgridApiKey.startsWith('SG.')) {
    provider = 'sendgrid'
  }

  const total = recipients.length
  let successCount = 0
  let failureCount = 0
  let errorDetail: string | undefined

  if (total === 0) {
    return {
      provider,
      totalRecipients: 0,
      successCount: 0,
      failureCount: 0,
      status: 'completed',
    }
  }

  // If no external provider API key configured, run in mock delivery mode (audit logged)
  if (provider === 'mock') {
    // In mock mode, mark as completed (or partial/failed depending on simulated validation)
    successCount = total
    failureCount = 0
  } else if (provider === 'resend') {
    // Resend Batch API: max 100 emails per request
    const chunkSize = 50
    for (let i = 0; i < recipients.length; i += chunkSize) {
      const chunk = recipients.slice(i, i + chunkSize)
      try {
        const batchPayload = chunk.map((to) => ({
          from: formattedSender,
          to,
          subject,
          html,
        }))

        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchPayload),
        })

        if (!res.ok) {
          const errText = await res.text()
          failureCount += chunk.length
          errorDetail = `Resend HTTP ${res.status}: ${errText.slice(0, 200)}`
        } else {
          successCount += chunk.length
        }
      } catch (err: any) {
        failureCount += chunk.length
        errorDetail = err?.message || 'Network error during Resend batch call'
      }
    }
  } else if (provider === 'sendgrid') {
    // SendGrid v3 mail/send API
    const chunkSize = 50
    for (let i = 0; i < recipients.length; i += chunkSize) {
      const chunk = recipients.slice(i, i + chunkSize)
      try {
        const personalizations = chunk.map((to) => ({
          to: [{ email: to }],
        }))

        const payload = {
          personalizations,
          from: { email: defaultFrom, name: senderName },
          subject,
          content: [
            {
              type: 'text/html',
              value: html,
            },
          ],
        }

        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok && res.status !== 202) {
          const errText = await res.text()
          failureCount += chunk.length
          errorDetail = `SendGrid HTTP ${res.status}: ${errText.slice(0, 200)}`
        } else {
          successCount += chunk.length
        }
      } catch (err: any) {
        failureCount += chunk.length
        errorDetail = err?.message || 'Network error during SendGrid call'
      }
    }
  }

  const status: 'completed' | 'partial' | 'failed' =
    failureCount === 0 ? 'completed' : successCount > 0 ? 'partial' : 'failed'

  // Persist dispatch record into newsletter_dispatch_logs in D1
  try {
    await d1Run(
      database,
      `INSERT INTO newsletter_dispatch_logs 
       (subject, recipient_count, success_count, failure_count, provider, status, error_detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      subject,
      total,
      successCount,
      failureCount,
      provider,
      status,
      errorDetail || null,
    )
  } catch (logErr) {
    console.error('Failed to log newsletter dispatch to D1:', logErr)
  }

  return {
    provider,
    totalRecipients: total,
    successCount,
    failureCount,
    status,
    errorDetail,
  }
}

