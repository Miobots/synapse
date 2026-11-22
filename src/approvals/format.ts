import type { AuditEntry, AuditView, JsonValue } from '../protocol/index.ts'

/**
 * The card shows the **exact** arguments (S5.1): one line per key, each value as the JSON the
 * laptop will receive. A summary would be a second thing to trust; this is the thing itself.
 */
export function argumentLines(args: Record<string, JsonValue>): string[] {
  return Object.keys(args).sort().map((key) => `${key}: ${JSON.stringify(args[key])}`)
}

/** "Expires in 47s", or undefined once it has lapsed. */
export function secondsLeft(expiresAt: number, now: number): number | undefined {
  const seconds = Math.ceil((expiresAt - now) / 1000)
  return seconds > 0 ? seconds : undefined
}

/** One audit row as words (S5.2): what ran, with which arguments, and who approved it. */
export function auditLine(entry: AuditEntry): { title: string; detail: string } {
  if (entry.event === 'killswitch_on') return { title: 'Laptop access switched off', detail: `by ${entry.approved_by ?? 'unknown'}` }
  if (entry.event === 'killswitch_off') return { title: 'Laptop access switched back on', detail: `by ${entry.approved_by ?? 'unknown'}` }
  const args = entry.args ? argumentLines(entry.args).join(', ') : ''
  return {
    title: `${entry.tool ?? 'unknown tool'}${args ? ` · ${args}` : ''}`,
    detail: entry.approved_by ? `approved by ${entry.approved_by}` : 'read only, no approval needed',
  }
}

/** The banner over the log: verified, or the first row that no longer matches (B5.5). */
export function chainBanner(chain: AuditView['chain']): string {
  if (chain.ok) return `Verified: all ${chain.checked} rows match their fingerprints.`
  return `Tampered: row ${chain.first_bad_id} no longer matches. Everything from it on can't be trusted.`
}
