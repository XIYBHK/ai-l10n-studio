const path = require('node:path');

exports.config = {
  runner: 'local',
  specs: ['./specs/**/*.e2e.cjs'],
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
          path.resolve(__dirname, '..', 'src-tauri', 'target', 'debug', 'po-translator-gui.exe'),
      },
    },
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
};
