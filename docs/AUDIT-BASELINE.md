# Audit baseline

This is the pre-implementation audit from 26 October 2026. See the latest reports/progress for implemented changes; absence findings below describe the starting point.

# FolderSynka + Mobile Dev Agent: audit and release roadmap

Date: 26 October 2026. Scope: current public default-branch sources, local verification, architecture and implementation planning. No product implementation or remote repository changes were made.

## Decision

Keep two independent products with a versioned integration contract. FolderSynka owns safe synchronization, conflict handling and synchronization services. MDA owns workspace registration, Ubuntu/proot launch configuration, agent process lifecycle and the developer workflow. Stabilize FolderSynka first; build MDA's CLI and process controls in parallel; connect them only after a machine-readable sync contract exists.

The present repositories do not yet deliver the full described mobile workflow. FolderSynka is a functioning one-way foundation with important safety gaps. MDA is a small TypeScript prototype with tested classes, rather than an installable working development environment manager. Version strings of 1.0.0 should not be treated as readiness evidence.

## Sources and limits

- FolderSynka: https://github.com/ARichie1/foldersynka — inspected commit `4e377e0055c8146ef651fe8d0c953b3cb07d76cc`.
- Mobile Dev Agent: https://github.com/ARichie1/mobile-dev-agent — inspected commit `5f2dd17450765dd21f94922b180087322caa7a76`.
- The supplied ChatGPT project URL could not be retrieved. Its conversations were not inspected; this report uses repository code and the workflow described in the request. Decisions that exist only in that conversation remain unverified.
- Verification ran on Linux, with real rsync/inotifywait but a simulated service wrapper in the FolderSynka suite. No Android device, actual runit supervisor, Acode server, Ubuntu proot or authenticated agent run was tested. These are mandatory later release gates.
- Local npm installation used `npm ci --ignore-scripts`. No dependency vulnerability audit was performed.

## Current capability map

| Capability | FolderSynka | MDA |
|---|---|---|
| Workspace profiles | Persistent Bash configurations | In-memory WorkspaceManager |
| One-way copy/watch | Implemented using rsync and inotifywait | No adapter |
| Bidirectional reconciliation | Absent | Absent |
| Conflict/deletion history | No per-file baseline or conflict resolver | Absent |
| Service lifecycle | Generated Termux/runit service | No runtime orchestration |
| Diagnostics | Human-oriented doctor/status commands | No CLI diagnostics |
| Agent execution | Outside responsibility | Codex subprocess wrapper |
| Ubuntu/proot bridge | Outside responsibility | Not implemented |
| User-facing executable | Bash CLI and installer | Empty entry point; no package bin |
| Documentation | Extensive README | Empty README |
| Release confidence | One-way integration suite passes | Selected local tests/build pass |

## Verification performed

| Check | Observed result | What it establishes |
|---|---|---|
| FolderSynka `bash tests/test.sh` | 31 passed, 0 failed | Existing CLI and one-way lifecycle under its service stub |
| MDA `npm run typecheck` | Passed | Current source typechecks |
| MDA `npm run build` | Passed | Current TypeScript compiles |
| MDA selected Vitest files | 34 tests passed in 3 files | Agent delegation, command runner, workspace logic |
| Identical sync roots | Profile creation succeeded | Missing relationship validation |
| Destination nested inside source | Profile creation succeeded | Missing overlap rejection |
| Literal folder name containing shell substitution | Reload changed the path and executed a harmless printf expression | Unsafe configuration serialization/loading |
| CodexProcess timeout of 20 ms with delayed fake process | Completed successfully after about 351 ms | Configured timeout is not enforced |

The selected MDA files were agent.test.ts, commandrunner.test.ts and workspace.test.ts. codexclient.test.ts requires an installed Codex executable. Both agent.e2e.test.ts and e2e.test.ts invoke real Codex. Those three files were not run; this is not a full-suite pass. Separate offline tests from explicitly opted-in live integration tests before CI runs the default test command.

## FolderSynka findings

### F1 — Critical: executable profile data

`core/config/profile.sh`, fs_profile_create writes paths directly into double-quoted shell assignments; fs_profile_load sources the resulting file. A real directory named with literal `$(printf harmless)` was accepted; loading evaluated it and changed the path. This is a confirmed correctness and command-execution flaw, not merely a theoretical hostile config file. fs_profile_set also interpolates values into sed replacements. `core/config/state.sh` likewise sources runtime state.

Use a non-executable schema and strict parser, or carefully serialized shell literals as an interim migration. Do not repair only creation and leave update/state writers unsafe. Validate types, schema version, booleans and required fields. Use restrictive runtime permissions and atomic writes. Test quotes, dollar signs, backticks, backslashes, pipes, ampersands, spaces and Unicode without evaluating any content.

