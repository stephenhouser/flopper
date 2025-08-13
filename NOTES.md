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

# Refactor suggestions

Here’s a pragmatic refactor plan to simplify, modularize, and reduce redundancy. It’s incremental, safe, and maps cleanly onto your current structure.

High‑impact extractions

Domain types and helpers (lib)

Create lib/cards.ts: Suit, Rank, CardT, RANKS, SUITS, makeDeck, shuffle, cardToStr, cardToPokerStarsStr.
Create lib/chen.ts: chenScore, recommendAction.
Create lib/hand-eval.ts: evaluateHand, didHeroWin.
Create lib/positions.ts: labelForPos, positionBadgeStyle (turn into a small map).
Create lib/storage.ts: async storage wrapper with helpers getBool, setBool, getNumber, setJSON, getJSON.
Create models/poker.ts: shared types Player, Action, Street, HandAction, HandHistory, Session.
UI components (components/poker and components/ui)

components/ui/RowButton.tsx (your RowButton).
components/ui/Pill.tsx (your Pill).
components/poker/PlayingCard.tsx (your PlayingCard).
components/poker/PlayerRow.tsx
Props: { player, isCompact, heroScore, showScore, showAllCards, revealed, onToggleReveal, flashState, flashOpacity, betLabel }.
Wrap with React.memo to cut rerenders.
components/poker/CommunityCards.tsx
Props: { street, flop, turn, river, totalPot, isCompact, heroWon, folded }.
components/poker/ActionsBar.tsx
Props: { canCheck, street, onCheck, onCall, onRaise, onFold, onNew }.
components/poker/SettingsSheet.tsx
All settings UI and tooltips; emits events (e.g., onChangeNumPlayers, onToggleShowFlop, etc.).
components/ui/Tooltip.tsx (a generic floating tooltip used by SettingsSheet).
Hooks (hooks)

hooks/usePersistedState.ts: generic persisted state with AsyncStorage or localStorage fallback.
hooks/useFlash.ts: manages flash state + Animated.Value, exposes trigger(correct) and cleans up timers.
hooks/useTimeouts.ts: small utility to register/clear timeouts by key.
hooks/useHotkeys.ts: registers web and native hotkeys; accepts a map of actions.
hooks/useSession.ts: currentSession, currentHandHistory, startNewSession, addActionToHistory, save/load/clear, exportPokerStars.
hooks/useGameEngine.ts: encapsulates deck, players, pot, street, reveal set, and the “engine” actions: newHand, act, advanceStreet, collectBets, dealFlop/Turn/River, betLabel.
Logic simplifications and deduping

Replace many tooltip booleans with one state

Use const [activeTooltip, setActiveTooltip] = useState<TooltipId | null>(null) where TooltipId = 'feedback' | 'autoNew' | 'facingRaise' | 'score' | 'flop' | 'turn' | 'river' | 'community';.
This removes all toggleXTooltip functions and the closeAllTooltips helper.
Centralize repetitive bet/pot logic

Extract collectAllBetsIntoPot(players, pot) and resetAllBets(players) helpers.
Extract nextStreet(street, settings) to compute the next allowed street given toggles.
Extract minRaise(currentBet, bigBlind).
State machine for hand progression

Move street transitions and dealing flow into useGameEngine so the screen becomes declarative and thin.
Avoid globalThis.__BTN_SEAT__; keep button index in a ref or piece of engine state that persists across hands.
Persisted settings

Replace 8 separate useEffects with usePersistedState:
showFeedback, autoNew, facingRaise, feedbackSecs, showScore, showFlop, showTurn, showRiver, showCommunityCards.
This drops the manual Storage.setItem effects entirely.
Flash animation encapsulation

Move hero flash animation state and timers into useFlash.
From act, just call flash.trigger(correct).
Hotkeys encapsulation

Put both web and native key listeners into useHotkeys, parametrize with actions and dependencies (heroAction, newHand).
Memoization and callbacks

Wrap renderers and callbacks with useCallback.
PlayerRow and PlayingCard should be React.memo to cut list rerenders.
Derived values only

