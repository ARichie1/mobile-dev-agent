# MDA CLI implementation audit

Recorded 2026-10-26 04:24 Africa/Lagos (03:24 UTC).

Owned changes: src/index.ts, src/cli/**, src/project/**, src/integration/**, package.json, package-lock.json, tsconfig.json, and new CLI/project/bridge tests. No edits to Agent, CodexProcess, README, CI, or FolderSynka.

Implemented install-once npm bin `mda`; project-local init, doctor, status, run/agent run, sync/plan, continuous start/stop and help. Commands support `--json`; prompt arguments after `--` are literal. Config version 1 is atomic and machine-local. All .mda contents are ignored except the optional ignore file itself. Existing config bytes remain unchanged on repeated init, and conflicting flags fail with instructions. Shared roots are canonical directories, must not overlap, and config copied/moved to another host is rejected. Missing shared storage does not prevent stop.

FolderSynka uses execFile argument arrays. Capabilities require schemaVersion 1, ok, bidirectional mode and inspect/sync/plan. Profile mode/source/destination must match config. Profile creation is reconciled before saving config and retried for existing configurations. Init never syncs. Parent engine excludes .mda. Start/stop delegate to FolderSynka service; stop intentionally uses only the local profile without inspect. Agent runs sync inbound/outbound and preserve provider failures; sync errors use 20, conflicts 21, busy 22. Parent's large-delete guard remains enforced; MDA does not bypass it.

Actual runs use the worker-owned hardened CodexProcess, bounded retained output, streaming callbacks, timeout (default 120000 ms), and AbortSignal from SIGINT/SIGTERM. workspace-write sandbox is explicit. model/instructions are optional; skipGitRepoCheck is false by default. Ubuntu launch checks installed local login --help for --bind/--work-dir, then constructs login ubuntu --bind HOST:GUEST --work-dir GUEST -- EXEC ARGS. No shell interpolation.

Latest verification:
- npm run typecheck: passed.
- npm test: 9 files / 68 tests passed; default source-only suite excludes live E2E and codexclient tests.
- Actual neighboring FolderSynka bridge test passed: init without copying, inbound agent input, outbound agent edit, conflict blocking/preservation, .mda exclusion.
- npm pack --dry-run: passed, 19 entries, no tests or test dependencies shipped as runtime dependencies. Build cleans dist before tsc.
- node dist/index.js help: passed.

Limitations: proot-distro is absent locally; argument/help contracts are stub-tested, not tested on Android/Termux/Ubuntu. No authenticated provider execution or live service/device claim. README, package release version, CI and reports/index integration remain coordinator-owned.