### F2 — High: unsafe relationships and destructive defaults

`core/validation/create.sh` checks source and destination independently. It does not reject same-root or ancestor/descendant pairs. Both were accepted in isolated probes. `core/config/defaults.sh` enables deletion by default; `core/engine/rsync.sh` adds --delete. There is no pairwise safety check in the inspected sync path.

Canonicalize both endpoints, reject equality and nesting in either direction, reject hazardous roots and aliases, and detect incompatible overlapping profiles. Revalidate before every destructive apply. Change the new-profile default to non-deleting copy; make mirror deletion explicit. Migrate existing profiles without silently changing their documented behavior. Add deletion thresholds, preview and recoverable retention.

### F3 — Blocking feature: no bidirectional engine

`core/engine/sync-engine.sh` always copies FS_PROFILE_SOURCE to FS_PROFILE_DESTINATION. `watcher.sh` watches only the source. There is no persisted per-file baseline, tombstone, conflict journal or two-sided planner. Creating a second reversed profile is not a safe substitute: either copy can overwrite the other's edits, while deletion can remove newly created work.

### F4 — High: recovery needs stronger ownership and durability

`core/config/state.sh`, fs_state_lock_acquire uses noclobber creation, so acquisition is not simply an unchecked write. However, existing lock files are rejected without stale-owner recovery, and release removes a lock without ownership verification. Startup synchronization occurs before the watcher is established, leaving an observation gap. Watcher cleanup terminates the recorded loop PID; descendant inotify process cleanup needs explicit verification under real services.

Use ownership-aware locking, atomic state writes, startup recovery and signal cleanup. Preserve failed sync state rather than treating service launch as successful convergence. Test kill/restart during copy and state commit. Distinguish supervisor running, watcher alive, initial reconciliation complete, conflicts and last successful convergence.

### F5 — Medium: watcher and storage behavior

`watcher.sh` sleeps once for every event rather than coalescing a burst. It triggers full-tree synchronization for events, including activity in many excluded directories; the watcher filters a few filename patterns rather than the full sync ignore rules. Its pipe-delimited line protocol cannot represent all valid filenames unambiguously. No periodic reconciliation or polling fallback is implemented in the inspected engine.

Treat events as hints to schedule reconciliation. Coalesce dirty paths, rescan after overflow/restart and periodically reconcile. Verify shared-storage events with actual Acode save behavior. Declare a supported filename policy or use robust framing. Introduce a shared-storage transfer policy rather than assuming rsync -a metadata/symlink behavior works in both directions. Keep .git, dependencies, secrets and build outputs in private storage by default.

### F6 — Integration gap

There are useful internal dry-run and one-shot functions in rsync.sh and sync-engine.sh, but no corresponding public sync/plan API in the current router. Human status output is unsuitable as a stable MDA dependency. Add versioned JSON diagnostics, capabilities, profile inspection, one-shot synchronization, convergence waiting and conflict operations. MDA should never source or edit FolderSynka's internals.

## MDA findings

### M1 — Blocking: no user journey

`src/index.ts` and README.md are empty. package.json has no bin entry and main points at index.js rather than the compiled location. npm start executes an empty built entry point. Add a real executable, argument validation, actionable errors, help, a packaged build and clean-install tests. Populate or remove empty configuration/logging placeholders and review stray root artifacts `tsc` and `mobile-dev-agent@1.0.0`.

### M2 — Blocking: environment and sync integration absent

WorkspaceManager registers paths in a Map; registrations disappear on restart. It has no Termux-host versus Ubuntu-guest path mapping. There is no proot-distro launcher, FolderSynka adapter or Acode workflow. Implement persistent project records, canonical path validation, a pinned capability-compatible FolderSynka client, explicit bind mapping and a diagnosed runtime launch.

### M3 — High: process lifecycle incomplete

`src/codex/CodexProcess.ts` declares timeout in configuration but never applies it. It buffers all stdout/stderr, has no cancellation or streaming, and exposes nullable exitCode without signal detail. Add bounded output/streaming, timeouts, cancellation and controlled descendant shutdown. Use a fake executable for deterministic tests. `CommandRunner.ts` supports timeout, but its environment option replaces rather than merges the inherited environment; clarify and test that contract.

### M4 — High: agent configuration not applied

`Agent.ts` forwards a prompt and workspace using codex exec, but ignores AgentConfig.model and instructions. It always adds --skip-git-repo-check. Define explicit provider configuration, working directory and permission policy. Respect model/instructions, propagate nonzero exits and signals, and make non-Git execution a deliberate capability. An agent process is not a sandbox merely because it runs in proot.

### M5 — Medium: tests and packaging overstate usable coverage

