# Shinobi-IRL — AI Development Context

## 1. Project Overview

**Shinobi-IRL** is a browser-based real-time AR/VFX experience inspired by anime-style jutsu.

The user interacts with the camera using hand gestures. MediaPipe hand landmarks drive gesture detection, which drives real-time canvas/WebGL-style procedural VFX.

The project is intended to become a polished public demo/portfolio project.

Current V1 goals:

* Camera-based hand tracking
* 4 jutsu
* High-quality real-time VFX
* Procedural sound effects
* Two-hand support where applicable
* Browser-safe performance
* Video recording/export capability later
* Clean, responsive UI
* No regressions between jutsu

---

# 2. Core Engineering Principle

The most important rule:

> Use the existing architecture. Make the smallest focused change necessary. Do not break existing functionality.

AI coding agents MUST:

1. Inspect the existing implementation before editing.
2. Understand current data flow and state ownership.
3. Avoid inventing APIs when an existing API can be reused.
4. Make focused changes.
5. Run typecheck/build after implementation.
6. Inspect the final diff.
7. Report exact files changed.
8. Never silently modify unrelated systems.

Do NOT rewrite working systems merely because another implementation looks cleaner.

---

# 3. Existing Jutsu

The application currently contains four jutsu:

### Rasengan

Activation:

* Circular hand motion.
* Detection is per hand.
* Two-hand support exists.

Current behavior:

* Stable activation.
* Palm tracking.
* Hand reassignment.
* Two-hand support.
* Distance-based scaling.
* Cinematic close-camera scaling.
* No throw/projectile mechanic.

Important:

> Do NOT reintroduce pinch, throw, projectile, velocity, or impact mechanics.

Audio should treat Rasengan as active if **either hand** is active.

There must be only ONE Rasengan audio loop even if both hands are active.

---

### Lightning / Chidori

Activation:

* Closed fist held for approximately 300 ms.

Current behavior:

* Per-hand detection.
* Two-hand support.
* Hand-held effect.
* Fades when hand opens.

There is NO:

* projectile
* throw
* pinch mechanic
* velocity mechanic
* impact/explosion mechanic

Audio should treat Lightning as active if **either hand** is active.

There must be only ONE Lightning audio loop even if both hands are active.

---

### Doctor Strange Magic Circle

Activation:

* Open palm.

Current behavior:

* Single active detection.
* Existing procedural magic-circle VFX.

Audio:

* Activation sound when becoming active.
* Loop while active.
* Stop when inactive.

---

### Shadow Clone Jutsu

Activation/state:

* Existing Shadow Clone state machine.

Important:

* Shadow Clone has an effect lifecycle rather than a persistent audio loop.

Audio:

* Play a spawn sound only when the existing Shadow Clone effect enters its spawn/activation state.
* Do NOT play the sound every render frame.
* No persistent Shadow Clone audio loop for V1.

---

# 4. Hand Tracking Architecture

MediaPipe provides the existing hand landmarks.

The project already has one hand-tracking pipeline.

DO NOT:

* add another MediaPipe model
* add another camera pipeline
* duplicate hand tracking
* replace the existing detector architecture

Use the existing hand detection/state.

For Lightning specifically, the detection already contains the landmarks used by its renderer.

---

# 5. VFX Architecture Rules

VFX and gesture detection are considered stable systems.

AI agents working on audio MUST NOT modify:

* gesture detectors
* hand tracking
* VFX renderers
* camera pipeline
* jutsu state machines

unless explicitly requested.

The existing VFX should be treated as a black box when implementing audio.

---

# 6. Audio Architecture

The audio system uses the browser Web Audio API.

Audio files:

```text
src/audio/audioManager.ts
src/audio/jutsuAudio.ts
```

## audioManager.ts

Responsibilities:

* Singleton AudioContext
* Master GainNode
* Lazy AudioContext creation
* Browser/WebKit AudioContext compatibility
* User-interaction unlock
* Master volume
* Audio disposal

Important exports include:

