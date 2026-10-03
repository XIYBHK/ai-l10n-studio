const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const ownerFile = '.e2e-owner';

function createIsolatedApp(sourcePath, fixtureRoot) {
  const source = fs.realpathSync(sourcePath);
  if (!fs.statSync(source).isFile()) {
    throw new Error(`Tauri app binary is not a file: ${source}`);
  }

  fs.mkdirSync(fixtureRoot, { recursive: true });
  const root = fs.realpathSync(fixtureRoot);
  const directory = fs.mkdtempSync(path.join(root, 'run-'));
  const token = randomUUID();
  const fixture = { root, directory, token, appPath: path.join(directory, path.basename(source)) };
  fs.writeFileSync(path.join(directory, ownerFile), token);

  try {
    fs.copyFileSync(source, fixture.appPath);
    const plugins = path.join(path.dirname(source), '_up_', 'plugins');
    if (fs.existsSync(plugins)) {
      fs.cpSync(plugins, path.join(directory, '_up_', 'plugins'), { recursive: true });
    }
    fs.mkdirSync(path.join(directory, '.config'));
    fs.writeFileSync(path.join(directory, '.config', 'PORTABLE'), '');
    return fixture;
  } catch (error) {
    cleanupIsolatedApp(fixture);
    throw error;
  }
}

function cleanupIsolatedApp(fixture) {
  const { root, directory, token } = fixture;
  if (!fs.existsSync(directory)) return;
  const resolvedRoot = fs.realpathSync(root);
  const resolvedDirectory = fs.realpathSync(directory);
  const relative = path.relative(resolvedRoot, resolvedDirectory);
  if (
    fs.lstatSync(directory).isSymbolicLink() ||
    path.dirname(resolvedDirectory) !== resolvedRoot ||
    !/^run-[^/\\]+$/.test(relative) ||
    fs.readFileSync(path.join(resolvedDirectory, ownerFile), 'utf8') !== token
  ) {
    throw new Error(`Refusing to remove an unowned E2E directory: ${directory}`);
  }
  fs.rmSync(resolvedDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

module.exports = { createIsolatedApp, cleanupIsolatedApp };
