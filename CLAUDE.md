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

**Each manifest half is fresh on its own clock.** A Brain tick must never refresh the robot's half —
otherwise a dead robot looks alive for as long as the Brain is up.

**The link heartbeats both ways.** Send `sys.heartbeat` every 5 s, and go offline after three missed
beats from the Brain without waiting for `onclose`. A pulled router does not close the socket.

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
npm test           # node's built-in runner; Node 26 strips types, so no framework is needed
npm run typecheck
```

On a phone, point the app at the laptop: `EXPO_PUBLIC_BRAIN_URL=ws://<laptop-ip>:8080/ws npx expo start`.
Unset, it dials `ProtocolDefaults.DEFAULT_BRAIN_URL` (`ws://localhost:8080/ws`). `npm run web` is
not usable yet — `react-native-web` is not installed.

`npm test` covers the non-JSX modules — the link and the capability merge, which is where the
logic lives. Screens are verified on a device.

**React Native and TypeScript were chosen to share types with the TypeScript Brain**, which
eliminates a class of contract-drift bugs before it can exist. **Import shared types from
`miobots-protocol`; never re-type a message shape by hand.** That is the entire point of matching
languages.

*This choice was recorded as a taken default rather than a confirmed decision — it is the only
choice here with real switching cost. If it is being revisited, do that before the screens exist,
not after.*

## Current state

See [[STATUS]] for the project's state; this section covers only what is true inside this repo.

Landed: the app skeleton and navigation shell (S0.1), shared protocol types (S0.2), the
three-state capability control (S1.1), the link to Brain's hub (S0.3), the manifest merge (S1.2),
the home screen with staleness marking (S1.3), and the unplug-the-router behaviour (S1.4).

**The link heartbeats both ways** (ENVELOPE §8). It sends `sys.heartbeat` every 5 s, because the
hub drops a connection silent for 15 s. It also goes offline after three missed beats from the
Brain without waiting for `onclose`: a pulled router does not close the socket, it just goes quiet.

**The capability list comes off the wire, never from this repo.** `capabilities/catalog.ts` holds
labels and actions only; which capabilities exist, and what state each is in, is whatever the
publisher said. A capability this build has never heard of still renders, because a robot on newer
firmware must not silently lose controls.

**Each manifest half is fresh on its own clock** (`LinkSnapshot.halfAtMs`). The Brain publishes its
half every 10 s; with one shared timestamp, that would keep a dead robot looking fresh for as long
as the Brain was up. A half goes stale after three missed ticks, so a dead robot takes ~30 s to
show as unreachable, while a dead Brain shows at once.

**The status tiles are unknown on `live`.** Battery, room and activity ride on telemetry topics
(P2.4) that do not exist yet, so they render as unknown rather than inventing a value.

Design work and UI research were done once and lost with an old Linear board; **if those Figma
files still exist, link them into the vault's `02 Design` folder** before starting from scratch.

## Where the design lives

- `../../03 Engineering/Components/Synapse/SYNAPSE_SPEC.md` — every screen, with the reasoning
- `../../03 Engineering/Components/Synapse/SYNAPSE_DECISIONS.md` — **wins on conflict**
- `../../03 Engineering/Components/Synapse/SYNAPSE_TASKS.md` — eleven phases with exit checks
- `../../02 Design/Design.md` — brand, body, voice, and the constraints design has to work inside