Tests currently prove useful building blocks but not edits crossing Android storage, Termux and Ubuntu. Real Codex calls are mixed into the default suite, and one test expects stderr to be entirely empty. Separate unit, adapter, runtime and live-provider suites; do not treat harmless provider diagnostics as failure when the provider succeeded. Exclude tests and test dependencies from the runtime package, define supported Node versions, and add CI/release checks.

## Target architecture

Use two file trees, with the Ubuntu view bound to the Termux tree:

1. Android editor mirror: user-selected shared-storage project directory, accessible to Acode.
2. Termux project: private canonical development tree containing Git, dependencies and private configuration.
3. Ubuntu agent view: explicit proot bind of that same Termux project at a stable guest path, such as /workspace/my-project.

Only trees 1 and 2 are synchronized. Item 3 is another view of tree 2, not a third copy. Validate this bind with a disposable write/read probe on the target device before relying on it. Keep native Termux and Ubuntu dependency directories distinct when they require incompatible binaries; give the guest runtime its own excluded dependency/build space or a documented runtime choice.

FolderSynka runs in Termux, which owns the storage access and service lifecycle. Prefer an MDA host CLI in Termux that invokes the agent executable through proot-distro with argument arrays. Agent execution occurs in Ubuntu; sync management remains on the host. Do not require a network bridge for the MVP. If a guest-side management client becomes necessary later, design a narrowly scoped authenticated local bridge separately.

MDA is the workflow controller; Codex is the first supported agent adapter. Other providers can follow after one complete workflow passes. Acode server remains an independently configured editor component unless its supported integration can be explicitly diagnosed and tested.

## Synchronization semantics

Expose three explicit modes: copy (A to B, no propagated deletion), mirror (A to B with explicit deletion), and bidirectional. Users choose which endpoint is A, so one-way can run in either physical direction. Preserve backward compatibility through schema migration and clear previews.

For bidirectional mode, retain a last-successful baseline for both endpoints. Metadata can accelerate scans, but use content identity where needed so same-size/coarse-timestamp edits are not missed. Plan against a common baseline and revalidate before applying writes.

| Change since baseline | Action |
|---|---|
| Only A edited/created | Transfer A to B |
| Only B edited/created | Transfer B to A |
| Both now contain identical bytes | Converge baseline without a conflict |
| Both edited differently | Preserve both; mark conflict; no silent winner |
| One deletes, other unchanged | Propagate only under configured deletion policy with retention |
| One deletes, other edits | Conflict; preserve edited content and deletion intent |
| New profile with unequal existing files | Initial conflict; no inferred authoritative side |
| Endpoint inaccessible or baseline corrupt | Pause safely; never infer bulk deletion |

Rename detection is optional for MVP; a documented delete/create model is acceptable. File/directory collisions and unsupported symlinks must be explicit conflicts/errors. Keep conflict snapshots and journal outside synchronized trees. A successful copy must not commit a false baseline if either side changed mid-operation. Use temporary files and atomic replacement where supported, plus a write-ahead/recovery journal. Initial scans, ignore-rule changes and resync must never silently erase divergent files.

Use per-file conflict isolation: unrelated files may converge while conflicting paths remain paused. MDA should refuse to start a new agent editing session with unresolved conflicts unless a deliberate override policy exists. During an agent run, external edits can still occur; reconciliation must preserve them. The MVP promises detection and preservation, not simultaneous intelligent merging. Offer an optional pause/apply/reconcile workflow for large agent changes later.

## Proposed integration contract (not existing commands)

- `foldersynka capabilities --json`: program/schema versions, supported modes and features.
- `foldersynka create NAME --src A --dest B --mode MODE --json`: idempotency should be explicit; identical existing config may be accepted, incompatible config must fail.
- `foldersynka inspect NAME --json`, `status NAME --json`, `doctor --json`.
- `foldersynka plan NAME --json` and `sync NAME --once --json`.
- `foldersynka wait NAME --timeout SECONDS --json`: report convergence, conflict or failure with a revision token; never claim future writes are impossible.
- `foldersynka conflicts NAME --json` and explicit resolution selecting A, B or a merged file.
- Lifecycle start/stop remains available; separate ownership allows MDA to stop only sessions/services it owns.

All JSON responses need schemaVersion, operation result, profile identity, structured error code and relevant convergence revision. stdout carries machine output; logs go to stderr. Document stable exit codes for invalid configuration, dependency absence, busy state, conflict and sync failure. MDA must capability-check rather than guessing behavior from a version string. Agent success and final sync success are separate results.

Proposed MDA surface: doctor, project add/list/show/remove, project start/stop/status, agent run and logs. `mda agent run PROJECT PROMPT` validates the project, checks inbound convergence, invokes the Ubuntu agent in the mapped project, then reconciles and reports both execution and sync results. Do not promise an automatic exit-time flush if Android kills Termux; recover and reconcile on next start.

