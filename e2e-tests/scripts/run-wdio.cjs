const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const edgedriver = require('edgedriver');

const rootDir = path.resolve(__dirname, '..', '..');
const appPath =
  process.env.TAURI_APP_PATH || path.join(rootDir, 'src-tauri', 'target', 'debug', 'po-translator-gui.exe');
const exeDir = path.dirname(appPath);
const portableDir = path.join(exeDir, '.config');
const portableMarker = path.join(portableDir, 'PORTABLE');
const portableStateDir = path.join(portableDir, 'com.potranslator.gui');
const preferredTauriDriverPort = Number(process.env.TAURI_DRIVER_PORT || 4545);
const preferredNativeDriverPort = Number(process.env.TAURI_NATIVE_DRIVER_PORT || 17555);
const tauriDriverBin = process.env.TAURI_DRIVER_BIN || 'tauri-driver';
const wdioBin = path.join(
  rootDir,
  'e2e-tests',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wdio.cmd' : 'wdio'
);

function killProcessTree(child) {
  if (!child || child.killed || !child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
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

function preparePortableState() {
  fs.mkdirSync(portableDir, { recursive: true });
  if (!fs.existsSync(portableMarker)) {
    fs.writeFileSync(portableMarker, '');
  }
  fs.rmSync(portableStateDir, { recursive: true, force: true });
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
    'powershell.exe',
    ['-Command', `(Get-Item '${edgeBinaryPath.replace(/'/g, "''")}').VersionInfo.ProductVersion`],
    {
      cwd: rootDir,
      encoding: 'utf8',
    }
  );

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

  preparePortableState();

  const tauriDriverPort = String(await getAvailablePort(preferredTauriDriverPort));
  const nativeDriverPort = String(await getAvailablePort(preferredNativeDriverPort));
  const edgeVersion = process.env.EDGE_VERSION || getInstalledEdgeVersion();
  const edgeBinary = process.env.EDGE_DRIVER_BIN || (await edgedriver.download(edgeVersion));
  const driverEnv = {
    ...process.env,
    PATH: `${path.dirname(edgeBinary)}${path.delimiter}${process.env.PATH || ''}`,
  };

  const edgeDriver = spawn(edgeBinary, [`--port=${nativeDriverPort}`], {
    cwd: rootDir,
    stdio: 'inherit',
    env: driverEnv,
    shell: false,
  });

  const tauriDriver = spawn(tauriDriverBin, ['--port', tauriDriverPort, '--native-port', nativeDriverPort], {
    cwd: rootDir,
    stdio: 'inherit',
    env: driverEnv,
    shell: process.platform === 'win32',
  });

  const shutdown = () => {
    killProcessTree(tauriDriver);
    killProcessTree(edgeDriver);
  };

  process.on('exit', shutdown);
  process.on('SIGINT', () => {
    shutdown();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(143);
  });

  try {
    await waitForPort(nativeDriverPort, 30000);
    await waitForPort(tauriDriverPort, 30000);

    const result = spawnSync(wdioBin, ['run', './wdio.conf.cjs'], {
      cwd: path.join(rootDir, 'e2e-tests'),
      env: {
        ...driverEnv,
        TAURI_APP_PATH: appPath,
        TAURI_DRIVER_PORT: tauriDriverPort,
      },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    shutdown();
  }
}

main().catch((error) => {
  console.error('[e2e] failed:', error);
  process.exit(1);
});
