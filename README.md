# miobots-synapse

The companion app. Expo SDK 57, React Native 0.86, TypeScript. It follows Expo's supported path, so
this repo uses **npm**, not Bun.

```bash
npm install
npm start            # scan the QR code with Expo Go
npm test             # the link and the capability merge — no device needed
npm run typecheck
```

**On a phone, tell the app where the Brain is.** It defaults to `ws://localhost:8080/ws`, and on a
phone `localhost` is the phone itself:

```bash
EXPO_PUBLIC_BRAIN_URL=ws://<laptop-ip>:8080/ws npx expo start
```

The Brain must then listen beyond loopback (`HOST=0.0.0.0` in `miobots-brain`), and the laptop's
firewall must allow ports 8080 (Brain) and 8081 (Expo).

**Approval notifications need the installed app, not Expo Go** (Expo Go can't receive pushes on
Android). One-time setup: put your Firebase `google-services.json` (package `com.miobots.synapse`)
in this folder, and upload the FCM V1 service-account key with `npx eas-cli credentials`. Both are
gitignored; keep the key outside the repo or in `keys/`. Then, with Java 17 and the phone on adb:

```bash
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 npm run android   # builds and installs, ~15 min the first time
EXPO_PUBLIC_BRAIN_URL=ws://<laptop-ip>:8080/ws npx expo start --dev-client
```

See `CLAUDE.md` for the rules that apply here — above all, that every capability-driven control
goes through one shared component with three honest states, and never greys out without a reason.

Design documentation is in the Obsidian vault two levels up, under
`03 Engineering/Components/Synapse/`; current state is in its `STATUS.md`.
