# Delivery plan

Date: 2026-10-26. Start point: repository audit. Goal: independent usable FolderSynka plus an install-once, per-project MDA CLI.

| Gate | Outcome | Evidence required |
|---|---|---|
| G0 | Agent instructions, docs, dated records, offline CI | Fresh clone commands and accurate records |
| G1 | Safe paths/config and copy/mirror defaults | Metacharacter, overlap and deletion tests |
| G2 | Runtime ownership/recovery and truthful status | Restart/failure tests; real runit validation still required |
| G3 | Bidirectional reconciliation with conflicts | Both-edit/delete-edit matrix, missing storage, corrupt state |
| G4 | Machine interface usable by MDA | JSON CLI contract and actual cross-repository tests |
| G5 | Install-once MDA and per-project init | Package executable, persistence, fake runtime and process tests |
| G6 | Physical-device beta acceptance | Termux + Acode + Ubuntu + authenticated agent round trip |

Build G1–G4 in FolderSynka alongside MDA CLI and process controls. Integrate public contracts, then execute G6. Record implemented portions of a gate precisely; a passing stub does not close a real-runtime gate.

Next release work after this checkpoint: complete physical-device acceptance; measure save latency and idle activity; validate Android storage removal and screen-off recovery; strengthen crash journaling and retention based on observed failures; publish only after installation and recovery instructions match behavior.
