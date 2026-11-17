/**
 * The laptop shows its code as "418 902"; people type it however they like. Returns the six digits
 * to send, or undefined while it isn't a whole code yet. The Brain checks it again (S9.2).
 */
export function pairingCode(input: string): string | undefined {
  const digits = input.replace(/[\s-]/g, '')
  return /^[0-9]{6}$/.test(digits) ? digits : undefined
}
