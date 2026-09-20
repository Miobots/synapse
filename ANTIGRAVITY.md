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

---

## Toolchain & Commands

```bash
bun install    # Install dependencies
bun start      # Start Expo development server
```
