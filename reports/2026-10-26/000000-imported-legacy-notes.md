# Imported legacy working ledger

Imported on 2026-10-26. Original notes below are historical claims, not verification rerun at this checkpoint.

# Mobile Dev Agent

## Technical Change Ledger

> Internal working ledger for the Mobile Dev Agent project.
>
> This document records completed implementation phases, important
> discoveries, environment changes, decisions, and verification results.
>
> It is intentionally maintained during development and may later be
> converted into an official `CHANGELOG.md`.

---

## Project Status

| Field | Value |
|---|---|
| **Project** | Mobile Dev Agent |
| **Ledger** | `change.md` |
| **Current Phase** | Phase 2 — Complete |
| **Current Status** | Codex CLI operational in Termux |
| **Platform** | Android / Termux |
| **Architecture** | ARM64 / AArch64 |
| **Development Environment** | Termux + Ubuntu via `proot-distro` |

---

# Phase 1 — Environment Discovery & Acode Integration

**Status:** COMPLETE

## Objective

Establish and verify the relationship between the Android development
environment, Termux, Acode, and the local AcodeX server before installing
and configuring the Mobile Dev Agent tooling.

## Starting Point

The initial investigation was focused on determining whether the local
AcodeX server was running correctly and whether Acode's terminal
environment could communicate with the Termux environment.

The local AcodeX server was found listening on:

```text
127.0.0.1:8767
```

Initial process discovery commands did not identify the server process:

```bash
pgrep -af axs
pgrep -af acodeX-server
```

However, network-level verification confirmed that the service was
actually listening.

## Verification

### Port Check

```bash
ss -ltnp | grep 8767
```

Result:

```text
LISTEN 0 0 127.0.0.1:8767 0.0.0.0:*
```

A second check using `netstat` confirmed the same:

```bash
netstat -ltnp 2>/dev/null | grep 8767
```

Result:

```text
tcp 0 0 127.0.0.1:8767 0.0.0.0:* LISTEN -
```

### HTTP Check

The server responded successfully from Termux:

```bash
curl -i http://127.0.0.1:8767
```

Result:

```text
HTTP/1.1 200 OK
content-type: text/plain; charset=utf-8
access-control-allow-origin: https://localhost
```

The response body confirmed the service:

```text
Rust based AcodeX server
```

The hostname-based request also succeeded:

```bash
curl -i http://localhost:8767
```

## Acode Environment

Acode's terminal was inspected using:

```bash
echo $PREFIX
```

Initially, Acode exposed its own Alpine environment:

```text
/data/user/0/com.foxdebug.acodefree/files
```

The development environment was subsequently corrected so that the
intended Termux environment was available.

After restarting the phone, the environment behaved correctly and
Termux reported:

```text
/data/data/com.termux/files/usr
```

## Result

Phase 1 established that:

- AcodeX server is running.
- AcodeX is listening on port `8767`.
- The server responds successfully over localhost.
- Acode can be used alongside the Termux development environment.
- The Termux environment is correctly available after the environment
  reset/restart.
- The intended development prefix is:

```text
/data/data/com.termux/files/usr
```

## Phase 1 Conclusion

The Android development environment is operational and ready for the
installation of the Mobile Dev Agent tooling.

---

# Phase 2 — Codex CLI Installation on ARM64 Termux

**Status:** COMPLETE

## Objective

Install and run the OpenAI Codex CLI directly from Termux on the Android
ARM64/AArch64 environment.

## Initial Environment

Termux reported the following npm configuration:

```bash
npm config get prefix
```

Result:

```text
/data/data/com.termux/files/usr
```

Global npm modules were located at:

```text
/data/data/com.termux/files/usr/lib/node_modules
```

The system architecture was verified as:

```bash
uname -m
```

Result:

```text
aarch64
```

## Initial Codex Installation Attempt

Codex was initially installed through npm:

```bash
npm install -g @openai/codex
```

Installation completed successfully:

```text
added 1 package in 10s
```

The installed version was:

```text
@openai/codex@0.147.0
```

However, executing Codex failed:

```bash
codex --version
```

with:

```text
Error: Missing optional dependency @openai/codex-linux-arm64.
```

## Investigation

The npm package was confirmed:

```bash
npm list -g --depth=1 @openai/codex
```

Result:

```text
@openai/codex@0.147.0
```

The published package version was also confirmed:

```bash
npm view @openai/codex version
```

Result:

```text
0.147.0
```

An attempt to locate the optional ARM64 package through npm:

```bash
npm view @openai/codex-linux-arm64 version
```

returned:

```text
404 Not Found
```

This established that the npm installation path could not provide the
required ARM64 executable through the expected optional dependency.

## Ubuntu ARM64 Environment

An existing Ubuntu environment was available through:

```bash
proot-distro login ubuntu
```

