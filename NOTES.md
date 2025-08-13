# Development Notes

## Deploy to github pages

<https://docs.expo.dev/guides/publishing-websites/#github-pages>

## Progressive web app

Expo Progressive web app -- to make "installable" on iOS and Android as an app on their home screen. Also works on desktop (I think)

<https://docs.expo.dev/guides/progressive-web-apps/>

## Icons

To enable proper icons (for settings gear and other places) in Expo apps:

```
expo install @expo/vector-icons
```

## Keyboard Hot-Keys

Because Expo Go can’t load arbitrary native modules, you’ll need a dev build:
Install the library:

```
npm i react-native-key-command
expo install @react-native-async-storage/async-storage
```

Prebuild & apply native changes, then build a dev client:

```
npm i react-native-key-command
npx expo prebuild
(cd ios && pod install)
# iOS: runs `pod install` automatically; ensure the AppDelegate additions from the README are applied
# Android: ensure the MainActivity.onKeyDown override is applied
eas build --profile development --platform all
```

The code I added dynamically requires the module and no-ops if it isn’t present, so your app keeps running in Expo Go until you switch to the dev build.

## Gameplay engine: Streets and State Machine

The hand progression is modeled with a simple state machine defined in `models/poker.ts` and driven by pure helpers in `lib/gameplay.ts`.

- Streets are ordered by `STREET_ORDER`:

```ts
export type Street = "preflop" | "flop" | "turn" | "river" | "complete";

export const STREET_ORDER = [
  "preflop",
  "flop",
  "turn",
  "river",
  "complete",
] as const;
```

- A mapping `HAND_STATE_MACHINE` models the next street in the nominal flow:

```ts
export const HAND_STATE_MACHINE: Readonly<Record<Street, Street>> = {
  preflop: "flop",
  flop: "turn",
  turn: "river",
  river: "complete",
  complete: "complete",
};
```

- The helper `nextStreet(current, settings)` in `lib/gameplay.ts` applies user settings (`showFlop`, `showTurn`, `showRiver`) to potentially skip streets and jump directly to `complete`.

- The hook `hooks/useGameEngine.ts` calls `nextStreet` inside `advanceStreet(settings)`. It also performs side effects for each transition:

  - `preflop -> flop`: deals flop and settles outstanding bets
  - `flop -> turn`: deals turn and settles outstanding bets
  - `turn -> river`: deals river and settles outstanding bets
  - `* -> complete`: settles any remaining bets and sets `street = "complete"`

### Testing notes

- See `__tests__/stateMachine.test.ts` for coverage of `nextStreet` and completion behavior.

- Further tests to add: edge cases for skipping streets (e.g., flop off, turn off), and ensuring pot settlement occurs on every transition.

## Board model

Community cards are represented by a `Board` object stored in engine state and consumed by the UI:

```ts
export type Board = {
  flop: [CardT, CardT, CardT] | null;
  turn: CardT | null;
  river: CardT | null;
};
```

### Why

- Replaces separate `flop/turn/river` fields with a single, typed structure.

- Simplifies prop passing to UI components and history recording.

### Where used

- Engine: `hooks/useGameEngine.ts` updates `board` via `dealFlop/Turn/River` and uses `refs` to avoid stale closures during delayed callbacks.

- UI: `components/poker/CommunityCards.tsx` renders from `board` and shows street/feedback.

- History: `hooks/useHoldemTrainer.ts` derives a `communityCards` payload from `board` when recording hands.

### Pot and settlement

- Engine exposes `getTotalPot()` to compute `pot + sum(bets)` using refs for correctness during delayed effects.

- `settleBetsIntoPot(pot, players)` in `lib/gameplay.ts` moves all outstanding bets into the pot and resets player bets; called on every street advance and on completion.

### Migration notes

- Older code referenced standalone `flop/turn/river` fields; those have been removed in favor of `Board` everywhere.

- UI and tests have been updated to consume `Board` consistently.