Don’t store values you can derive: e.g., totalPot from pot + sum(bets).
Keep canCheck derived in render or via memo.
Styles

Co-locate small StyleSheets with each component to shrink the screen file.
Reuse constants/Colors instead of hexes where possible.
Suggested target structure

lib/
cards.ts
chen.ts
hand-eval.ts
positions.ts
storage.ts
models/
poker.ts
hooks/
usePersistedState.ts
useFlash.ts
useHotkeys.ts
useSession.ts
useGameEngine.ts
components/ui/
RowButton.tsx
Pill.tsx
Tooltip.tsx
components/poker/
PlayingCard.tsx
PlayerRow.tsx
CommunityCards.tsx
ActionsBar.tsx
SettingsSheet.tsx
app/(tabs)/
texas-holdem.tsx (thin orchestrating container)
Quick wins you can do first

Consolidate tooltip state into one activeTooltip.
Extract PlayerRow, CommunityCards, ActionsBar.
Move card/hand utils into lib files.
Extract session handling into useSession.
Replace per-setting effects with usePersistedState.
Extract useFlash and remove animation/timer plumbing from the screen.
Remove globalThis.__BTN_SEAT__ and store button index in a ref/state.
Notes

There’s an unused keys array in resetAll; remove it.
Consider unit tests for lib functions (chen, evaluateHand, recommendAction, positions).
Consider introducing Zustand or Jotai later if you want global game state, but the hook approach above keeps dependencies minimal.
If you want, I can start by extracting the three UI components (PlayerRow, CommunityCards, SettingsSheet) and the core lib files, then wire them back here.

## next steps

Suggested next refactor steps

Extract game state into a hook

Create hooks/useHoldemTrainer.ts to own: players, deck, streets, pot, act(), newHand(), dealTable(), betLabel(), derived values.
Texas screen becomes a thin view consuming the hook.
Isolate gameplay logic

Move pure logic to lib/gameplay.ts: rotatePositions, dealTable, applyAction, advanceStreet, settleBets.
Keep hand-eval.ts focused on evaluation only.
Session and export modules

Move persistence to lib/session.ts (load/save/clear/current session).
Move PokerStars export to lib/exporters/pokerstars.ts.
Hotkeys into a hook

Create hooks/useHotkeys.ts (web and native variants) and remove listeners from the screen.
Settings API cleanup

Define a Settings type and pass a single settings object + setter into SettingsSheet.
Inside SettingsSheet, extract tooltip toggling into a small useTooltips hook.
Consolidate styles

Move shared row/tooltip styles to components/poker/styles.ts.
Remove duplicated styles between screen and PlayerRow/CommunityCards/SettingsSheet.
Type tightening

Ensure unions (Street, Action) come from models/poker everywhere.
Eliminate remaining implicit anys; prefer typed updater functions.
Tests for core libs

Add a minimal test setup (Jest or Vitest) and cover lib/cards, lib/chen, lib/hand-eval, lib/positions, lib/gameplay.
Pick one to start (recommended: useHoldemTrainer hook), and I’ll implement it.

## next

Refactor complete.

What I changed

Updated the screen texas-holdem.tsx to use useHoldemTrainer for all state, logic, and actions.
Removed duplicated local state/effects, wiring UI directly to the hook (players, streets, pot, feedback, session, animations).
Kept session export and reset-all logic in the screen (hook exposes session setters).
SettingsSheet now receives all values/setters from the hook, including dealTable and session controls.
Preserved hotkeys (web/native) and hero flash overlay via hook-provided heroFlash and heroFlashOpacity.
Kept PlayerRow, CommunityCards, and RowButton usage as-is; betLabel now comes from the hook.
Notes

Typecheck shows no errors in updated files.
Session export remains in the screen; consider extracting to lib/export.ts later.
Optional: extract hotkeys into hooks/useHotkeys, and move gameplay/session helpers into lib/gameplay.ts.
Next suggestions

Consolidate styles shared across poker components.
Add unit tests for lib/cards, lib/chen, lib/hand-eval, and hooks/useHoldemTrainer.

