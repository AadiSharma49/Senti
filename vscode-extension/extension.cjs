'use strict';
const { createHash } = require('node:crypto');
const { createConnector, isHex } = require('./connector.cjs');
const { createHandlers } = require('./handlers.cjs');
const { workspace } = require('./workspace.cjs');

function activate(context) {
  const v = require('vscode');
  const dispatch = createHandlers();
  const bar = v.window.createStatusBarItem(v.StatusBarAlignment.Left, 5);
  bar.name = 'Sentinel Workspace Bridge';
  bar.command = 'workspaceBridge.status';
  const prefix = 'sentinel.bridge.v1.';
  // SecretStorage is extension-wide; namespace by canonical local folder so
  // pairing one project does not silently authorize other trusted windows.
  const secretKey = () => prefix + createHash('sha256').update(workspace(v).root).digest('hex');
  let connector, status, key, generation = 0, interaction = 0, editing = 0, disposed = false;
  let mutations = Promise.resolve();
  const setStatus = (value, visible = false) => {
    status = value;
    if (disposed) return;
    bar.text = value === 'Connected' ? '$(plug) Sentinel' : '$(debug-disconnect) Sentinel';
    bar.tooltip = `Sentinel Workspace Bridge: ${value}`;
    if (visible) bar.show(); else bar.hide();
  };
  const stop = () => {
    generation++;
    connector?.dispose();
    connector = undefined;
  };
  async function refresh() {
    stop();
    if (disposed) return;
    if (editing) return setStatus('Updating pairing');
    const mine = generation;
    try { key = secretKey(); }
    catch { key = undefined; return setStatus('Unavailable: open exactly one trusted local folder.'); }
    setStatus('Checking pairing');
    try {
      const secret = await context.secrets.get(key);
      if (disposed || mine !== generation) return;
      if (!secret) return setStatus('Not paired in this folder. Use Sentinel: Pair Workspace Bridge.');
      if (!isHex(secret)) return setStatus('Invalid stored pairing. Unpair and pair again.', true);
      connector = createConnector({ port: 9876, secret, dispatch, onStatus: value => {
        if (mine === generation) setStatus(value, true);
      } });
      connector.start();
    } catch {
      if (mine === generation) setStatus('Unable to load pairing or start the bridge. Retry in VS Code.');
    }
  }
  async function change(enterKey) {
    const mine = ++interaction;
    let target;
    try { target = secretKey(); } catch { return v.window.showErrorMessage('Open one trusted local workspace folder first.'); }
    let secret;
    if (enterKey) {
      secret = await v.window.showInputBox({
        title: 'Pair Sentinel with this workspace folder', prompt: 'Enter the 64-character pairing secret shown by Sentinel Desktop.',
        password: true, ignoreFocusOut: true,
        validateInput: value => isHex(value) ? undefined : 'Expected exactly 64 lowercase hexadecimal characters.',
      });
      if (!isHex(secret)) return;
    }
    if (disposed || mine !== interaction) return;
    stop();
    editing++;
    // Serialize store/delete. A late password dialog cannot undo an unpair,
    // and a late SecretStorage read cannot revive a revoked connector.
    const operation = mutations.then(async () => {
      if (disposed || mine !== interaction || target !== secretKey()) return;
      if (enterKey) await context.secrets.store(target, secret);
      else await context.secrets.delete(target);
    });
    mutations = operation.catch(() => {});
    try { await operation; }
    catch {
      stop();
      setStatus('Pairing store unavailable. Bridge stopped.');
      void v.window.showErrorMessage('Could not update VS Code SecretStorage. Check your system keychain, then retry.');
      return;
    } finally { editing--; }
    if (!editing && !disposed) await refresh();
  }
  const changedWorkspace = () => { interaction++; void refresh(); };
  const register = (name, fn) => v.commands.registerCommand('workspaceBridge.' + name, fn);
  context.subscriptions.push(bar,
    register('pair', () => change(true)), register('unpair', () => change(false)), register('retry', refresh),
    register('status', () => v.window.showInformationMessage(`Sentinel Workspace Bridge: ${status}`)),
    v.workspace.onDidChangeWorkspaceFolders(changedWorkspace), v.workspace.onDidGrantWorkspaceTrust(changedWorkspace),
    context.secrets.onDidChange(event => { if (event.key === key) void refresh(); }),
    { dispose() { disposed = true; interaction++; stop(); } });
  void refresh();
  return { createConnector, createHandlers };
}
module.exports = { activate, createConnector, createHandlers };
