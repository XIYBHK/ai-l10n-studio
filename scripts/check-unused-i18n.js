import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales');
const SRC_DIRS = [path.resolve(__dirname, '../src'), path.resolve(__dirname, '../src-tauri')];
const exts = ['.js', '.ts', '.tsx', '.jsx', '.vue', '.rs'];
const shouldFix = process.argv.includes('--fix');

function getAllFiles(dir, extensions) {
  let files = [];
  fs.readdirSync(dir).forEach((file) => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(getAllFiles(full, extensions));
    } else if (extensions.includes(path.extname(full))) {
      files.push(full);
    }
  });
  return files;
}

function getAllSourceContent() {
  const files = SRC_DIRS.flatMap((dir) => getAllFiles(dir, exts));
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

const WHITELIST_KEYS = [
  'theme.light',
  'theme.dark',
  'theme.system',
  'common.ok',
  'common.cancel',
  'common.confirm',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function processI18nFile(i18nPath, lang, allSource) {
  const i18n = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));
  const keys = Object.keys(i18n);
  const used = {};
  const unused = [];

  let checked = 0;
  const total = keys.length;
  keys.forEach((key) => {
    if (WHITELIST_KEYS.includes(key)) {
      used[key] = i18n[key];
    } else {
      const regex = new RegExp(`["'\`]${escapeRegExp(key)}["'\`]`);
      if (regex.test(allSource)) {
        used[key] = i18n[key];
      } else {
        unused.push(key);
      }
    }

    checked++;
    if (checked % 20 === 0 || checked === total) {
      const percent = ((checked / total) * 100).toFixed(1);
      process.stdout.write(`\r[${lang}] Progress: ${checked}/${total} (${percent}%)`);
      if (checked === total) {
        process.stdout.write('\n');
      }
    }
  });

  console.log(`\n[${lang}] Unused keys (${unused.length}):`, unused);

  if (unused.length === 0) {
    console.log(`[${lang}] No unused keys found.`);
    return;
  }

  if (!shouldFix) {
    console.log(`[${lang}] Run npm run i18n:clean to remove unused keys.`);
    return;
  }

  const oldPath = i18nPath + '.old';
  fs.renameSync(i18nPath, oldPath);
  fs.writeFileSync(i18nPath, JSON.stringify(used, null, 2), 'utf8');
  console.log(`[${lang}] Cleaned i18n file written to src/i18n/locales/${path.basename(i18nPath)}`);
  console.log(`[${lang}] Original file backed up as ${path.basename(oldPath)}`);
}

function main() {
  console.log(`Checking unused i18n keys${shouldFix ? ' and cleaning files' : ''}...\n`);

  const files = fs
    .readdirSync(LOCALES_DIR)
    .filter((file) => /^[a-z0-9\-_]+\.json$/i.test(file) && !file.endsWith('.old'));

  if (files.length === 0) {
    console.error(`No i18n files found in ${LOCALES_DIR}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} i18n files:`, files, '\n');

  const allSource = getAllSourceContent();
  console.log(`Scanned ${allSource.split('\n').length} lines of source code\n`);

  files.forEach((file) => {
    const lang = path.basename(file, '.json');
    processI18nFile(path.join(LOCALES_DIR, file), lang, allSource);
    console.log('');
  });

  console.log('Done. Check the output above for details.');
}

main();
