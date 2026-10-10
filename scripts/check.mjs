import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { createTools } from '../src/tools.js';
import { defineTool, assertSupportedJsonSchema } from '@deepseek-ai/dsh-tools';
import plugin from '../src/index.js';

async function check(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    if (item.isDirectory()) await check(path);
    else if (/\.(mjs|js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    }
  }
}
for (const dir of ['src', 'scripts', 'tests', 'vendor']) await check(dir);
const tools = createTools({}, defineTool, () => ({}));
for (const tool of tools) { assertSupportedJsonSchema(tool.parameters); assertSupportedJsonSchema(tool.output.schema); }
const manifest = JSON.parse(await readFile('native/macos/manifest.json', 'utf8'));
const hash = createHash('sha256').update(await readFile(`native/macos/${manifest.binary.path}`)).digest('hex');
if (hash !== manifest.binary.sha256) throw new Error('macOS binary differs from pinned upstream manifest');
const sourceDir = 'native/macos/Sources/Helper';
const sourceHash = createHash('sha256');
for (const name of (await readdir(sourceDir)).filter(name => name.endsWith('.swift')).sort()) {
  sourceHash.update(name); sourceHash.update('\0'); sourceHash.update(await readFile(`${sourceDir}/${name}`)); sourceHash.update('\0');
}
if (sourceHash.digest('hex') !== manifest.sourceSha256) throw new Error('macOS source differs from pinned upstream manifest');
const patch = parse(await readFile('cordis.patch.yml', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (patch[0].insert[0].name !== pkg.name) throw new Error('Bundle identity mismatch');
if (plugin.name !== 'dsh-computer-use-fusion') throw new Error('Plugin identity mismatch');
console.log(`Syntax, ${tools.length} DSH schemas, bundle identity and macOS SHA-256 OK.`);
