// Client seam for approval-to-phone. The browser asks our own /api/passport/notify/*
// routes to send a real push/SMS and then polls whether the phone tapped Approve. All
// channel secrets (ntfy topic, Twilio creds) stay server-side.

import { api } from './apiBase.ts'

export interface PhoneApprovalHandle {
  id: string
  channel: 'push' | 'sms' | 'push+sms' | 'simulation'
  target: string
  pushed: boolean
  approvableFromPhone: boolean
}

export async function requestPhoneApproval(input: { title: string; summary: string; amount?: number | null }): Promise<PhoneApprovalHandle | null> {
  try {
    const r = await fetch(api('/api/passport/notify/approval'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const d = (await r.json()) as {
      ok?: boolean
      id?: string
      channel?: PhoneApprovalHandle['channel']
      target?: string
      pushed?: boolean
      approvable_from_phone?: boolean
    }
    if (!d.ok || !d.id) return null
    return {
      id: d.id,
      channel: d.channel ?? 'simulation',
      target: d.target ?? 'your phone',
      pushed: Boolean(d.pushed),
      approvableFromPhone: Boolean(d.approvable_from_phone),
    }
  } catch {
    return null
  }
}

export type PhoneStatus = 'pending' | 'approved' | 'denied' | 'expired'

export async function pollPhoneStatus(id: string): Promise<PhoneStatus> {
  try {
    const r = await fetch(api(`/api/passport/notify/status?id=${encodeURIComponent(id)}`))
    const d = (await r.json()) as { status?: PhoneStatus }
    return d.status ?? 'expired'
  } catch {
    return 'pending' // transient network blip — keep polling rather than give up
  }
}
