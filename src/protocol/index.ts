/**
 * Single source of message shapes for the app.
 *
 * All protocol types and envelope machinery come from @miobots/protocol.
 * Never hand-write a message shape here or elsewhere in the app —
 * re-export from this module instead.
 */

export * from '@miobots/protocol';