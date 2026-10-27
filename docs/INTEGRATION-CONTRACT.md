# Integration contract — schema 1

FolderSynka is a separate host-side executable. MDA uses argument arrays, checks capabilities and verifies profile endpoints/mode before reconciliation. It must not write FolderSynka runtime files.

```json
{"schemaVersion":1,"operation":"inspect","profile":"example","ok":true,"mode":"bidirectional","source":"/shared/example","destination":"/private/example","converged":false,"actions":[],"conflicts":[]}
```

Actual responses also carry a content-derived revision. `ok` describes the command result, not universal convergence. Inspect/status return successfully with a nonempty conflicts array; plan/sync/conflicts/resolve return exit 4 if conflicts remain. Plan never transfers workspace content. Sync applies a pass; wait actively reconciles until convergence or failure/timeout.

Capabilities advertise modes/commands/limitations. Source is side a; destination is side b. `resolve NAME --path RELATIVE --take a|b --json` selects one side explicitly. Paths are relative and cannot traverse outside roots. The delete guard blocks more than ten file deletions unless the caller explicitly supplies `--allow-large-delete` for that pass. MDA never adds that override automatically.

FolderSynka exit codes: 0 success, 2 invalid/unavailable, 3 busy, 4 conflicts, 5 operation failure. MDA maps sync errors to 20, conflict to 21, busy to 22; timeout 124 and cancellation 130. Provider process failures remain independently visible. Start/stop currently use the human service CLI, not JSON.

Both products are 1.1.0-beta.1 at this checkpoint. Capability/schema checks take precedence over assumptions based solely on package versions. Physical Android/proot/editor behavior is outside offline contract evidence.
