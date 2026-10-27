# Agent roles

| Role | Responsibility | Required handoff |
|---|---|---|
| Coordinator | Scope, integration contracts, final acceptance | Changed behavior, checks, remaining gates |
| Sync safety | Root/path validation, serialization, safe deletion | Regression evidence and migration impact |
| Reconciliation | Baselines, conflicts, mode semantics, recovery | Change matrix tests and failure behavior |
| CLI/runtime | Project init, packaging, runtime paths, diagnostics | Fresh install and idempotency checks |
| Agent execution | Process output, timeout, cancellation, permissions | Deterministic fake-process tests |
| Integration QA | Cross-repository workflow, negative cases | Contract tests, distinction from device evidence |
| Documentation/release | Guides, sorted records, release gates | Accurate install and recovery instructions |

Assign one owner per file set. Ask workers to edit their assigned files, report paths and commands, and flag contract dependencies. The coordinator reviews changes before accepting them. More agents are useful only while their scopes remain independent.

Role briefs: [coordinator](coordinator.md), [sync safety](sync-safety.md), [reconciliation](reconciliation.md), [CLI/runtime](cli-runtime.md), [agent execution](agent-execution.md), [QA](qa.md), [release](release.md).
