import { DurableObject } from 'cloudflare:workers'

export const pendingSeconds = 600
export const sessionSeconds = 7 * 86400
const revision = '2026-11-15'

// Each instance belongs to one site, provider and provider user ID. No profile or provider token is stored.
export class Member extends DurableObject {
  async issue(site, provider, digest) {
    const now = Date.now()
    const expires = await this.ctx.storage.transaction(async tx => {
      const member = await tx.get('member')
      const sessions = (await tx.get('sessions') || []).filter(s => s.expires > now).slice(-9)
      const expires = now + 1000 * (member ? sessionSeconds : pendingSeconds)
      sessions.push({ site, provider, digest, expires, pending: !member })
      await tx.put('sessions', sessions)
      return expires
    })
    const alarm = await this.ctx.storage.getAlarm()
    if (alarm === null || alarm > expires) await this.ctx.storage.setAlarm(expires)
  }

  async act(site, digest, action) {
    return this.ctx.storage.transaction(async tx => {
      const sessions = await tx.get('sessions') || []
      const session = sessions.find(s => s.site === site && s.digest === digest && s.expires > Date.now())
      if (!session) return null
      let member = await tx.get('member')
      if (action === 'logout') {
        await tx.put('sessions', sessions.filter(s => s !== session))
        return true
      }
      if (action === 'delete' && !session.pending) {
        await tx.delete(['member', 'sessions'])
        return true
      }
      if (action === 'consent' && session.pending) {
        member ??= { provider: session.provider, joined: Date.now(), terms: revision, privacy: revision, age14: true }
        await tx.put('member', member)
        session.pending = false
        session.expires = Date.now() + 1000 * sessionSeconds
        await tx.put('sessions', sessions)
      }
      return { pending: session.pending, provider: session.provider, joined: member?.joined }
    })
  }

  async alarm() {
    await this.ctx.storage.transaction(async tx => {
      const sessions = (await tx.get('sessions') || []).filter(s => s.expires > Date.now())
      if (!sessions.length) { await tx.delete('sessions'); return }
      await tx.put('sessions', sessions)
      await tx.setAlarm(Math.min(...sessions.map(s => s.expires)))
    })
  }
}
