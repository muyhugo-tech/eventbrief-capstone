import { readdir, readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, join, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// An explicit source allowlist: local conversations, receipts, keys, and Git
// history never enter the submission, including when they are untracked.
const rootFiles = new Set(['.env.example', '.gitignore', 'README.md', 'PRODUCT.md', 'HANDOFF.md', 'DESIGN.md', '.impeccable/design.json', 'package.json', 'package-lock.json', 'server.mjs', 'LICENSE', 'LICENSE.md', 'NOTICE']);
const sourceDirectories = new Set(['lib', 'public', 'scripts', 'tests', 'fixtures', 'prompts', 'evaluation', 'docs']);
const textExtensions = /\.(?:md|mjs|js|cjs|ts|tsx|jsx|json|html|css|txt|svg|yml|yaml)$/i;
const prohibitedName = /(?:^|\/)(?:\.git|\.env(?:\..*)?|node_modules|out|coverage|dist|\.next|\.codex|\.agents)(?:\/|$)/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const posix = path => path.split(sep).join('/');
const git = (root, args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], ...options });

export function scanText(path, text) {
  const findings = [];
  const rules = [
    ['credential-token', /(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{24,}|AKIA[A-Z0-9]{16})/],
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['jwt-token', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/],
    ['credential-in-url', /\b(?:postgres(?:ql)?|mysql|https?):\/\/[^\s/:]+:[^\s/@]+@/i],
    ['personal-absolute-path', /(?:[A-Z]:[\\/](?:Users|dev)[\\/]|\/(?:Users|home)\/[A-Za-z0-9_.-]+\/)/i],
    ['private-project-link', /(?:\.\.[\\/])+operator-review-worktree(?:[\\/]|\b)/i],
    ['private-service-url', /https?:\/\/[A-Za-z0-9-]+\.supabase\.co\b/i],
  ];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [rule, pattern] of rules) if (pattern.test(line)) findings.push({ path, line: index + 1, rule });
    for (const match of line.matchAll(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) {
      const domain = match[1].toLowerCase();
      if (!/(?:^|\.)(?:example|test|invalid|localhost)$/.test(domain) && !/^example\.(?:com|org|net)$/.test(domain)) findings.push({ path, line: index + 1, rule: 'non-synthetic-email' });
    }
  });
  if (path === '.env.example') for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (/^[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*=\s*\S/i.test(line)) findings.push({ path, line: index + 1, rule: 'nonempty-example-secret' });
  }
  return findings;
}

