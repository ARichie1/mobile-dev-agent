# Physical Android release gate

Status: NOT RUN in the Linux development environment. Record Android version, Termux distribution/version, device architecture, Ubuntu/proot-distro versions, editor version, CLI versions and commit IDs in a dated report.

1. Install both tools cleanly and run diagnostics; grant shared-storage permission through Termux.
2. Initialize a disposable Termux project with a shared Android mirror and Ubuntu runtime. Verify Ubuntu sees a write made in Termux through the declared bind.
3. Edit/create/rename/delete files in Acode; reconcile; verify bytes in Termux and Ubuntu. Repeat in the opposite direction.
4. Authenticate the chosen agent yourself, request a small edit in the disposable project and verify it reaches the editor. Run its test/build in the selected runtime.
5. Change the same file differently on both sides. Verify both versions survive, conflict status is visible, and explicit resolution converges.
6. Repeat with delete/edit, file/directory collision, permission loss, full disk, unavailable shared storage and interrupted transfer.
7. Stop/restart services and Ubuntu; force-stop Termux; recover on next launch without false-clean status or silent deletion.
8. Leave screen off, switch apps and test battery restrictions. Record actual background behavior and recovery steps.
9. Confirm `.git`, `.mda`, dependencies, `.env` and generated outputs stay private. Test paths with spaces, Unicode and shell metacharacters.
10. Upgrade and uninstall the tools; project source and conflict snapshots must remain available unless the user explicitly removes them.

Pass requires evidence for every supported path. Mark unsupported cases clearly and block unsafe operations rather than silently approximating them.
