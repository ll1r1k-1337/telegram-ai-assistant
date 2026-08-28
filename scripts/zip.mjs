/**
 * Build pipeline: создаёт zip для Chrome Web Store.
 *
 * Usage:
 *   node scripts/zip.mjs          — build + zip
 *   node scripts/zip.mjs --no-build — только zip (dist/ уже собран)
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const skipBuild = process.argv.includes('--no-build');

// Step 1: build
if (!skipBuild) {
  console.log('Building...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

if (!existsSync(distDir)) {
  console.error('dist/ not found. Run npm run build first.');
  process.exit(1);
}

// Step 2: read manifest for version
const manifestPath = join(distDir, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('dist/manifest.json not found.');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '0.0.0';
const zipName = `telegram-ai-assistant-v${version}.zip`;
const zipPath = join(root, zipName);

// Step 3: zip via PowerShell (Windows) or zip CLI
if (existsSync(zipPath)) unlinkSync(zipPath);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

const files = walk(distDir);
console.log(`Packing ${files.length} files -> ${zipName}`);

const isWin = process.platform === 'win32';

if (isWin) {
  const distNorm = distDir.replace(/\//g, '\');
  const zipNorm = zipPath.replace(/\//g, '\');
  execSync(
    `powershell.exe -NoProfile -Command "Compress-Archive -Path '${distNorm}\*' -DestinationPath '${zipNorm}' -Force"`,
    { cwd: root, stdio: 'inherit' },
  );
} else {
  execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}

// Step 4: verify
if (!existsSync(zipPath)) {
  console.error('Zip file was not created.');
  process.exit(1);
}

const zipSize = statSync(zipPath).size;
const sizeMB = (zipSize / 1024 / 1024).toFixed(2);
console.log(`Done: ${zipName} (${sizeMB} MB, ${files.length} files)`);

if (zipSize > 10 * 1024 * 1024) {
  console.warn('Warning: zip exceeds 10 MB.');
}
