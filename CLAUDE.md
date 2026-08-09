# Synapse — the companion app

**Synapse captures human intent, presents system state, and collects human consent. That is all it
does.** Everything it displays is owned somewhere else. Everything it does is a request, never a
decision.

**If Synapse disappears, nothing physical stops working.** Alerts wait in the feed, reminders still
fire, the robot still docks and still avoids the stairs.

---

## Non-negotiable rules

**The app holds no authority and never invents state.** Its local store is a cache, explicitly not
a source of truth, and it reconciles to Brain's truth on reconnect.

**Every capability-driven control goes through one shared component with exactly three states:**
available · degraded with a note · unavailable **with a human-readable reason**.

**Never grey out a control silently.** A user who taps a dead button and gets nothing concludes the
product is broken; one who reads *"can't reach the Brain right now"* concludes it is honest. **A
greyed-out button with no explanation is a design bug, not a technical one.**

**Build the manifest-driven control component before any feature screen.** This is the expensive
mistake here. Build screens first with connectivity checks scattered through them and retrofitting
the manifest means touching every screen already written.

**The manifest arrives in two halves** — Heart publishes what Heart can verify, Brain publishes the
cloud-tier section. The app renders the union and **must survive either half being missing
independently.** Four states, not two. The one people forget: *robot unreachable, Brain fine* — the
app must stay fully useful for history, memory, personas and settings rather than looking dead.

**Cached state always carries a visible staleness marker.** Presenting stale data as live is the
one way a read-only app can still lie.

**The app never enforces a safety property.** The deadman lives on Heart at ~400 ms and the app
cannot disable it. The app's job is to *surface* it — show "connection lost" the moment the robot
stops, not seconds later. A timeout enforced by the thing that might have crashed is not a timeout.

**Wi-Fi credentials go phone → Heart only.** Never to Brain, never persisted in the app.

**Never cached, ever:** persona embeddings, the memory log, the audit log. Query them; don't mirror
them.

**No device is auto-adopted.** Anything discovered on the network needs a one-time confirmation
code. Finding a daemon is not consent to use it.

---

## Vocabulary warning

**"Persona" means two different things in this project.** Here and in the engineering documents it
means *an enrolled household member with a face embedding*. Product and design people use it to
mean *a user archetype*. Both meanings appear in the vault. When writing product notes, say "user
archetype".

---

## Low authority, high dependency

The app holds no authority — but it is **the only place a human can confirm anything**, so two of
its screens are dependencies for other components rather than decorations on top of them:

- **The approval surface unblocks Brain's permission model.** Until it exists, approvals go through
  a temporary `curl` endpoint and the thing that makes the agent look engineered rather than
  reckless cannot be shown.
- **The region-label screen unblocks semantic navigation.** "Go to the kitchen" cannot work until
  something has said which region *is* the kitchen. It is also where a robot-*proposed* label
  becomes confirmed — and until confirmed, the robot hedges about that room name forever.

Build the app strictly last and both stall.

---

## Stack

Expo SDK 57, React Native 0.86, React 19, TypeScript. Expo rather than bare React Native CLI —
it is the supported path now.

```bash
npm start          # dev server
npm run android
npm run web
```

**React Native and TypeScript were chosen to share types with the TypeScript Brain**, which
eliminates a class of contract-drift bugs before it can exist. **Import shared types from
`miobots-protocol`; never re-type a message shape by hand.** That is the entire point of matching
languages.

*This choice was recorded as a taken default rather than a confirmed decision — it is the only
choice here with real switching cost. If it is being revisited, do that before the screens exist,
not after.*

## Current state

**Fresh Expo scaffold.** `App.tsx` is the template. Nothing project-specific is implemented.

First tasks: app skeleton with a WebSocket client to Brain's hub → the manifest-driven control
component → the home and status screen. Design work and UI research were done once and lost with an
old Linear board; **if those Figma files still exist, link them into the vault's `02 Design`
folder** before starting from scratch.

## Where the design lives

- `../../03 Engineering/Components/Synapse/SYNAPSE_SPEC.md` — every screen, with the reasoning
- `../../03 Engineering/Components/Synapse/SYNAPSE_DECISIONS.md` — **wins on conflict**
- `../../03 Engineering/Components/Synapse/SYNAPSE_TASKS.md` — eleven phases with exit checks
- `../../02 Design/Design.md` — brand, body, voice, and the constraints design has to work inside
