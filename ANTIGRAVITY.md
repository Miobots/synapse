# Synapse (`miobots-synapse`) — Antigravity Rules

**Mobile companion app and human consent collection.** React Native / Expo SDK 57 / TypeScript.

---

## Non-Negotiable Invariants

1. **Zero Authority & Harmless Absence:** Synapse holds no state authority of its own. If the app is closed, the robot and brain function completely uninterrupted.
2. **Capability Manifest-Driven UI (`cap.manifest`):**
   - Controls render across 3 explicit states: `available`, `degraded` (with note), `unavailable` (**with reason string**).
   - **Never silently grey out a button.**
   - Merges Heart section + Brain section, independently handling all 4 presence combinations.
3. **Staleness Marker:** Cached offline state displays prominent staleness marker.
4. **Key Unblocking Dependencies:**
   - **Phase 5 (Approval Surface):** Unblocks Brain Action-tier tool gating and audit verification.
   - **Phase 6 (Region Label Confirmation):** Unblocks Heart proposed room naming and semantic navigation.
5. **Direct LAN Teleoperation:** Virtual joystick and video stream route directly over local Wi-Fi when co-located.
6. **Heartbeats both ways:** the link sends `sys.heartbeat` every 5 s and goes offline after three missed beats from the Brain, without waiting for `onclose`.
7. **Each manifest half is fresh on its own clock:** a Brain tick must never refresh the robot's half.
8. **The approval card is the only approver:** `sys.approval` shows the exact arguments and a countdown; Approve/Reject is the ACK, sent on the connection it arrived on, and pending cards are dropped when the link drops (BRAIN_DECISIONS 27).
9. **A push only opens the app:** approval pushes say only that something is waiting; never approve from a notification, never put arguments in one. Expo Go on Android cannot receive remote push (BRAIN_DECISIONS 28).

---

## Toolchain & Commands

Expo's supported path — **npm, not Bun** (vault `CLAUDE.md`, BRAIN_DECISIONS 21).

```bash
npm install        # Install dependencies
npm start          # Start Expo development server
npm test           # Link and capability-merge tests
npm run typecheck  # TypeScript check
```

On a phone: `EXPO_PUBLIC_BRAIN_URL=ws://<laptop-ip>:8080/ws npx expo start` — `localhost` on a
phone is the phone.