## Delivery gates

| Gate | Work and main files | Required proof |
|---|---|---|
| G0: reproducible baseline | Both repos: source map, supported environments, docs, CI; MDA test split | Fresh clone checks pass without credentials; real device inventory recorded |
| G1: safe one-way FolderSynka | config/profile.sh, state.sh, validation/create.sh, utils/filesystem.sh, engine/rsync.sh | Literal paths survive round-trip; same/nested/aliased roots rejected; explicit copy/mirror behavior and recoverable deletion |
| G2: resilient FolderSynka runtime | engine/watcher.sh, sync-engine.sh, services/service-generator.sh | Stop/restart/kill recovery, no orphan watchers, rescan after event gap, atomic state, real runit validation |
| G3: bidirectional FolderSynka | New planner, manifest, journal and conflicts modules; profile schema migration | Full change matrix, conflicting edits preserved, crash recovery, unavailable storage never becomes deletion |
| G4: stable integration API | cli/router.sh and command modules; MDA new FolderSynkaClient | Schema/exit-code contract tests, capabilities, plan/once/wait/conflicts, error propagation |
| G5: usable MDA | index.ts, package.json, workspace persistence, new runtime launcher, CodexProcess.ts and Agent.ts | Installable CLI, persistent project, real bind mapping, model/instructions, timeout/cancel/streaming and auth diagnostics |
| G6: device beta | Both repos plus Android acceptance scripts and guides | Full human/agent workflow, restart and conflict drills on physical device, clean install/upgrade/uninstall |

Dependency order: G0 → G1 → G2 → G3 → G4 → G6, with MDA's G5 CLI, persistence and fake-runtime tests developed alongside G1–G3. G5's real sync integration depends on G4. Do not integrate against unstable internals simply to start MDA sooner.

Prefer small pull requests: config safety; root safety; copy/mirror and dry-run; locking/recovery; watcher reconciliation; baseline/planner; conflicts/deletions; machine contract; MDA CLI/persistence; proot adapter; agent lifecycle; device release evidence. Each should include focused behavior tests and a dated report of what actually ran.

## Acceptance tests before calling the ecosystem usable

1. Fresh Termux installation: dependencies, storage permission, FolderSynka installation, Ubuntu provisioning instructions, MDA installation, agent authentication and diagnostics are understandable and repeatable.
2. Register a real project in shared storage and Termux. Preview initial reconciliation. Divergent existing content is preserved and reported.
3. Acode edit/create/rename/delete flows reach Termux under the selected mode. Ubuntu sees the same source bytes through the bind.
4. A real authenticated agent edits a disposable project in Ubuntu; Termux and Acode receive the resulting source changes. Build/test executes in the declared runtime.
5. Both sides edit the same file, including same-length edits. Both versions survive; resolution clears the conflict and establishes a correct new baseline.
6. Delete-vs-edit, directory/file collision, unavailable storage, disk full and permission loss produce explicit safe failures.
7. Force termination during transfer and state commit, restart Termux, restart Ubuntu, and repeat. No silent data loss, false clean state or stale-lock dead end.
8. Screen-off and battery restrictions are tested on the actual device; document observed behavior, recovery and any required user settings without promising Android cannot kill the app.
9. .git, node_modules, secrets and designated build outputs remain private; test excludes in both directions and ensure ignored events do not create a sustained sync loop.
10. Paths with spaces, Unicode and shell metacharacters work safely; unsupported filename forms receive actionable validation.
11. Representative small and dependency-heavy repositories are measured for initial sync time, steady-state idle activity, save-to-convergence latency and repeated event bursts. Publish measured limits rather than guessed performance promises.
12. Second project, duplicate start, competing sync profile, cancel, upgrade and uninstall preserve user source trees and leave no unintended service/process running.

## Release strategy and first work

Ship a safe one-way standalone FolderSynka beta first. Follow with a bidirectional beta only after G3 passes; then ship the integrated MDA beta after G6. Keep existing tags intact; choose subsequent versions based on compatibility, with prerelease labels while device validation is outstanding. Include migration and recovery instructions.

The first implementation batch should be FolderSynka config serialization, pairwise root validation and deterministic regression tests, alongside splitting MDA's offline/live tests and implementing its real CLI skeleton. These address confirmed blockers and establish a stable base for the larger sync engine work.

Avoid expanding into dashboards, multiple agents, remote bridges or automatic conflict merging before one Android editor → Termux → Ubuntu agent → Android editor round trip is reliable. The product's value is a dependable phone-based development workflow; correctness and recoverability determine whether it is usable.
