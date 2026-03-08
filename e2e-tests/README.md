# Desktop E2E

This folder contains the real desktop shell smoke tests for the Tauri app.

## Commands

- Install once: `npm ci --prefix e2e-tests`
- Build debug desktop binary: `npm run test:e2e:build`
- Run desktop E2E: `npm run test:e2e`

## Notes

- The runner uses `tauri-driver` plus a locally downloaded `msedgedriver.exe`.
- Tests run against `src-tauri/target/debug/po-translator-gui.exe`.
- The runner forces Tauri portable mode under `src-tauri/target/debug/.config/PORTABLE` and clears `src-tauri/target/debug/.config/com.potranslator.gui` before each run to keep results deterministic.
- Current desktop scope is a shell-level smoke check: Tauri app boots, WebDriver session attaches, and at least one desktop webview handle is available.
- UI semantics are currently covered by the Vitest component/UI suite in `src/__tests__/`.
- On this local machine, WebDriver attaches to `about:blank` under Edge/WebView2 145, so the desktop suite intentionally stays at shell-smoke level for now.
