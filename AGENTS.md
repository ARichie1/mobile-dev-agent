# Mobile Dev Agent: agent working agreement

Read this file, `docs/README.md`, `docs/plan.md`, and `progress/README.md` before changing behavior. The current repository is the source of truth; never infer a passed check from an earlier report.

## Workflow

1. Define the user-visible outcome and acceptance cases. Identify the owning module.
2. Delegate independent bounded tasks when authorized, with disjoint write scopes. A coordinator integrates and verifies shared contracts.
3. Prefer small reversible changes. Preserve user code, conflict versions and configuration identity. Never use opposing deletion mirrors as bidirectional sync.
4. Add behavior-focused regression tests for data loss, configuration interpretation, process lifecycle and protocol changes. Default tests must not invoke paid/live agents or require credentials.
5. Run the relevant checks, record exact results and limitations. Android/proot/Acode claims require actual device evidence; Linux stubs establish only contract behavior.
6. Update documentation when commands or schemas change. Add dated report and progress entries and link them from their indexes. Never claim production readiness while device gates are open.

## Boundaries

FolderSynka owns sync planning, baseline, conflicts, retention and services. MDA owns project initialization, runtime launch and agent execution. Integrate via versioned JSON CLI capabilities; never modify another application's private runtime files. Paths are data, not shell programs. Use argument arrays and validate canonical roots.

Do not commit credentials, environment files, generated dependencies, agent transcripts or local sync state. Do not delete source trees on reset/uninstall. Do not run remote publication or real agent integration by default.

## Roles and evidence

See `agents/README.md` for roles and `docs/TESTING.md` for verification. Reports live in `reports/YYYY-MM-DD/HHMMSS-topic.md`; progress lives in `progress/YYYY-MM-DD/HHMMSS-topic.md`. Timestamps use Africa/Lagos and indexes list newest first. Treat a plan, an implementation and device acceptance as separate facts.
