import type { JsonValue } from '../protocol/index.ts'

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
