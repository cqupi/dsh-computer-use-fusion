// Derived from Anionex's MIT build-native.mjs; helper-only rebuild.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'darwin') throw new Error('Build the Swift helper on macOS with Xcode Command Line Tools.');
const root = fileURLToPath(new URL('../native/macos/', import.meta.url));
const source = join(root, 'Sources', 'Helper');
const output = join(root, 'bin', 'dsh-computer-use-helper');
const build = join(root, 'build');
const names = (await readdir(source)).filter(name => name.endsWith('.swift')).sort();
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', timeout: 300000 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.status}`);
};
await mkdir(build, { recursive: true });
const binaries = [];
for (const arch of ['arm64', 'x86_64']) {
  const binary = join(build, `helper-${arch}`); binaries.push(binary);
  run('xcrun', ['swiftc', '-swift-version', '5', '-parse-as-library', '-O', '-target', `${arch}-apple-macos14.0`,
    ...['AppKit', 'ApplicationServices', 'CoreGraphics', 'QuartzCore', 'ScreenCaptureKit'].flatMap(f => ['-framework', f]),
    '-lproc', ...names.map(name => join(source, name)), '-o', binary]);
}
run('xcrun', ['lipo', '-create', ...binaries, '-output', output]);
await chmod(output, 0o755);
run('codesign', ['--force', '--sign', '-', '--timestamp=none', output]);
const hash = createHash('sha256');
for (const name of names) { hash.update(name); hash.update('\0'); hash.update(await readFile(join(source, name))); hash.update('\0'); }
manifest.sourceSha256 = hash.digest('hex');
manifest.binary.sha256 = createHash('sha256').update(await readFile(output)).digest('hex');
await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Rebuilt helper ${manifest.helperVersion}; review the new integrity manifest before release.`);