export async function inspectPublicTree(root) {
  root = resolve(root);
  const files = [], findings = [];
  async function visit(path) {
    const name = posix(relative(root, path));
    const entry = await lstat(path);
    if (entry.isSymbolicLink()) { findings.push({ path: name, rule: 'symlink-not-exported' }); return; }
    if (name !== '.env.example' && prohibitedName.test(name)) { findings.push({ path: name, rule: 'private-path-in-source-directory' }); return; }
    if (entry.isDirectory()) {
      for (const child of (await readdir(path)).sort()) await visit(join(path, child));
      return;
    }
    if (!entry.isFile() || entry.size > 5 * 1024 * 1024) { findings.push({ path: name, rule: 'unsupported-file' }); return; }
    if (!rootFiles.has(name) && !textExtensions.test(name)) { findings.push({ path: name, rule: 'unreviewed-file-type' }); return; }
    const bytes = await readFile(path);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { findings.push({ path: name, rule: 'non-text-file' }); return; }
    if (text.includes('\u0000')) { findings.push({ path: name, rule: 'binary-file' }); return; }
    findings.push(...scanText(name, text));
    files.push({ path: name, bytes, sha256: hash(bytes) });
  }
  for (const name of (await readdir(root)).sort()) if (rootFiles.has(name) || sourceDirectories.has(name)) await visit(join(root, name));
  // Export only this public design sidecar, never private review/session notes.
  try {
    const designDirectory = await lstat(join(root, '.impeccable'));
    if (designDirectory.isSymbolicLink()) findings.push({ path: '.impeccable', rule: 'symlink-not-exported' });
    else if (designDirectory.isDirectory()) await visit(join(root, '.impeccable', 'design.json'));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // A file tracked outside the allowlist needs an explicit decision. Do not
  // silently omit a runtime dependency or accidentally export an ignored file.
  try {
    if (resolve(git(root, ['rev-parse', '--show-toplevel']).trim()) === root) {
      for (const name of git(root, ['ls-files', '-z']).split('\0').filter(Boolean)) {
        if (!rootFiles.has(name) && !sourceDirectories.has(name.split('/')[0])) findings.push({ path: name, rule: 'tracked-file-outside-allowlist' });
      }
    }
  } catch { /* A standalone exported folder intentionally has no Git metadata. */ }
  for (const required of ['README.md', '.env.example', 'package.json', 'server.mjs']) if (!files.some(file => file.path === required)) findings.push({ path: required, rule: 'missing-required-file' });
  return { files, findings };
}

export function inspectHistory(root) {
  if (resolve(git(root, ['rev-parse', '--show-toplevel']).trim()) !== resolve(root)) throw new Error('History audit must target this standalone repository.');
  const findings = [], seen = new Set();
  const entries = git(root, ['rev-list', '--objects', '--all']).trim().split('\n').filter(Boolean);
  const objects = [];
  for (const entry of entries) {
    const space = entry.indexOf(' '); if (space < 0) continue;
    const object = entry.slice(0, space), path = entry.slice(space + 1);
    if (seen.has(object)) continue; seen.add(object);
    objects.push({ object, path });
  }
  const input = objects.map(item => item.object).join('\n') + '\n';
  const metadata = git(root, ['cat-file', '--batch-check'], { input, stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n');
  const blobs = objects.filter((_, index) => metadata[index]?.split(' ')[1] === 'blob');
  const contents = git(root, ['cat-file', '--batch'], { input: Buffer.from(blobs.map(item => item.object).join('\n') + '\n'), encoding: null, stdio: ['pipe', 'pipe', 'ignore'] });
  let offset = 0;
  for (const { object, path } of blobs) {
    if (path !== '.env.example' && prohibitedName.test(path)) findings.push({ object, path, rule: 'private-path-in-git-history' });
    const end = contents.indexOf(10, offset), header = contents.subarray(offset, end).toString('utf8').split(' '), size = Number(header[2]);
    if (end < 0 || header[0] !== object || header[1] !== 'blob' || !Number.isSafeInteger(size)) throw new Error('Could not parse Git history content.');
    const bytes = contents.subarray(end + 1, end + 1 + size); offset = end + size + 2;
    if (bytes.length <= 5 * 1024 * 1024 && !bytes.includes(0)) findings.push(...scanText(path, bytes.toString('utf8')).map(finding => ({ object, ...finding })));
  }
  const identityCount = new Set(git(root, ['log', '--all', '--format=%ae%n%ce']).split('\n').filter(Boolean)).size;
  return { scope: 'reachable local Git blob content; commit identities counted, never printed', objects: seen.size, distinct_commit_email_identities: identityCount, findings,
    note: 'This does not certify Git history for publication. Commits contain author identities and historical private workflow notes. Publish the reviewed standalone export as a fresh repository.' };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}

// Small, uncompressed ZIP writer using only Node built-ins. All entries are
// audited UTF-8 text, names are relative, and no shell or archive tool is used.
export function zipFiles(files) {
  const chunks = [], directory = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(`eventbrief/${file.path}`, 'utf8'), bytes = file.bytes;
    const crc = crc32(bytes), local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    chunks.push(local, name, bytes); directory.push(central, name); offset += local.length + name.length + bytes.length;
  }
  const index = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, index, end]);
}

export async function exportPublicTree(root, output) {
  const inspected = await inspectPublicTree(root);
  if (inspected.findings.length) throw new Error(`Submission blocked by ${inspected.findings.length} findings. Run the public check first.`);
  const manifest = { schema: 'eventbrief.public-manifest.v1', purpose: 'Standalone synthetic capstone source; no Git history or saved local state.', files: inspected.files.map(({ path, bytes, sha256 }) => ({ path, size: bytes.length, sha256 })) };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await mkdir(dirname(output), { recursive: true });
  const archive = zipFiles([...inspected.files, { path: 'PUBLIC-MANIFEST.json', bytes: manifestBytes }]);
  await writeFile(output, archive, { flag: 'wx' });
  return { archive: output, sha256: hash(archive), files: inspected.files.length, bytes: archive.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  if (args.some(arg => !['--history', '--export'].includes(arg))) throw new Error('Use --history for the separate Git audit, or --export for a standalone ZIP.');
  const inspected = await inspectPublicTree(root);
  const report = { scope: 'allowlisted working-tree source, excluding local state and Git history', files: inspected.files.length, findings: inspected.findings };
  if (args.includes('--history')) report.history = inspectHistory(root);
  console.log(JSON.stringify(report, null, 2));
  if (inspected.findings.length) process.exitCode = 1;
  else if (args.includes('--export')) console.log(JSON.stringify(await exportPublicTree(root, join(root, 'out', 'submission', `eventbrief-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`)), null, 2));
  if (report.history?.findings.length) process.exitCode = 1;
}
