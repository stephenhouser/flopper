# Flopper Refactor TODO

Concise, prioritized tasks to finish the refactor, improve correctness, performance, and DX.

## Status (short)

- Centralized domain types/constants in `models/poker.ts`.
- Engine logic in `lib/gameplay.ts`; stateful engine in `hooks/useGameEngine.ts`.
- Trainer orchestration in `hooks/useHoldemTrainer.ts` with unified settings.
- Persisted state via `hooks/usePersistedState`; session/history in `hooks/useSession`; timers/flash in `hooks/useFlash`.
- Board model adopted; pot tracking and win/loss feedback fixed; auto-deal consistent.
- SettingsSheet unified to a single `settings` API with shared bounds.
- Tests added (gameplay, engine, state machine) and CI in place; typecheck/lint pass.

## Roadmap (prioritized)

### 1) Tests and correctness

- [ ] Expand edge cases for `nextStreet`/`HAND_STATE_MACHINE`:
  - [ ] Skip streets via settings (flop off/turn off/river off) and ensure completion.
  - [ ] Settlement occurs on every transition (pot includes all outstanding bets).
- [ ] Add tests for delayed callbacks using refs (ensure pot/board/street correctness during feedback delays).
- [ ] Add tests verifying auto-deal + feedback windows don’t regress hero win/loss feedback.
- [ ] Coverage target: 100% branches on `nextStreet`/settlement helpers.

Files: `__tests__/stateMachine.test.ts`, `__tests__/useGameEngine.test.tsx`, `lib/gameplay.ts`.

### 2) Storage hardening

- [ ] Add versioned keys and migrations in `lib/storage.ts`.
- [ ] Wrap JSON parse/stringify with try/catch and default fallbacks.
- [ ] Introduce `STORAGE_VERSION` and `MIGRATIONS` map; bump `SETTINGS_STORAGE_KEY`/`SESSION_STORAGE_KEY` with version.
- [ ] Unit-test migrations and error paths.

Files: `lib/storage.ts`, `models/poker.ts`, `__tests__/storage.test.ts` (new).

### 3) Performance and render hygiene

- [ ] React.memo `components/poker/PlayerRow.tsx` and `components/poker/PlayingCard.tsx`.
- [ ] Ensure stable props: memoize `betLabel`, callbacks, and derived values with `useMemo`/`useCallback`.
- [ ] FlatList: set `keyExtractor`, `initialNumToRender`, `windowSize`; consider `getItemLayout` if row height is fixed.
- [ ] Measure re-renders (consider `why-did-you-render` in dev) and verify `PlayerRow` stability.

Files: `components/poker/PlayerRow.tsx`, `components/poker/PlayingCard.tsx`, `app/(tabs)/texas-holdem.tsx`.

### 4) Hooks and effects cleanup

- [ ] Extract `useHotkeys` (web + native) to centralize key bindings and respect `buttonsDisabled`.
- [ ] Add `useTimeouts` to register/clear timeouts by key; auto-clean on unmount.
- [ ] Replace inline timers with `useTimeouts`; type timers as `ReturnType<typeof setTimeout>`.

Files: `hooks/useHotkeys.ts` (new), `hooks/useTimeouts.ts` (new), `hooks/useHoldemTrainer.ts`, `hooks/useGameEngine.ts`.

### 5) Type safety and config

- [ ] Introduce a `GameState` type in `models/poker.ts` (engine-visible shape).
- [ ] Eliminate any remaining `any`; tighten ref/timer types across hooks.
- [ ] Consider stricter TS flags (e.g., `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).

Files: `models/poker.ts`, `hooks/*`, `tsconfig.json`.

### 6) Styles and theming

- [ ] Consolidate shared styles into `components/poker/styles.ts`.
- [ ] Reuse `constants/Colors.ts` across poker UI; centralize spacing/radius.
- [ ] Audit dark mode and contrast; remove duplicated style fragments between screen/components.

Files: `components/poker/styles.ts` (new), `components/poker/*`, `app/(tabs)/texas-holdem.tsx`.

### 7) DX/CI polish

- [ ] Ensure npm scripts: `lint`, `format`, `test`, `typecheck` (run in CI).
- [ ] Configure ESLint + Prettier for TS/React Native; enforce unused imports/vars, hooks rules.
- [ ] Optional: pre-commit with Husky + lint-staged to run lint/format.
- [ ] Expand GitHub Actions workflow to run all scripts on PRs.

Files: `package.json`, `.github/workflows/ci.yml`, `.eslintrc`/`eslint.config.js`, `.prettierrc`.

### 8) Documentation

- [ ] Expand state machine docs in `NOTES.md` with diagrams and skipped-street sequences.
- [ ] Document storage versioning/migration strategy.
- [ ] Update README with architecture overview (models/lib/hooks/components) and development scripts.

Files: `NOTES.md`, `README.md`.

### 9) Cleanup

- [ ] Run lint for unused imports/vars and remove dead code.
- [ ] Replace remaining magic numbers with shared constants (e.g., `MAX_PLAYERS`, `MIN_BIG_BLIND`, feedback min/max).
- [ ] Manual sweep to remove any remaining unused files.

Files: repo-wide.

### 10) Optional feature hygiene

- [ ] Extract PokerStars export to `lib/exporters/pokerstars.ts` from screen.
- [ ] Consider Storybook (or lightweight alternative) for `PlayerRow`/`CommunityCards` visual test harness.

Files: `lib/exporters/pokerstars.ts` (new), `app/(tabs)/texas-holdem.tsx`.

## Acceptance criteria

- [ ] 100% branch coverage for `nextStreet` and settlement helpers.
- [ ] Stable renders for `PlayerRow` across actions (verified via memo and dev tooling).
- [ ] No unhandled storage errors; smooth migration when bumping storage version.
- [ ] CI runs typecheck/lint/test on every PR and stays green.

## Nice to have

- [ ] Optimize expensive calculations with selectors/memos if needed.
- [ ] Add lightweight performance marks around street transitions and feedback windows.
- [ ] Consider Zustand/Jotai later if global game state becomes necessary (current hooks are sufficient now).