The environment was verified as:

```text
Ubuntu 22.04.2 LTS
```

Architecture:

```text
aarch64
```

Debian package architecture:

```text
arm64
```

The environment also had:

```text
Node.js v22.21.1
npm 10.9.4
Git 2.54.0
```

## Release Investigation

The official Codex GitHub release was queried and identified as:

```text
rust-v0.147.0
```

The release assets were inspected for ARM64 builds.

An ARM64 Linux musl build was found:

```text
codex-aarch64-unknown-linux-musl.tar.gz
```

The corresponding release asset was downloaded and extracted inside the
Ubuntu environment.

## Binary Verification

The extracted executable was:

```text
codex-aarch64-unknown-linux-musl
```

After making it executable:

```bash
chmod +x codex-aarch64-unknown-linux-musl
```

the binary was tested directly:

```bash
./codex-aarch64-unknown-linux-musl --version
```

Result:

```text
codex-cli 0.147.0
```

This confirmed that the ARM64 Codex binary itself was functional.

## Termux Installation

The verified executable was copied from the Ubuntu root filesystem into
the Termux executable directory:

```bash
cp "$PREFIX/var/lib/proot-distro/installed-rootfs/ubuntu/tmp/codex-aarch64-unknown-linux-musl" \
   "$PREFIX/bin/codex"
```

Executable permissions were applied:

```bash
chmod +x "$PREFIX/bin/codex"
```

The command location was verified:

```bash
which codex
```

Result:

```text
/data/data/com.termux/files/usr/bin/codex
```

The final Termux verification succeeded:

```bash
codex --version
```

Result:

```text
codex-cli 0.147.0
```

## Result

Phase 2 established that:

- The device is ARM64/AArch64.
- The standard npm installation was incomplete because the expected ARM64
  optional dependency was unavailable through npm.
- The official Codex ARM64 release asset was located.
- The Codex ARM64 musl executable was successfully downloaded.
- The executable was successfully tested inside Ubuntu.
- The executable was successfully copied into Termux.
- Codex is now directly callable from Termux.
- Codex version `0.147.0` is operational.

## Current Codex Location

```text
/data/data/com.termux/files/usr/bin/codex
```

## Current Codex Version

```text
codex-cli 0.147.0
```

## Phase 2 Conclusion

Codex CLI is now operational directly from Termux without depending on the
broken npm ARM64 optional-dependency installation path.

---

# Current State

At the completion of Phase 2, the Mobile Dev Agent environment has moved
from initial environment discovery to a functioning Codex CLI runtime.

## Environment

```text
Android
└── Termux
    ├── Node.js v22.21.1
    ├── npm 10.9.4
    ├── Git 2.54.0
    └── Codex CLI 0.147.0
```

## Acode Integration

```text
Acode
└── AcodeX Server
    └── 127.0.0.1:8767
```

## Codex

```text
/data/data/com.termux/files/usr/bin/codex
```

Verified with:

```bash
codex --version
```

Output:

```text
codex-cli 0.147.0
```

---

## Starting Point → Current State

### Starting Point

The project began with an Android-only development environment where the
first task was to establish whether Acode, AcodeX, and Termux could
operate correctly together.

At this stage:

- AcodeX connectivity was being investigated.
- The correct Termux environment had to be established.
- Codex had not yet been installed.
- The ARM64 compatibility path was unknown.

### Current State

The environment now has:

- Working AcodeX localhost connectivity.
- Working Termux development environment.
- ARM64/AArch64 architecture confirmed.
- Ubuntu ARM64 environment available through `proot-distro`.
- Node.js and npm operational.
- Git operational.
- Codex CLI `0.147.0` installed.
- Codex CLI directly executable from Termux.

The project is therefore ready to move from environment setup into the next
Mobile Dev Agent implementation phase.

---

## Phase Ledger

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Environment Discovery & Acode Integration | COMPLETE |
| Phase 2 | Codex CLI Installation on ARM64 Termux | COMPLETE |
| Phase 3 | Mobile Dev Agent Integration | PENDING |

---

## Next Phase

### Phase 3 — Mobile Dev Agent Integration

The next phase should build on the now-working Codex installation rather
than modifying the environment unnecessarily.

---

## Ledger Footer

| Field | Value |
|---|---|
| **Project** | Mobile Dev Agent |
| **Ledger** | `change.md` |
| **Last Completed Phase** | Phase 2 |
| **Current Status** | Codex CLI operational |
| **Codex Version** | `0.147.0` |
| **Platform** | Android / Termux / ARM64 |
| **Next Phase** | Phase 3 — Mobile Dev Agent Integration |

> **Ledger Rule:** Update this ledger only after a phase has been completed
> and verified. Do not record planned work as completed work.

---

**End of Technical Change Ledger**
