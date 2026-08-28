/**
 * sync-version.mjs — syncs package.json version into src/manifest.json.
 * Called automatically by npm's "version" lifecycle hook.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const manifestPath = resolve(root, 'src', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.version !== pkg.version) {
  manifest.version = pkg.version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  execSync('git add src/manifest.json', { cwd: root, stdio: 'inherit' });
  console.log(`✔ manifest.json version synced to ${pkg.version}`);
} else {
  console.log(`manifest.json already at ${pkg.version}`);
}
