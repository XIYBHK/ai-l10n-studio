# GitHub Actions Workflows

This repository currently uses five active automation entries:

## Active Workflows

### 1. `check.yml`

Trigger:

- `push` to `main` and `feature/*`
- `pull_request` targeting `main`
- manual dispatch

What it does:

- checks Prettier formatting
- checks Rust formatting
- builds the frontend (`npm run build`)
- runs frontend UI tests (`npm run test:run`)
- runs Rust tests
- runs Clippy on library and binary targets with warnings denied

Important note:

- this workflow is now a pure validation workflow
- it no longer auto-formats code or pushes bot commits

### 2. `ui-e2e.yml`

Trigger:

- `push` to `main`
- manual dispatch

What it does:

- installs the dedicated desktop E2E toolchain under `e2e-tests/`
- builds the debug Tauri desktop binary without bundling
- runs the real Windows desktop shell smoke suite through `tauri-driver`

Current desktop E2E scope:

- desktop app boot
- WebDriver session attach
- desktop webview handle discovery

### 3. `build.yml`

Trigger:

- manual dispatch only

What it does:

- builds Tauri artifacts on Windows, macOS, and Ubuntu
- uploads platform artifacts for inspection

Current artifact targets:

- Windows: MSI / NSIS / portable executable
- macOS: DMG / `.app` archive
- Linux: DEB

### 4. `release.yml`

Trigger:

- push tag matching `v*`
- manual dispatch

What it does:

- builds release artifacts for Windows, macOS, and Ubuntu
- prepares release files
- creates a draft GitHub Release
- uploads release assets

Notes:

- Linux currently publishes DEB artifacts
- Release uses the same Ubuntu system dependency baseline as CI where possible

### 5. `dependabot.yml`

Schedules:

- npm: weekly
- cargo: weekly
- GitHub Actions: monthly

## Recommended Usage

### Normal development

- push code or open a PR
- rely on `check.yml` as the main quality gate
- run `ui-e2e.yml` when you need real desktop shell verification
- run `build.yml` manually when you need cross-platform packaging verification

### Release flow

1. update version fields
2. create and push a `v*` tag
3. review the generated draft release on GitHub

## Maintenance Notes

- Keep workflow docs aligned with actual workflow files
- If a workflow is removed or disabled, update this file in the same change
- Prefer validation in CI and formatting locally or via dedicated scripts
