// Launch the installed VS Code executable as an isolated Extension Development Host.
// Never install into, enable extensions in, or change settings in a user's own profile.
import { spawn, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const extension = fileURLToPath(new URL('../', import.meta.url))
const code = [process.env.VSCODE_EXECUTABLE_PATH,
  path.join(process.env.LOCALAPPDATA || '', 'Programs/Microsoft VS Code/Code.exe'),
  path.join(process.env.ProgramFiles || '', 'Microsoft VS Code/Code.exe'),
  '/Applications/Visual Studio Code.app/Contents/MacOS/Electron', '/usr/share/code/code',
].find(p => p && existsSync(p))
if (!code) throw new Error('Set VSCODE_EXECUTABLE_PATH to the VS Code executable (not the code CLI script).')
const root = await mkdtemp(path.join(tmpdir(), 'sentinel-ide-test-'))
const workspace = path.join(root, 'workspace')
try {
  await mkdir(path.join(workspace, '.vscode'), { recursive: true })
  // Disable third-party extensions and profile sync. The built-in Git extension
  // and the real process task provider are left on purpose.
  await mkdir(path.join(root, 'profile', 'User'), { recursive: true })
  await writeFile(path.join(root, 'profile', 'User', 'settings.json'), JSON.stringify({
    'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'extensions.autoUpdate': false,
    'git.autofetch': false, 'git.openRepositoryInParentFolders': 'never', 'workbench.startupEditor': 'none',
    'chat.disableAIFeatures': true,
  }))
  execFileSync('git', ['init', '--quiet'], { cwd: workspace })
  await writeFile(path.join(workspace, 'sample.txt'), 'SENTINEL_FIXTURE: initial file on disk\n')
  await writeFile(path.join(workspace, 'test.cjs'), "require('node:fs').writeFileSync('test-ran.txt','real task');process.exit(Number(process.argv[2]))\n")
  await writeFile(path.join(workspace, '.vscode/tasks.json'), JSON.stringify({ version: '2.0.0', tasks:
    [0, 3].map(code => ({ label: `fixture exit ${code}`, type: 'process', group: 'test', command: process.execPath,
      args: ['test.cjs', String(code)], options: { cwd: '${workspaceFolder}' }, problemMatcher: [] }))
  }))
  const report = path.join(root, 'report.json')
  const env = { ...process.env, SENTINEL_HOST_REPORT: report, SENTINEL_TEST_NODE: process.execPath,
    SENTINEL_ELECTRON_PROFILE: process.argv.includes('--electron') ? path.join(root, 'electron-profile') : '' }
  delete env.ELECTRON_RUN_AS_NODE
  const profileArgs = [`--user-data-dir=${path.join(root, 'profile')}`, `--extensions-dir=${path.join(root, 'extensions')}`]
  const full = process.argv.includes('--electron')
  let devExtension = extension
  if (full) {
    // Install the *VSIX* rather than using our source tree/node_modules. VS Code
    // still needs a development extension to launch its test host, so supply an
    // empty driver with a different ID. Never install into a real profile.
    const archive = path.join(extension, 'workspace-bridge.vsix')
    if (!existsSync(archive)) throw new Error('Build the extension with npm run package:vsix first.')
    const dir = path.dirname(code)
    const bases = [dir, path.join(dir, '..'), ...(await readdir(dir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && /^[a-f0-9]{8,40}$/.test(entry.name)).map(entry => path.join(dir, entry.name))]
    const cli = bases.flatMap(base => ['resources/app/out/cli.js', 'Resources/app/out/cli.js'].map(p => path.join(base, p))).find(existsSync)
    if (!cli) throw new Error('Cannot locate the VS Code CLI next to the executable')
    execFileSync(code, [cli, ...profileArgs, '--install-extension', archive], {
      stdio: 'inherit', timeout: 60_000, env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    })
    devExtension = path.join(root, 'driver')
    await mkdir(devExtension)
    await writeFile(path.join(devExtension, 'package.json'), JSON.stringify({ name: 'sentinel-host-driver', version: '0.0.1',
      publisher: 'test', engines: { vscode: '^1.90.0' }, main: './index.cjs' }))
    await writeFile(path.join(devExtension, 'index.cjs'), 'exports.activate = () => {}')
  }
  const proc = spawn(code, [workspace, `--extensionDevelopmentPath=${path.resolve(devExtension)}`,
    `--extensionTestsPath=${path.join(extension, 'tests', 'host.cjs')}`, ...profileArgs,
    ...(!full ? ['--disable-extensions'] : []), '--disable-workspace-trust', '--disable-updates',
    '--disable-gpu', '--skip-welcome', '--skip-release-notes', '--new-window', '--log', 'error',
  ], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  // VS Code logs from unrelated built-in extensions can swamp the actual
  // assertions. Keep a bounded tail for failures and print the report on success.
  let tail = ''
  for (const pipe of [proc.stdout, proc.stderr]) pipe.on('data', chunk => { tail = (tail + chunk).slice(-8000) })
  const timer = setTimeout(() => proc.kill(), 180_000)
  try {
    const status = await new Promise((resolve, reject) => { proc.on('error', reject); proc.on('exit', resolve) })
    if (status !== 0) throw new Error(`VS Code extension host failed (exit ${status})\n${tail}`)
    // VS Code can exit without having run the suite; don't report that as success.
    const result = JSON.parse(await readFile(report, 'utf8'))
    if (result.pass !== true) throw new Error('Extension host did not complete the checks')
    console.log(JSON.stringify(result, null, 2))
  } finally { clearTimeout(timer) }
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 })
}