```ts
AudioBundle
ensureAudioBundle()
isAudioSupported()
unlockAudio()
setMasterVolume()
getMasterVolume()
attachUnlockListeners()
detachUnlockListeners()
disposeAudio()
```

Do NOT create another AudioContext.

---

# 7. jutsuAudio.ts

`jutsuAudio.ts` is the procedural sound engine.

It currently provides:

### Rasengan

```ts
playRasenganActivation()
playRasenganLoopStart()
playRasenganLoopStop()
```

### Lightning

```ts
playLightningStrike()
playLightningLoopStart()
playLightningLoopStop()
```

### Magic Circle

```ts
playMagicCircleActivation()
playMagicCircleLoopStart()
playMagicCircleLoopStop()
```

### Shadow Clone

```ts
playShadowCloneSpawn()
```

### Audio lifecycle/helpers

```ts
ensureAudioActive()
attachJutsuUnlockListeners()
detachJutsuUnlockListeners()
disposeJutsuAudio()
isJutsuAudioAvailable()
setJutsuMasterVolume()
getJutsuMasterVolume()
ensureAudioBundle()
```

The engine uses procedural Web Audio oscillators, filters, noise, GainNodes and scheduled envelopes.

Do not replace this with external audio files unless explicitly requested.

---

# 8. Current Audio Design

The intended sound mapping is:

| Jutsu        | Activation           | Persistent Loop                  |
| ------------ | -------------------- | -------------------------------- |
| Rasengan     | activation sound     | low-energy rotating/charged loop |
| Lightning    | strike/crackle sound | electrical buzz loop             |
| Magic Circle | magical chime        | mystical drone loop              |
| Shadow Clone | spawn sound          | none                             |

Two-hand behavior:

```text
Left Rasengan active
        +
Right Rasengan inactive
        ↓
Rasengan audio ON

Left active
        +
Right active
        ↓
ONE Rasengan audio loop

Left inactive
        +
Right active
        ↓
Rasengan audio remains ON

Left inactive
        +
Right inactive
        ↓
Rasengan audio OFF
```

Same aggregation model for Lightning.

---

# 9. Audio Integration Layer

The next architectural component is:

```text
src/audio/useJutsuAudio.ts
```

Its responsibility is ONLY to connect existing jutsu state to existing audio functions.

It should:

* detect activation edges
* aggregate two-hand states
* start/stop loops
* trigger one-shot activation sounds
* cleanup loops on unmount

It must NOT:

* change gesture detection
* change VFX
* modify jutsu state
* create AudioContexts
* render anything
* run per-frame audio React state

---

# 10. Edge Triggering

Audio must NOT be triggered every animation/render frame.

Bad:

```text
every frame:
    if active:
        playSound()
```

Correct:

```text
previous = false
current = true
→ activation event
```

For loops:

```text
false → true
    start loop

true → true
    do nothing

true → false
    stop loop
```

For one-shot activation sounds:

```text
false → true
    play once
```

This is especially important for React because the jutsu state may update every frame.

---

# 11. Two-Hand Audio Rule

Rasengan and Lightning audio are **logical jutsu-level loops**, not hand-level loops.

Therefore:

```ts
const rasenganActive =
    leftRasenganActive ||
    rightRasenganActive
```

and:

```ts
const lightningActive =
    leftLightningActive ||
    rightLightningActive
```

Never call loop-start twice just because two hands are active.

---

# 12. React Lifecycle

The audio hook must clean up on unmount.

Expected behavior:

```text
component mount
    ↓
observe jutsu state

jutsu activates
    ↓
start audio

jutsu remains active
    ↓
no repeated start

jutsu deactivates
    ↓
stop audio

component unmount
    ↓
stop all active loops
```

Audio cleanup must never affect the VFX.

---

# 13. Performance Requirements

This is a real-time camera application.

Avoid:

* React state updates every frame for audio
* DOM audio elements created every frame
* unbounded timers
* unbounded AudioNodes
* creating AudioContexts repeatedly
* excessive oscillators
* memory leaks
* duplicated loops

