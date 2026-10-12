import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Map([
  ['index.html', 'public/package.html'],
  ...['package.js', 'package.css', 'styles.css', 'package-render.mjs', 'package-export.mjs'].map(name => [name, `public/${name}`]),
  ['package-contract.mjs', 'lib/package-contract.mjs'],
  ...['kitchen', 'event'].map(name => [`lib/reused-yannis/templates/${name}.mjs`, `lib/reused-yannis/templates/${name}.mjs`])
]);
for (const [target, source] of files) {
  const destination = join(root, 'dist', target);
  await mkdir(dirname(destination), {recursive: true});
  await copyFile(join(root, source), destination);
}
console.log(`Built ${files.size} public assets. Server code and secrets stay outside the public directory.`);
