# Verification

Run from the repository root:

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Default tests must use fake provider processes. Live provider tests are opt-in and need an installed authenticated CLI; they can consume provider quota. Use disposable source trees for live edits. The current default suite excludes the legacy live Codex tests.

Cross-repository tests may require a neighboring FolderSynka checkout; report whether they ran or skipped. CI does not certify real proot binds, Android permissions, Acode saves or screen-off behavior. See [device acceptance](DEVICE-ACCEPTANCE.md).
