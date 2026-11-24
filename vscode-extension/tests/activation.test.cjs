'use strict';
// Standalone Node test. Launch the *production* activation path unchanged:
// no fake connector/dispatch, code commands, timers, filesystem, or test port.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID, createHmac } = require('node:crypto');
const { EventEmitter, once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { WebSocketServer } = require('ws');
const { activate } = require('../extension.cjs');

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const on = (emitter, name, fn) => {
  emitter.on(name, fn);
  return { dispose: () => emitter.off(name, fn) };
};
const message = socket => once(socket, 'message', { signal: AbortSignal.timeout(4000) }).then(([data]) => JSON.parse(data.toString()));
const connected = peer => once(peer, 'connection', { signal: AbortSignal.timeout(5000) }).then(([socket]) => socket);
const closed = socket => once(socket, 'close', { signal: AbortSignal.timeout(4000) });
const send = (socket, value) => socket.send(JSON.stringify(value));
const request = (socket, command, args) => {
  const id = randomUUID();
  send(socket, { type: 'request', id, command, args });
  return id;
};
async function challenge(socket, key) {
  const nonce = randomBytes(32).toString('hex');
  const received = message(socket);
  send(socket, { type: 'challenge', nonce });
  const auth = await received;
  assert.equal(auth.type, 'authenticate');
  assert.match(auth.nonce, /^[a-f0-9]{64}$/);
  assert.notEqual(auth.nonce, nonce);
  const sign = side => createHmac('sha256', key).update(`${side}:${nonce}:${auth.nonce}`).digest('hex');
  assert.equal(auth.proof, sign('client'));
  return { clientNonce: auth.nonce, proof: sign('server') };
}

function fakeHost(getSecret) {
  const commands = new Map(), saved = new Map();
  const events = new EventEmitter();
  const dialogs = { confirm: () => { throw new Error('Unexpected confirmation.'); }, count: 0 };
  const host = {
    UIKind: { Desktop: 1 }, env: { uiKind: 1, remoteName: undefined },
    StatusBarAlignment: { Left: 1 },
    workspace: {
      isTrusted: true, workspaceFolders: [], textDocuments: [],
      onDidChangeWorkspaceFolders: fn => on(events, 'folder', fn),
      onDidGrantWorkspaceTrust: fn => on(events, 'trust', fn),
    },
    commands: { registerCommand(id, fn) {
      assert.ok(!commands.has(id)); commands.set(id, fn);
      return { dispose: () => commands.delete(id) };
    } },
    window: {
      createStatusBarItem: () => ({ show() {}, hide() {}, dispose() {} }),
      showInformationMessage: async value => value,
      showErrorMessage: async () => assert.fail('Unexpected VS Code error dialog.'),
      async showInputBox(options) {
        assert.equal(options.password, true);
        assert.ok(options.validateInput('F'.repeat(64)));
        assert.ok(options.validateInput('1'.repeat(63)));
        const value = getSecret();
        assert.equal(options.validateInput(value), undefined);
        return value;
      },
      async showWarningMessage(...args) { dialogs.count++; return dialogs.confirm(...args); },
    },
  };
  const secrets = {
    get: async k => saved.get(k),
    async store(k, value) { saved.set(k, value); events.emit('secret', { key: k }); },
    async delete(k) { saved.delete(k); events.emit('secret', { key: k }); },
    onDidChange: fn => on(events, 'secret', fn),
  };
  const load = dir => {
    host.workspace.workspaceFolders = [{ name: path.basename(dir), uri: { scheme: 'file', fsPath: dir, authority: '' } }];
    const context = { subscriptions: [], secrets };
    const original = Module._load;
    try {
      Module._load = function(id, ...args) { return id === 'vscode' ? host : original.call(this, id, ...args); };
      activate(context);
    } finally { Module._load = original; }
    return { dispose() { for (const d of context.subscriptions.splice(0).reverse()) d.dispose(); } };
  };
  return { saved, dialogs, load, command: name => commands.get(`workspaceBridge.${name}`)() };
}

test('production activation: pair, authenticate, revoke approval, scoped reload, reject stale proof, retry, unpair', { timeout: 20000 }, async t => {
  const peer = new WebSocketServer({ host: '127.0.0.1', port: 9876, maxPayload: 128 * 1024, perMessageDeflate: false });
  try { await once(peer, 'listening'); } catch (error) {
    if (error.code === 'EADDRINUSE') return t.skip('Port 9876 is occupied; existing Sentinel Desktop was not contacted.');
    throw error;
  }
  const temp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-activation-')));
  const a = path.join(temp, 'a'), b = path.join(temp, 'b');
  let active;
  t.after(async () => {
    active?.dispose();
    for (const ws of peer.clients) ws.terminate();
    await new Promise(r => peer.close(r));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  fs.mkdirSync(a); fs.mkdirSync(b);
  fs.writeFileSync(path.join(a, 'marker.txt'), 'local source');
  const key = randomBytes(32), host = fakeHost(() => key.toString('hex'));
  active = host.load(a);
  await tick();
  assert.match(await host.command('status'), /not paired/i);
  const paired = connected(peer);
  await host.command('pair');
  const first = await paired;
  assert.equal(host.saved.size, 1);
  assert.ok([...host.saved.values()][0] === key.toString('hex'), 'SecretStorage must contain the entered secret');
  const original = await challenge(first, key);
  send(first, { type: 'ready', proof: original.proof });
  const read = message(first);
  const id = request(first, 'read_file', { path: 'marker.txt' });
  assert.deepEqual(await read, { type: 'result', id, ok: true, text: 'local source' });

  const shown = deferred(), answer = deferred();
  host.dialogs.confirm = (msg, options, button) => { assert.equal(options.modal, true); shown.resolve(button); return answer.promise; };
  request(first, 'write_file', { path: 'stale.txt', text: 'must not write' });
  const button = await shown.promise;
  const unloaded = closed(first);
  active.dispose(); // VS Code unloads the window while its native confirmation is outstanding
  await unloaded;
  answer.resolve(button);
  await tick();
  assert.ok(!fs.existsSync(path.join(a, 'stale.txt')));

  active = host.load(b); // SAME extension SecretStorage, different trusted folder
  await tick();
  assert.match(await host.command('status'), /not paired/i);
  assert.equal(peer.clients.size, 0);
  active.dispose();
  const reload = connected(peer);
  active = host.load(a); // no pair command: the stored value must be used automatically
  const second = await reload;
  const next = await challenge(second, key);
  assert.notEqual(next.clientNonce, original.clientNonce);
  assert.notEqual(next.proof, original.proof);
  const invalid = closed(second), retry = connected(peer);
  const leaked = [];
  second.on('message', data => leaked.push(JSON.parse(data.toString()).type));
  host.dialogs.confirm = (_msg, _options, button) => button; // an auth bug would visibly write
  send(second, { type: 'ready', proof: original.proof }); // valid only for the OLD pair of nonces
  request(second, 'write_file', { path: 'unauthorized.txt', text: 'never' });
  await invalid;
  assert.deepEqual(leaked, []);
  assert.equal(host.dialogs.count, 1, 'no dispatch or approval on stale proof');
  assert.ok(!fs.existsSync(path.join(a, 'unauthorized.txt')));

  const third = await retry, fresh = await challenge(third, key);
  send(third, { type: 'ready', proof: fresh.proof });
  const listing = message(third);
  request(third, 'list_files', {});
  assert.match((await listing).text, /marker\.txt/);
  assert.match(await host.command('status'), /: Connected$/);
  const revoked = closed(third);
  await host.command('unpair');
  await revoked;
  assert.equal(host.saved.size, 0);
  assert.match(await host.command('status'), /not paired/i);
  active.dispose();
  active = host.load(a);
  await tick();
  assert.match(await host.command('status'), /not paired/i);
  assert.equal(peer.clients.size, 0);
});
