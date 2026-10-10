import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'dist');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (!process.env.npm_execpath) throw new Error('Run npm run package from the repository checkout.');
await mkdir(output, { recursive: true });
const packed = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--pack-destination', output],
  { cwd: root, encoding: 'utf8', windowsHide: true });
if (packed.status !== 0) {
  process.stderr.write(packed.stderr || packed.stdout || String(packed.error));
  process.exit(packed.status || 1);
}
// npm can forward prepack output before its JSON report.
const jsonStart = packed.stdout.search(/^\[\s*\{\s*"id"\s*:/m);
if (jsonStart < 0) throw new Error('npm pack did not return a package report.');
const [archive] = JSON.parse(packed.stdout.slice(jsonStart));
const files = new Set(archive.files.map(file => file.path));
for (const required of ['package.json', 'cordis.patch.yml', 'src/index.js', 'src/repl.js', 'src/repl-worker.js',
  'native/windows/windows-uia.ps1', 'native/macos/bin/dsh-computer-use-helper', 'native/macos/manifest.json',
  'skills/computer-use-fusion.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  if (!files.has(required)) throw new Error(`Installable package is missing ${required}`);
}
if ([...files].some(file => /(^|\/)(node_modules|upstream|\.compat|\.artifacts|\.git)(\/|$)/.test(file))) {
  throw new Error('Development or private files found in the installable package.');
}
const checksum = createHash('sha256').update(await readFile(join(output, archive.filename))).digest('hex');
await writeFile(join(output, 'SHA256SUMS'), `${checksum}  ${archive.filename}\n`);
const url = `https://github.com/cqupi/dsh-computer-use-fusion/releases/download/v${pkg.version}/${archive.filename}`;
await writeFile(join(output, 'INSTALL.zh-CN.md'), `# DSH Computer Use Fusion ${pkg.version}\n\n` +
  `安装文件：\`${archive.filename}\`。这是 DSH 可直接安装的插件包，保留 .tgz 格式，无需解压或编译。\n\n` +
  `## DSH 桌面版\n\n打开「插件」→「添加插件」，填入下面的下载链接，完成安装后点击「立即启用」：\n\n${url}\n\n` +
  `也可以填入下载后的 .tgz 文件绝对路径，例如：\n\n` +
  `\`Z:\\vibeproject\\dsh-computer-use-fusion\\dist\\${archive.filename}\`\n\n` +
  `如果列表中已有旧版，请先卸载插件再安装此包。\n\n` +
  `## DSH CLI\n\nWeb profile：\n\n\`\`\`powershell\n` +
  `dsh plugin --profile web add "${url}"\n\`\`\`\n\n` +
  `Headless profile 将 web 改为 headless；本地安装将下载链接替换为 .tgz 的绝对路径。\n\n` +
  `## 安装之后\n\n重启 DSH，在新会话加载 /dsh-computer-use-fusion，让模型使用 fusion_computer。\n\n` +
  `需要 Node.js 22.19+ 或 24+ 和兼容 DSH。包内包含原生 Windows 后端、macOS 14+ universal helper、持久 JavaScript 入口、技能及 bundle patch。\n` +
  `安装器会下载 package.json 声明的运行依赖；无需 Git checkout、Swift 编译器或 npm 构建。\n\n` +
  `SHA-256：\`${checksum}\`\n`, 'utf8');
console.log(JSON.stringify({ version: pkg.version, filename: archive.filename, bytes: archive.size,
  sha256: checksum, directory: output }, null, 2));
