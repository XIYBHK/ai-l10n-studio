import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales');
const SRC_DIRS = [path.resolve(__dirname, '../src'), path.resolve(__dirname, '../src-tauri/src')];
const exts = new Set(['.js', '.ts', '.tsx', '.jsx', '.rs']);
const shouldFix = process.argv.includes('--fix');
const WHITELIST_KEYS = new Set([
  'theme.light',
  'theme.dark',
  'theme.system',
  'common.ok',
  'common.cancel',
  'common.confirm',
]);

function getAllFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? getAllFiles(full) : exts.has(path.extname(full)) ? [full] : [];
  });
}
function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, item]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return item && typeof item === 'object' && !Array.isArray(item)
      ? flatten(item, full)
      : [[full, item]];
  });
}
function sourceUsage(source) {
  const used = new Set();
  const namespaces = [...source.matchAll(/useTranslation\(\s*['\"]([^'\"]+)['\"]\s*\)/g)].map(
    (match) => match[1]
  );
  const literal = /(?:\bt|i18n\.t)\(\s*['\"]([^'\"]+)['\"]/g;
  for (const match of source.matchAll(literal)) {
    used.add(match[1]);
    if (!match[1].includes('.') && namespaces.length)
      namespaces.forEach((namespace) => used.add(`${namespace}.${match[1]}`));
  }
  const dynamic = /(?:\bt|i18n\.t)\((?!\s*['\"])\s*[^)]/s.test(source);
  return { used, dynamic };
}
function processI18nFile(i18nPath, lang, usage) {
  const i18n = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));
  const entries = flatten(i18n);
  const unused = entries.filter(([key]) => !WHITELIST_KEYS.has(key) && !usage.used.has(key));
  console.log(
    `[${lang}] ${usage.dynamic ? 'Unresolved candidates (dynamic keys exist)' : 'Unused keys'} (${unused.length}):`,
    unused.map(([key]) => key)
  );
  if (!shouldFix || !unused.length) return;
  if (usage.dynamic) {
    console.log(`[${lang}] Cleanup skipped: dynamic keys cannot be resolved statically.`);
    return;
  }
  const unusedSet = new Set(unused.map(([key]) => key));
  const remove = (value, prefix = '') =>
    Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const full = prefix ? `${prefix}.${key}` : key;
        if (unusedSet.has(full)) return [];
        if (item && typeof item === 'object' && !Array.isArray(item))
          return [[key, remove(item, full)]];
        return [[key, item]];
      })
    );
  fs.copyFileSync(i18nPath, `${i18nPath}.old`, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(i18nPath, `${JSON.stringify(remove(i18n), null, 2)}\n`, 'utf8');
}
export function analyze(source, locale) {
  const usage = sourceUsage(source);
  const keys = flatten(locale).map(([key]) => key);
  const unused = usage.dynamic
    ? []
    : keys.filter((key) => !usage.used.has(key) && !WHITELIST_KEYS.has(key));
  return { ...usage, keys, unused };
}
function main() {
  const files = fs.readdirSync(LOCALES_DIR).filter((file) => /^[a-z0-9-_]+\.json$/i.test(file));
  const source = SRC_DIRS.flatMap(getAllFiles)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const usage = sourceUsage(source);
  files.forEach((file) =>
    processI18nFile(path.join(LOCALES_DIR, file), path.basename(file, '.json'), usage)
  );
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
