# Mobile Dev Agent (MDA)

Install once, then initialize each project with **`mda init`**. MDA runs a Codex CLI agent against a Termux project directly or through Ubuntu/proot, and uses FolderSynka to reconcile an optional Android editor mirror.

This is a development beta. Offline process, project and integration tests are available; real Termux + Ubuntu + Acode acceptance still needs a physical device.

## One-time installation

Use Node.js 22 or later supported by the toolchain in Termux. From this updated checkout/archive:

```bash
npm ci --ignore-scripts
npm run build
npm pack
# Install the generated mobile-dev-agent-VERSION.tgz globally:
npm install -g ./mobile-dev-agent-1.1.0-beta.1.tgz
mda help
```

The package is not published by this change. Do not assume `npm install -g mobile-dev-agent` retrieves this implementation. The installed runtime has no npm runtime dependencies. Install and authenticate your chosen Codex CLI separately in the runtime where it will execute. MDA does not install an editor, obtain agent credentials, or bypass provider permissions.

For shared-storage sync, install the matching FolderSynka beta and run `foldersynka capabilities --json`. For Ubuntu, install/configure proot-distro and an Ubuntu distribution separately. MDA checks that the installed login help advertises the bind/work-dir options it uses; device verification is still required.

## Every new project

```bash
cd ~/projects/my-app
mda init
mda doctor
mda run "Explain this project and identify its test command"
```

Initialization persists machine-local settings under `.mda/config.json`, excludes private local state from Git, and is idempotent. It does not synchronize files. Repeating init with incompatible options fails rather than replacing configuration. Run in the initialized project root; moved/cloned machine configuration must be deliberately recreated after inspection. If initialization was force-killed, inspect and remove a stale `.mda/init.lock` only after ensuring no init process is active.

For an Android editor mirror and an agent installed inside Ubuntu:

```bash
mkdir -p ~/projects/my-app ~/storage/shared/Projects/my-app
cd ~/projects/my-app
mda init --shared ~/storage/shared/Projects/my-app --runtime ubuntu
mda doctor
mda sync --plan
mda sync
mda start
mda agent run "Implement a small change and run the relevant tests"
mda status
mda stop
```

The Ubuntu guest path is `/mnt/mda-project`, bound to the Termux project. There is no third synchronized copy. Use `--runtime host` for a native runtime and `--agent EXECUTABLE` to configure the Codex-compatible executable. Keep incompatible Ubuntu/Termux native dependencies separate and out of the editor mirror.

## Commands

| Command | Behavior |
|---|---|
| `init` | Initialize current folder, optionally create/check FolderSynka profile |
| `doctor` | Check configured executable/runtime and sync interface; does not prove authentication |
| `status` | Show project and reconciliation state |
| `sync --plan` | Preview source-file operations |
| `sync` | Reconcile once |
| `start` / `stop` | Start/stop the project's FolderSynka service |
| `run PROMPT` / `agent run PROMPT` | Reconcile inbound, execute agent, reconcile outbound |
| `--json` | Machine response; for literal prompt flags use `run -- PROMPT` |

Unresolved inbound conflicts block a new agent run. Resolve them through FolderSynka using the profile printed by status/config. Outbound sync failures are reported separately from the agent exit. Stop remains possible even if synchronization has failed.

Agent output streams with bounded retention; timeout defaults to 120000 ms and Ctrl+C requests cancellation. POSIX cancellation terminates the process group, including descendants that inherit output pipes. Windows process-tree behavior is not the mobile target and needs separate acceptance.

Optional local config keys: `model`, `instructions`, `timeout` (milliseconds), `skipGitRepoCheck` (false by default). MDA requests `workspace-write`; proot itself is not a security sandbox. A non-Git project may require an explicitly configured Git-check opt-out or Git initialization.

Sync errors exit 20, conflicts 21, busy 22; timeout 124 and cancellation 130. Normal agent exit codes are preserved. A successful agent with failed outbound sync returns the sync error code. If both fail, inspect the combined result (use `--json`).

## Development and release

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Default tests exclude live provider calls and stale build output. `npm run test:live` explicitly opts into installed/authenticated Codex tests and may consume quota. Cross-repository offline integration tests run when a neighboring FolderSynka checkout exists; Ubuntu launch is simulated there.

Read [AGENTS.md](AGENTS.md), [architecture](docs/ARCHITECTURE.md), [plan](docs/plan.md), [testing](docs/TESTING.md), [reports](reports/README.md), and [progress](progress/README.md). Complete [physical-device acceptance](docs/DEVICE-ACCEPTANCE.md) before treating this beta as validated for your phone.
