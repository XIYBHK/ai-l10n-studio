import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { createRequire } from 'module';
import fsp from 'fs/promises';

const target = process.argv.slice(2)[0];
const ARCH_MAP = {
  'x86_64-pc-windows-msvc': 'x64',
  'aarch64-pc-windows-msvc': 'arm64',
  'i686-pc-windows-msvc': 'x86',
};

const PROCESS_MAP = {
  x64: 'x64',
  arm64: 'arm64',
  ia32: 'x86',
};
const arch = target ? ARCH_MAP[target] : PROCESS_MAP[process.arch];

/**
 * 打包绿色版/便携版 (only Windows)
 * 用法：node scripts/portable.js [target]
 * 示例：node scripts/portable.js x86_64-pc-windows-msvc
 */
async function resolvePortable() {
  if (process.platform !== 'win32') {
    console.log('[INFO]: Portable build is only supported on Windows');
    return;
  }

  const releaseDir = target ? `./src-tauri/target/${target}/release` : `./src-tauri/target/release`;
  const configDir = path.join(releaseDir, '.config');

  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Could not find the release directory: ${releaseDir}`);
  }

  console.log(`[INFO]: Creating portable build from ${releaseDir}`);

  // 创建 .config/PORTABLE 标志文件
  await fsp.mkdir(configDir, { recursive: true });
  if (!fs.existsSync(path.join(configDir, 'PORTABLE'))) {
    await fsp.writeFile(path.join(configDir, 'PORTABLE'), '');
    console.log('[INFO]: Created PORTABLE flag file');
  }

  const zip = new AdmZip();

  // 添加主程序
  const exeName = 'po-translator-gui.exe';
  const exePath = path.join(releaseDir, exeName);
  if (!fs.existsSync(exePath)) {
    throw new Error(`Could not find executable: ${exePath}`);
  }
  zip.addLocalFile(exePath);
  console.log(`[INFO]: Added ${exeName}`);

  // 添加资源目录（如果存在）
  const resourcesDir = path.join(releaseDir, 'resources');
  if (fs.existsSync(resourcesDir)) {
    zip.addLocalFolder(resourcesDir, 'resources');
    console.log('[INFO]: Added resources folder');
  }

  // 添加 .config 目录（便携标志）
  zip.addLocalFolder(configDir, '.config');
  console.log('[INFO]: Added .config folder');

  // 生成 zip 文件名
  const require = createRequire(import.meta.url);
  const packageJson = require('../package.json');
  const { version } = packageJson;
  const zipFile = `PO-Translator_${version}_${arch}_portable.zip`;

  zip.writeZip(zipFile);
  console.log(`[SUCCESS]: Created portable zip: ${zipFile}`);
}

resolvePortable().catch((error) => {
  console.error('[ERROR]:', error.message);
  process.exit(1);
});
