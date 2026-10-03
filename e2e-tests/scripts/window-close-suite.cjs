const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const scenario of ['clean', 'discard', 'save', 'devtools']) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'run-wdio.cjs'), '--spec', 'specs/window-close.e2e.cjs'],
    {
      env: { ...process.env, TAURI_E2E_CLOSE_SCENARIO: scenario },
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