** This completely broke the game, no players, cards, or any hands show on the screen"

# update fix

Fix applied:

Added an auto-deal on mount in the hook so a hand is dealt as soon as settings are loaded and a session exists.
Placed the effect after dealTable/newHand definitions to avoid temporal-dead-zone issues.
File changed:

useHoldemTrainer.ts
New effect: when ready, a session exists, and there are no players/deck/community cards yet, call dealTable(numPlayers).
No TypeScript errors after the change.
Why this fixes it:

After the refactor, nothing triggered the initial deal. The FlatList had no players until the first action. The new effect restores the previous behavior by dealing automatically once initialization completes.
Validate:

Launch the app; the table should show a dealt hand immediately.
Toggle settings and start a new session; a fresh hand should auto-deal.
Actions and hotkeys should work as before.

## what are your recomended next steps

Here’s a short, prioritized plan.

Isolate gameplay engine
Create lib/gameplay.ts with pure functions: rotatePositions, dealPlayers, collectBetsIntoPot, resetBets, nextStreet, minRaise, settleResult.
Make hooks/useGameEngine.ts wrap those and expose: state, newHand, act, advanceStreet. Remove globalThis.BTN_SEAT and keep buttonIndex in a ref that advances per hand.
Split the big hook
hooks/useSession.ts: load/save session, currentHandHistory, addActionToHistory, startNewSession, exportPokerStars.
hooks/useFlash.ts: manages flash state + opacity + timers.
hooks/useHotkeys.ts: register web/native keys, accepts callbacks map.
Keep hooks/useHoldemTrainer as a thin orchestrator composing the above.
Settings consolidation
Define a Settings type and use usePersistedState for each setting (or one Settings object).
Pass a single settings object + onChange(settings) to SettingsSheet, instead of many props.
Tooltip cleanup
Replace many booleans with one activeTooltip: 'feedback' | 'autoNew' | 'facingRaise' | 'score' | 'flop' | 'turn' | 'river' | 'community'.
Optional: components/ui/Tooltip for reuse.
Component memoization and props
React.memo PlayerRow and PlayingCard.
Ensure stable props: memoize betLabel and other callbacks, avoid passing new inline functions to each row.
Types hardening
Centralize unions in poker.ts (Street, Action, Result).
Add Settings type and a GameState type.
Remove remaining anys; type timers and refs.
Tests
Add Jest + @testing-library/react-native for components; Vitest/Jest for pure libs.
Cover lib/cards, lib/chen, lib/hand-eval, lib/positions, lib/gameplay.
Add basic tests for useGameEngine and useSession (react-hooks testing library).
Storage robustness
Wrap Storage JSON parse/stringify with try/catch and versioned keys.
Add simple migration guard for future changes.
Styling and theming
Consolidate shared styles (poker/styles.ts), reuse Colors.ts, ensure dark mode compatibility.
Remove duplicate style fragments in screen vs components.
DX and CI
Add npm scripts: lint, format, test, typecheck.
Configure ESLint + Prettier for TS/React Native.
Optional: GitHub Actions for typecheck/lint/test on PRs.
Performance polish
FlatList: provide keyExtractor, initialNumToRender, windowSize; consider getItemLayout for fixed-height rows.
Avoid recalculating totalPot/betLabel per render where unnecessary.
Readability
Replace magic numbers with constants (MAX_PLAYERS, FEEDBACK_MIN/MAX).
Document the hand progression state machine with comments/tests.

## Refactor Plan Progress

Recent updates:

- Added Jest with ts-jest config and initial unit tests for `lib/gameplay.ts` core helpers.
- Configured npm scripts: `npm test`, `npm run test:watch`.
- Kept editor typechecking clean by excluding `__tests__` from tsconfig (ts-jest compiles tests separately).

Next steps:

- Add tests for `hooks/useGameEngine` (advanceStreet, settle on completion, rotation of button).
- Use `STREET_ORDER`/`HAND_STATE_MACHINE` in docs/tests for nextStreet behavior.
- Adopt `Board` in engine return shape in a future refactor.
- Memoize components/callbacks where useful and harden types.