Prefer:

* existing singleton AudioContext
* bounded AudioNodes
* scheduled Web Audio envelopes
* cleanup of stopped sources
* edge-triggered React effects/refs

---

# 14. Future Video Recording

Video recording is planned for a later phase.

Do NOT implement recording during the audio integration task.

However, audio architecture must remain compatible with future browser recording.

Future target:

```text
Camera
   ↓
Existing hand tracking
   ↓
VFX rendering
   ↓
Canvas
   +
Audio
   ↓
MediaRecorder / capture pipeline
   ↓
Recorded video
```

The future recording system may need to capture:

* rendered camera/VFX output
* application audio
* microphone audio optionally later

Therefore:

> Do not architect the audio system around HTMLAudioElement-only playback or anything that prevents routing audio into a future MediaStream/MediaRecorder pipeline.

For V1 audio, Web Audio API is preferred because it provides a controllable audio graph.

Do NOT add MediaRecorder yet.

---

# 15. Testing Requirements

After any code change:

```bash
npm run typecheck
```

Then:

```bash
npm run build
```

Then:

```bash
git diff --check
```

Inspect:

```bash
git status
git diff
```

For visual/audio features, automated compilation is not sufficient.

Manual testing must eventually verify:

### Rasengan

* activation sound plays once
* loop starts once
* loop continues while active
* loop stops after both hands are inactive
* two hands do not create two loops

### Lightning

* activation/strike sound plays once
* loop starts once
* two hands do not double the loop
* opening one hand while the other remains active does not stop audio
* audio stops when both hands are inactive

### Magic Circle

* activation sound plays once
* loop starts once
* loop stops when palm closes

### Shadow Clone

* spawn sound plays once per spawn
* no repeated sound every frame

### Regression

Verify that:

* Rasengan VFX still works
* Lightning VFX still works
* Magic Circle still works
* Shadow Clone still works
* camera still works
* hand tracking still works

---

# 16. Scope Discipline

Current priority:

1. Finish audio integration.
2. Verify audio.
3. Add recording in a separate future task.
4. Ship V1.

Do NOT expand scope into:

* new ML models
* backend
* accounts
* database
* multiplayer
* new jutsu
* projectile mechanics
* 3D reconstruction
* Pose Landmarker
* major UI rewrite

unless explicitly requested.

---

# 17. AI Agent Working Style

Before editing:

```text
Inspect → Understand → Plan → Edit
```

After editing:

```text
Typecheck → Build → Diff check → Inspect diff → Report
```

For every task:

> Make the smallest correct change that satisfies the requirement.

If an existing implementation already works, preserve it.

If unsure about a property, function, state name, or architecture:

> Inspect the actual source code. Do not invent it.

Never claim a feature is verified if only compilation was tested.

---

# 18. Current Project State

As of September 2026:

### VFX

* Rasengan: working
* Lightning: working
* Magic Circle: working
* Shadow Clone: working

### Audio

* `audioManager.ts`: implemented and verified
* `jutsuAudio.ts`: implemented and verified
* `useJutsuAudio.ts`: next integration task
* `App.tsx` audio wiring: not yet implemented
* Manual audio verification: pending

### Verification already completed for audio engine

```text
npm run typecheck → PASS
npm run build → PASS
git diff --check → PASS
```

The latest audio-engine fixes were limited to `jutsuAudio.ts`.

---

# 19. Non-Negotiable Rules

1. Do not break existing jutsu.
2. Do not modify VFX while implementing audio.
3. Do not modify detectors while implementing audio.
4. Do not create another hand-tracking pipeline.
5. Do not create another AudioContext.
6. Do not trigger audio every frame.
7. Do not duplicate two-hand audio loops.
8. Do not introduce unnecessary dependencies.
9. Always typecheck and build.
10. Inspect the diff before declaring completion.
11. Keep future video recording compatibility in mind.
12. Prefer small verified changes over giant rewrites.