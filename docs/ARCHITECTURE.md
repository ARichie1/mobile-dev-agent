# Product boundary

Android shared storage contains an editor-facing source mirror. The Termux private project contains Git, dependencies and secrets. Ubuntu receives a bind of the Termux project and runs the agent against that same source tree. There are only two synchronized trees.

FolderSynka runs in Termux and remains usable independently. It supports source-to-destination copy/mirror and baseline-based bidirectional reconciliation. Conflicts must preserve user content; unavailable storage is an error, never evidence of deletion.

MDA is installed once and initializes each project with `mda init`. Project identity and runtime choices are persisted locally. Sync is optional for host-only projects. MDA invokes FolderSynka through its machine CLI and Ubuntu through an argument-based launcher; it does not copy the Termux project into a third workspace.

Proot is a compatibility environment, not an agent security sandbox. Permission choices are explicit and do not bypass provider safeguards. Ubuntu and Termux native dependencies may be incompatible; choose the build runtime and keep incompatible generated dependencies out of the shared mirror.

MVP scope: one agent provider, one initialized project workflow, recoverable file conflicts, deterministic local tests and documented device acceptance. Remote bridges, concurrent autonomous agents editing one project, automatic merge and editor installation are deferred.
