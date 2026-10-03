import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

export const ARCH_MAP = {
  'x86_64-pc-windows-msvc': 'x64',
  'aarch64-pc-windows-msvc': 'arm64',
  'i686-pc-windows-msvc': 'x86',
};
const PROCESS_MAP = { x64: 'x64', arm64: 'arm64', ia32: 'x86' };
export function resolveArch(target, processArch = process.arch) {
  const arch = target ? ARCH_MAP[target] : PROCESS_MAP[processArch];
  if (!arch) throw new Error(`Unsupported Windows target architecture: ${target || processArch}`);
  return arch;
}
export function createPortable({
  releaseDir,
  outputDir = process.cwd(),
  target,
  platform = process.platform,
}) {
  const arch = resolveArch(target);
  if (platform !== 'win32') return null;
  if (!fs.existsSync(releaseDir))
    throw new Error(`Could not find the release directory: ${releaseDir}`);
  const exePath = path.join(releaseDir, 'po-translator-gui.exe');
  const pluginsDir = path.join(releaseDir, '_up_', 'plugins');
  if (!fs.existsSync(exePath)) throw new Error(`Could not find executable: ${exePath}`);
  if (!fs.statSync(pluginsDir).isDirectory())
    throw new Error(`Could not find plugins directory: ${pluginsDir}`);
  const catalogs = fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, file: path.join(pluginsDir, entry.name, 'plugin.toml') }))
    .filter((catalog) => fs.existsSync(catalog.file) && fs.statSync(catalog.file).isFile());
  if (catalogs.length === 0) throw new Error(`No plugin catalogs found: ${pluginsDir}`);
  const zip = new AdmZip();
  zip.addLocalFile(exePath);
  for (const catalog of catalogs) {
    zip.addLocalFile(catalog.file, `_up_/plugins/${catalog.name}`);
  }
  zip.addFile('.config/PORTABLE', Buffer.alloc(0));
  const require = createRequire(import.meta.url);
  const { version } = require('../package.json');
  const zipFile = path.join(outputDir, `PO-Translator_${version}_${arch}_portable.zip`);
  zip.writeZip(zipFile);
  return zipFile;
}
async function main() {
  const target = process.argv.slice(2)[0];
  const releaseDir = target ? `./src-tauri/target/${target}/release` : './src-tauri/target/release';
  const zipFile = createPortable({ releaseDir, target });
  if (zipFile) console.log(`[SUCCESS]: Created portable zip: ${zipFile}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error('[ERROR]:', error.message);
    process.exitCode = 1;
  });
