// Builds the game and publishes it to the gh-pages branch (GitHub Pages).
//   node scripts/deploy-pages.mjs             build and push
//   node scripts/deploy-pages.mjs --no-push   build dist/ only (serve it to check: npx vite preview)
//
// The sprites and the ground tileset are generated locally by `npm run assets` and are not in the source branch,
// so Pages gets the built output with the assets in it. `base: './'` in vite.config.ts is what makes the game work
// from a project path (https://<user>.github.io/<repo>/) as well as from a domain.
import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

if (!existsSync(path.join(root, 'public/assets/manifest.json'))) throw new Error('public/assets is missing: run `npm run assets` first');
run('npm run build');
writeFileSync(path.join(dist, '.nojekyll'), '');

if (process.argv.includes('--no-push')) {
  console.log('built dist/ only (not pushed)');
  process.exit(0);
}

const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim();
const sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
rmSync(path.join(dist, '.git'), { recursive: true, force: true });
run('git init -q -b gh-pages', dist);
run('git add -A', dist);
run(`git commit -q -m "Pages build from ${sha}"`, dist);
run(`git push -q -f ${remote} gh-pages`, dist);
rmSync(path.join(dist, '.git'), { recursive: true, force: true });
console.log('pushed gh-pages');
