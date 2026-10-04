const path = require('node:path');

async function placeTestWindow() {
  const x = Number(process.env.TAURI_E2E_WINDOW_X);
  const y = Number(process.env.TAURI_E2E_WINDOW_Y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(
      'pwsh.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        path.resolve(__dirname, 'scripts/native-window.ps1'),
        '-ExecutablePath',
        process.env.TAURI_APP_PATH,
        '-ExpectedOwner',
        process.env.TAURI_E2E_OWNER,
        '-Action',
        'place',
        '-X',
        String(x),
        '-Y',
        String(y),
      ],
      { encoding: 'utf8', windowsHide: true }
    );
    if (result.error || result.status !== 0)
      throw result.error || new Error(`Test window placement failed: ${result.stderr}`);
    console.log(`[e2e] ${result.stdout.trim()}`);
  }
}

exports.config = {
  runner: 'local',
  specs: ['./specs/ui.e2e.cjs'],
  maxInstances: 1,
  logLevel: 'warn',
  bail: 0,
  waitforTimeout: 20000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 1,
  hostname: '127.0.0.1',
  port: Number(process.env.TAURI_DRIVER_PORT || 4545),
  path: '/',
  capabilities: [
    {
      browserName: 'wry',
      'tauri:options': {
        application:
          process.env.TAURI_APP_PATH ||
          path.resolve(__dirname, '..', 'src-tauri', 'target', 'release', 'po-translator-gui.exe'),
      },
    },
  ],
  framework: 'mocha',
  reporters: ['spec'],
  before: placeTestWindow,
  afterCommand: async function (commandName) {
    if (commandName === 'switchToWindow') await placeTestWindow();
  },
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
};
