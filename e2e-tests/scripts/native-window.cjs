const path = require('node:path');
const { spawnSync } = require('node:child_process');
const appTitle = require('../../src-tauri/tauri.conf.json').app.windows[0].title;

function nativeWindow(action, title = appTitle) {
  const result = spawnSync(
    'pwsh.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      path.join(__dirname, 'native-window.ps1'),
      '-ExecutablePath',
      process.env.TAURI_APP_PATH,
      '-ExpectedOwner',
      process.env.TAURI_E2E_OWNER,
      '-Action',
      action,
      '-WindowTitle',
      title,
    ],
    { encoding: 'utf8', shell: false, windowsHide: true }
  );
  if (result.error || result.status !== 0) {
    throw result.error || new Error('Native window probe failed: ' + result.stderr);
  }
  return JSON.parse(result.stdout.trim());
}

module.exports = { nativeWindow };
