import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { createPortable, resolveArch } from './portable.js';
import { analyze } from './check-unused-i18n.js';
import appFixture from '../e2e-tests/scripts/app-fixture.cjs';

const { createIsolatedApp, cleanupIsolatedApp } = appFixture;

test('E2E fixture copies app resources without changing existing portable data', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'release');
  fs.mkdirSync(path.join(source, '.config', 'com.potranslator.gui'), { recursive: true });
  const existingState = path.join(source, '.config', 'com.potranslator.gui', 'config.json');
  fs.writeFileSync(existingState, 'original configuration');
  fs.writeFileSync(path.join(source, 'app.exe'), 'exe');
  fs.mkdirSync(path.join(source, '_up_', 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(source, '_up_', 'plugins', 'plugin.toml'), 'plugin');
  const fixture = createIsolatedApp(path.join(source, 'app.exe'), path.join(root, 'fixtures'));
  assert.equal(fs.readFileSync(fixture.appPath, 'utf8'), 'exe');
  assert.equal(
    fs.readFileSync(path.join(fixture.directory, '_up_', 'plugins', 'plugin.toml'), 'utf8'),
    'plugin'
  );
  assert.deepEqual(fs.readdirSync(path.join(fixture.directory, '.config')), ['PORTABLE']);
  cleanupIsolatedApp(fixture);
  assert.equal(fs.existsSync(fixture.directory), false);
  assert.equal(fs.readFileSync(existingState, 'utf8'), 'original configuration');
});

test('E2E cleanup rejects directories outside its root and missing ownership', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'fixtures'));
  const unowned = path.join(root, 'fixtures', 'run-unowned');
  const outside = path.join(root, 'run-outside');
  fs.mkdirSync(unowned);
  fs.mkdirSync(outside);
  for (const directory of [unowned, outside]) {
    assert.throws(() =>
      cleanupIsolatedApp({ root: path.join(root, 'fixtures'), directory, token: 'wrong' })
    );
    assert.equal(fs.existsSync(directory), true);
  }
});

test('portable archive contains marker and plugins but no config state', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const release = path.join(root, 'release');
  fs.mkdirSync(path.join(release, '_up_', 'plugins', 'provider'), { recursive: true });
  fs.writeFileSync(path.join(release, 'po-translator-gui.exe'), 'exe');
  fs.writeFileSync(path.join(release, '_up_', 'plugins', 'provider', 'plugin.toml'), 'plugin');
  fs.writeFileSync(
    path.join(release, '_up_', 'plugins', 'provider', 'provider.rs'),
    'retired source'
  );
  fs.writeFileSync(path.join(release, '_up_', 'plugins', 'stale.dll'), 'retired binary');
  fs.mkdirSync(path.join(release, '.config'));
  fs.writeFileSync(path.join(release, '.config', 'config.secrets.json'), 'secret');
  const zipPath = createPortable({
    releaseDir: release,
    outputDir: root,
    platform: 'win32',
    target: 'x86_64-pc-windows-msvc',
  });
  const entries = new AdmZip(zipPath).getEntries().map((entry) => entry.entryName);
  assert.deepEqual(
    entries.sort(),
    ['.config/PORTABLE', '_up_/plugins/provider/plugin.toml', 'po-translator-gui.exe'].sort()
  );
});

test('i18n analysis keeps nested, namespaced and dynamic keys', () => {
  const locale = { app: { title: 'Title', old: 'Old' }, settings: { label: 'Label' } };
  const result = analyze(
    "const { t } = useTranslation('settings'); t('label'); t(getKey());",
    locale
  );
  assert.equal(result.dynamic, true);
  assert.deepEqual(result.unused, []);
  assert.deepEqual(result.keys.sort(), ['app.old', 'app.title', 'settings.label'].sort());
});

test('i18n examines leaf keys and resolves namespace-local literals', () => {
  const locale = { app: { title: 'Title', old: 'Old' }, settings: { label: 'Label' } };
  const result = analyze(
    "const { t } = useTranslation('settings'); t( 'label'); t('app.title');",
    locale
  );
  assert.equal(result.dynamic, false);
  assert.deepEqual(result.unused, ['app.old']);
});

test('portable fails before creating an archive when resources or architecture are invalid', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => resolveArch('unsupported'));
  fs.writeFileSync(path.join(root, 'po-translator-gui.exe'), 'exe');
  assert.throws(() => createPortable({ releaseDir: root, outputDir: root, platform: 'win32' }));
  fs.mkdirSync(path.join(root, '_up_', 'plugins'), { recursive: true });
  assert.throws(() => createPortable({ releaseDir: root, outputDir: root, platform: 'win32' }));
  assert.equal(
    fs.readdirSync(root).some((file) => file.endsWith('.zip')),
    false
  );
});
