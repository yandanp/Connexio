# Startup and memory baseline results

## Status

Runtime measurements and GUI smoke are **pending manual verification**. This document intentionally contains no fabricated baseline, after, shell-count, or smoke result.

| Item | Status | Evidence |
| --- | --- | --- |
| Baseline branch | Pending | Local `main` recorded at `1c3c774` |
| Performance branch | Pending manual measurement | `perf/startup-memory-optimization` recorded at `49c0496` |
| Baseline first interactive terminal | Pending | Main has no equivalent `firstTerminalReadyAt` metric |
| Performance first terminal ready | Pending | Read from Settings → About → Performance after each cold start |
| Shell process count | Pending | Requires Windows process observation per trial |
| Manual smoke | Pending | Requires desktop GUI interaction |
| Remote push / PR / CI | Deferred | Branch must remain unmerged until manual review |

## Fixture and trial protocol

1. Use a separate Windows profile, or back up the Connexio app-data files before testing. Git worktrees do **not** isolate app data because both branches use the `com.connexio.app` identifier.
2. Create five throwaway project directories. In Connexio, create five projects and three terminal tabs for each; select the intended active project and tab, then close normally to persist the same fixture for every trial.
3. In an isolated temporary worktree at `main` (`1c3c774`), fully exit the app before each of two cold starts. Record raw stopwatch times from visible startup until a terminal executes a known trivial command, then report their arithmetic median.
4. Repeat on `perf/startup-memory-optimization` (`49c0496`) with the identical fixture. Record the same interactive-command endpoint and Settings → About → Performance `First terminal ready` plus phase, spawn, and first-output values. `First terminal ready` is app-mount → first Xterm mount; do not call it a shell-prompt measurement.
5. After each ready state, record the active terminal-pane count and run:

   ```powershell
   Get-Process | Where-Object {$_.ProcessName -match 'pwsh|powershell'} |
     Measure-Object | Select-Object -ExpandProperty Count
   ```

   Also record the pre-launch count or process PID/parent data, because this command counts unrelated system shells.
6. Capture one GUI smoke session covering: command output followed by tab/project switch and return (scrollback/no xterm reset); close while `Menyiapkan shell…`; split tab readiness; unavailable project path → PaneError → `Coba lagi` recovery.

## Acceptance targets

- Post-change `First terminal ready` target: below 2 s.
- Post-change shell process count: no more than the active tab's terminal-pane count.
- Report raw trial values, median, fixture details, Windows/machine details, process-count attribution, and individual smoke outcomes before comparing against baseline.

## Automated verification — `49c0496`

Executed on the performance branch:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — 15 files, 66 tests passed.
- `npm run check:lines` — passed.
- `npm run check:boundaries` — passed.
- `npm run build` — passed. Existing Vite dynamic/static import and chunk-size warnings remain.
- `cd src-tauri && cargo fmt --check` — passed.
- `cd src-tauri && cargo clippy -j 2 -- -D warnings` — passed.
- `cd src-tauri && cargo test -j 2` — 12 tests passed across 3 suites.

## Deferred integration

Do not merge to `main` before manual review. After recording the runtime evidence above, push `perf/startup-memory-optimization`, open a PR to `main`, and attach the raw results, median calculation, smoke evidence, and CI URL.
