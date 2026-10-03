const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const edgedriver = require('edgedriver');
const { createIsolatedApp, cleanupIsolatedApp } = require('./app-fixture.cjs');

// 加载 e2e-tests/.env（MidScene 模型密钥等），不覆盖已有环境变量
const dotenvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(dotenvPath)) {
  const lines = fs.readFileSync(dotenvPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

const rootDir = path.resolve(__dirname, '..', '..');
const appPath =
  process.env.TAURI_APP_PATH ||
  path.join(rootDir, 'src-tauri', 'target', 'release', 'po-translator-gui.exe');
const fixtureRoot = path.join(rootDir, 'src-tauri', 'target', 'e2e');
const preferredTauriDriverPort = Number(process.env.TAURI_DRIVER_PORT || 4545);
const preferredNativeDriverPort = Number(process.env.TAURI_NATIVE_DRIVER_PORT || 17555);
const tauriDriverBin = process.env.TAURI_DRIVER_BIN || 'tauri-driver';
const wdioScript = path.join(
  rootDir,
  'e2e-tests',
  'node_modules',
  '@wdio',
  'cli',
  'bin',
  'wdio.js'
);

const personalPreferences = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'com.potranslator.gui', 'app-settings.json')
  : null;
function preferencesHash() {
  return personalPreferences && fs.existsSync(personalPreferences)
    ? createHash('sha256').update(fs.readFileSync(personalPreferences)).digest('hex')
    : null;
}

function killProcessTree(child) {
  if (!child || child.killed || !child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    return;
  }

  child.kill('SIGKILL');
}

function getAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      const fallback = net.createServer();
      fallback.unref();
      fallback.on('error', reject);
      fallback.listen(0, '127.0.0.1', () => {
        const address = fallback.address();
        fallback.close(() => resolve(address.port));
      });
    });
    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port: Number(port) });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

function getInstalledEdgeVersion() {
  const candidates = [
    process.env.EDGE_BINARY_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  const edgeBinaryPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!edgeBinaryPath) {
    throw new Error('Could not find Microsoft Edge binary');
  }

  const versionDir = path.basename(path.dirname(edgeBinaryPath));
  if (/^\d+\.\d+\.\d+\.\d+$/.test(versionDir)) {
    return versionDir;
  }

  const result = spawnSync(
    'pwsh.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-Item -LiteralPath '${edgeBinaryPath.replace(/'/g, "''")}').VersionInfo.ProductVersion`,
    ],
    {
      cwd: rootDir,
      encoding: 'utf8',
      windowsHide: true,
    }
  );

  if (result.error || result.status !== 0) {
    throw result.error || new Error(`Edge version check failed: ${result.stderr}`);
  }
  const version = result.stdout.trim();
  if (!version) {
    throw new Error('Could not determine Microsoft Edge version');
  }

  return version;
}

async function main() {
  if (!fs.existsSync(appPath)) {
    throw new Error(`Tauri app binary not found: ${appPath}`);
  }

  const tauriDriverPort = String(await getAvailablePort(preferredTauriDriverPort));
  const nativeDriverPort = String(await getAvailablePort(preferredNativeDriverPort));
  const edgeVersion = process.env.EDGE_VERSION || getInstalledEdgeVersion();
  const edgeBinary =
    process.env.EDGE_DRIVER_BIN ||
    (await edgedriver.download(
      edgeVersion,
      process.env.EDGEDRIVER_CACHE_DIR || path.join(fixtureRoot, 'driver')
    ));
  const driverEnv = {
    ...process.env,
    PATH: `${path.dirname(edgeBinary)}${path.delimiter}${process.env.PATH || ''}`,
  };
  const fixture = createIsolatedApp(appPath, fixtureRoot);
  const preferencesBefore = preferencesHash();
  let edgeDriver;
  let tauriDriver;
  const shutdown = () => {
    killProcessTree(tauriDriver);
    killProcessTree(edgeDriver);
    cleanupIsolatedApp(fixture);
  };

  const onSigint = () => process.exit(130);
  const onSigterm = () => process.exit(143);
  process.on('exit', shutdown);
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);

  try {
    edgeDriver = spawn(edgeBinary, [`--port=${nativeDriverPort}`], {
      cwd: rootDir,
      stdio: 'inherit',
      env: driverEnv,
      shell: false,
      windowsHide: true,
    });

    tauriDriver = spawn(
      tauriDriverBin,
      ['--port', tauriDriverPort, '--native-port', nativeDriverPort],
      {
        cwd: rootDir,
        stdio: 'inherit',
        env: driverEnv,
        shell: false,
        windowsHide: true,
      }
    );

    edgeDriver.on('error', (error) => console.error('[e2e] EdgeDriver failed:', error));
    tauriDriver.on('error', (error) => console.error('[e2e] tauri-driver failed:', error));
    await waitForPort(nativeDriverPort, 30000);
    await waitForPort(tauriDriverPort, 30000);

    const result = spawnSync(
      process.execPath,
      [wdioScript, 'run', './wdio.conf.cjs', ...process.argv.slice(2)],
      {
        cwd: path.join(rootDir, 'e2e-tests'),
        env: {
          ...driverEnv,
          TAURI_APP_PATH: fixture.appPath,
          TAURI_E2E_PO_PATH: fixture.poPath,
          TAURI_E2E_OWNER: fixture.token,
          TAURI_DRIVER_PORT: tauriDriverPort,
        },
        shell: false,
        windowsHide: true,
        stdio: 'inherit',
      }
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    process.removeListener('exit', shutdown);
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    shutdown();
    if (preferencesHash() !== preferencesBefore) {
      throw new Error('Desktop test changed personal preferences outside its isolated fixture');
    }
  }
}

main().catch((error) => {
  console.error('[e2e] failed:', error);
  process.exitCode = 1;
});
