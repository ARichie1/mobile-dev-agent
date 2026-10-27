# Parallel agentic build checkpoint

Recorded: 2026-10-26T04:37:22+01:00 (Africa/Lagos).
Release candidate: **1.1.0-beta.1**. Starting commits: FolderSynka `4e377e0055c8146ef651fe8d0c953b3cb07d76cc`; MDA `5f2dd17450765dd21f94922b180087322caa7a76`.

## Outcome

Both repositories now have root agent instructions, seven reusable role guides, architecture/plan/testing/device-acceptance docs, CI and indexed dated reports/progress. Historical ledgers were imported without treating old claims as fresh test evidence. Six delegated agents contributed across safety, reconciliation, CLI, processes, integration QA and independent review; the coordinator integrated and verified shared behavior.

FolderSynka has copy/mirror/bidirectional file-content reconciliation, strict configuration parsing, canonical root checks, content-hash baselines, retained conflicting/replaced bytes, deletion guards, JSON commands and continuous foreground polling. MDA has the install-once executable, per-folder `mda init`, local persistent config, public sync adapter, host/Ubuntu launch, inbound/outbound sync, streaming, timeout and cancellation.

## Validation

- `npm run typecheck`: passed.
- Default offline source suite: **71 tests passed in 9 files**.
- Final production build and npm package creation: passed; 19 package entries, no test files or runtime dependencies.
- Final isolated global package installation: executable help, init, repeated init, status and JSON status passed.

- Real neighboring repository integration verified inbound source files before a fake agent run, outbound agent edits, unresolved conflict blocking and .mda exclusion.
- POSIX process tests cover both inherited-pipe descendants and TERM-resistant descendants without inherited output. Cancellation is recorded independently of a child exiting zero.
- No authenticated provider, physical Android device, real proot bind or real Termux/runit supervisor was exercised.

## Integration corrections

The coordinator replaced source-only service event watching with foreground periodic reconciliation for both roots; stop is idempotent and MDA can stop even when shared storage is missing. Initial divergent trees can be inspected/initialized while sync still reports conflicts. Bulk deletion of more than ten regular files requires explicit authorization for that pass. Package tests now select source files and cannot accidentally discover stale compiled live-provider tests.

Independent review reproduced two cancellation errors: descendants could survive the parent close, and a TERM handler exiting zero could mask cancellation. Both were corrected with regression tests before delivery.

## Boundaries and next gates

This is a runnable **development beta**, not certified mobile production readiness. Content synchronization does not transport empty directories, symlinks, ownership/timestamps or executable metadata. Concurrent external editor writes retain a narrow precondition-to-replacement race; important sources need backups and a real device concurrency drill. Retained objects currently have no automatic space pruning. Polling hashes source files; device performance is unmeasured.

G0 and local portions of G1–G5 are implemented and tested; real service/device portions of G2 and G6 remain open. Complete `docs/DEVICE-ACCEPTANCE.md`, including editor atomic saves, shared-storage permissions/remounts, screen-off recovery, dependency runtime choice and an authenticated agent round trip. No GitHub push, npm publication or deployment was performed.

Final review note: a /proc-based descendant-liveness assertion was flaky under container PID visibility. The regression now checks the relevant behavior directly: a TERM-resistant descendant stops writing its heartbeat after cancellation. The final full suite passed. Shell syntax (50 files), repository diff whitespace and current documentation links passed.
