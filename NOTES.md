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
