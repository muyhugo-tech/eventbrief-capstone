import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quoteFonts, quoteStyles } from '../public/quote-document.mjs';
import { kitchenStyles } from '../public/kitchen-document.mjs';
import { staffStyles } from '../public/staff-document.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Map([
  ['index.html', 'public/package.html'],
  ...['package.js', 'package.css', 'styles.css', 'package-render.mjs', 'package-export.mjs', 'quote-document.mjs', 'kitchen-document.mjs', 'staff-document.mjs', 'workspace-board.mjs', 'workspace-board.css', 'workspace-calendar.mjs', 'workspace-calendar.css', 'workspace-inbox.mjs', 'workspace-inbox.css'].map(name => [name, `public/${name}`]),
  ...quoteFonts.map(font=>[`quote-fonts/${font.file}`,`node_modules/@fontsource/${font.package}/files/${font.file}`]),
  ...['montserrat','playfair-display'].map(name=>[`quote-fonts/${name}-LICENSE.txt`,`node_modules/@fontsource/${name}/LICENSE`]),
  ['package-contract.mjs', 'lib/package-contract.mjs'],
  ...['kitchen', 'event'].map(name => [`lib/reused-yannis/templates/${name}.mjs`, `lib/reused-yannis/templates/${name}.mjs`])
]);
for (const [target, source] of files) {
  const destination = join(root, 'dist', target);
  await mkdir(dirname(destination), {recursive: true});
  await copyFile(join(root, source), destination);
}
await writeFile(join(root,'dist','quote-document.css'),quoteStyles);
await writeFile(join(root,'dist','kitchen-document.css'),kitchenStyles);
await writeFile(join(root,'dist','staff-document.css'),staffStyles);
console.log(`Built ${files.size+3} public assets. Server code and secrets stay outside the public directory.`);
