// Runs inside the real VS Code extension host (--extensionTestsPath). Only the
// human responses to VS Code prompts are scripted; command execution is not.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { spawn } = require('node:child_process')
const path = require('node:path')
const vscode = require('vscode')

// Drive the exact request() implementation used by Electron IPC in a separate
// Node process. Pairing material travels over its private OS pipe, not argv.
async function desktopPeer(restart = false) {
  const full = !!process.env.SENTINEL_ELECTRON_PROFILE
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.VITE_DEV_SERVER_URL
  // Electron patches fork() to force ELECTRON_RUN_AS_NODE. Use spawn with an
  // explicit IPC pipe so the full-app peer really starts Electron, not Node.
  const executable = full ? require('../../desktop/node_modules/electron') : process.env.SENTINEL_TEST_NODE
  const proc = spawn(executable, [path.join(__dirname, full ? 'electron-peer.cjs' : 'desktop-peer.mjs'), ...(restart ? ['--resume-fixture'] : [])], {
    env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  let log = ''
  for (const pipe of [proc.stdout, proc.stderr]) pipe.on('data', chunk => { log = (log + chunk).slice(-3000) })
  let serial = 0
  const pending = new Map()
  const boot = new Promise((resolve, reject) => {
    proc.once('message', resolve)
    proc.once('error', reject)
    proc.once('exit', code => {
      const error = new Error(`Desktop test peer exited (${code}): ${log}`)
      reject(error)
      for (const [_, entry] of pending) entry.reject(error)
      pending.clear()
    })
  })
  proc.on('message', m => {
    if (pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id) }
  })
  const { port, secret } = await boot
  const exited = new Promise(resolve => proc.once('exit', resolve))
  return { port, secret, close() { if (proc.connected) proc.disconnect(); return exited }, request(command, args = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial
      pending.set(id, { resolve, reject })
      proc.send({ id, command, args }, err => { if (err) { pending.delete(id); reject(err) } })
    })
  } }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, timeout = 15000) {
  const end = Date.now() + timeout
  while (!(await check())) {
    if (Date.now() > end) throw new Error('Timed out waiting for VS Code')
    await wait(100)
  }
}

async function connectForHostTest(peer, approve, taskName) {
  const extension = vscode.extensions.getExtension('local-workspace.workspace-bridge')
  assert.ok(extension, 'VS Code did not load the bridge extension')
  const { createConnector, createHandlers } = await extension.activate()
  const registered = await vscode.commands.getCommands()
  for (const name of ['pair', 'unpair', 'retry', 'status']) assert.ok(registered.includes(`workspaceBridge.${name}`))
  const dispatch = createHandlers({ confirm: () => approve(), selectTestTask: tasks => tasks.find(t => t.name === taskName()) })
  const connector = createConnector({ port: peer.port, secret: peer.secret, dispatch })
  connector.start()
  try {
    await until(() => connector.status === 'Connected')
    return connector
  } catch (e) { connector.dispose(); throw e }
}

exports.run = async () => {
  const workspace = vscode.workspace.workspaceFolders[0].uri.fsPath
  const sample = vscode.Uri.file(path.join(workspace, 'sample.txt'))
  const collection = vscode.languages.createDiagnosticCollection('sentinel-test')
  let peer = await desktopPeer()
  let connection
  const results = []
  const check = async (command, args, expectOk, contains) => {
    const r = await peer.request(command, args)
    assert.equal(r.ok, expectOk, `${command}: ${r.text}`)
    if (contains) assert.match(r.text, contains, command)
    results.push({ command, ...r })
    return r
  }
  try {
    await check('list_files', {}, false, /offline|disconnected|not connected/i)
    // Set up actual editor state, including an unsaved change that a raw fs
    // read (or a mock active editor) cannot see.
    const doc = await vscode.workspace.openTextDocument(sample)
    await vscode.window.showTextDocument(doc)
    const edit = new vscode.WorkspaceEdit()
    edit.insert(sample, new vscode.Position(0, 0), 'UNSAVED BUFFER\n')
    assert.ok(await vscode.workspace.applyEdit(edit))
    collection.set(sample, [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'unique fixture diagnostic', vscode.DiagnosticSeverity.Warning)])
    let approve = true
    let taskName = 'fixture exit 0'
    connection = await connectForHostTest(peer, () => approve, () => taskName)
    await until(async () => (await peer.request('get_active_file')).ok)
    await check('get_active_file', {}, true, /UNSAVED BUFFER/)
    await check('get_diagnostics', {}, true, /unique fixture diagnostic/)
    await check('list_files', {}, true, /sample\.txt/)
    approve = false
    await check('write_file', { path: 'voice.txt', text: 'should not exist' }, false)
    await assert.rejects(fs.stat(path.join(workspace, 'voice.txt')), { code: 'ENOENT' })
    approve = true
    const text = 'written via authenticated WebSocket\nsecond line ✓'
    await check('write_file', { path: 'voice.txt', text }, true)
    assert.equal(await fs.readFile(path.join(workspace, 'voice.txt'), 'utf8'), text)
    await check('read_file', { path: 'voice.txt' }, true, /second line ✓/)
    await check('open_file', { path: 'voice.txt' }, true)
    assert.equal(vscode.window.activeTextEditor.document.uri.fsPath, path.join(workspace, 'voice.txt'))
    // Git discovery/refresh is asynchronous in VS Code.
    await until(async () => (await peer.request('get_git_status')).text.includes('voice.txt'))
    await check('get_git_status', {}, true, /voice\.txt/)
    await check('write_file', { path: 'voice.txt', text: '' }, true, /0 bytes/)
    assert.equal(await fs.readFile(path.join(workspace, 'voice.txt'), 'utf8'), '')
    await check('read_file', { path: 'voice.txt' }, true, /voice\.txt is empty/)
    await check('write_file', { path: 'sample.txt', text: 'do not overwrite my buffer' }, false, /unsaved/)
    await check('read_file', { path: '../outside' }, false)
    await check('write_file', { path: '.git/config', text: 'no' }, false)
    approve = false
    await check('run_tests', {}, false)
    await assert.rejects(fs.stat(path.join(workspace, 'test-ran.txt')), { code: 'ENOENT' })
    approve = true
    await check('run_tests', {}, true, /0|passed|success/i)
    assert.equal(await fs.readFile(path.join(workspace, 'test-ran.txt'), 'utf8'), 'real task')
    taskName = 'fixture exit 3'
    await check('run_tests', {}, false, /3/)
    if (process.env.SENTINEL_ELECTRON_PROFILE) {
      // Restart the real app against the same isolated encrypted profile. No
      // second pair command: main must start its listener and VS Code reconnect.
      assert.equal(await peer.close(), 0)
      peer = await desktopPeer(true)
      await until(async () => (await peer.request('list_files')).ok)
      await check('list_files', {}, true, /voice\.txt/)
      await check('$revoke', {}, true, /disabled/i)
      await check('list_files', {}, false, /disabled|offline/i)
    }
    await fs.writeFile(process.env.SENTINEL_HOST_REPORT, JSON.stringify({ pass: true, vscode: vscode.version, results }))
  } finally {
    connection?.dispose()
    collection.dispose()
    await peer.close()
  }
}
