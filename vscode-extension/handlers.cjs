'use strict';
const { bounded, isObject, MAX_TEXT, REQUEST_MS } = require('./connector.cjs');
const { workspace, resolvePath, fileForUri, readText, writeText, list, local, samePath, sameFile, MAX_FILE } = require('./workspace.cjs');
const { runTests } = require('./tasks.cjs');

const ARGUMENTS = new Map(Object.entries({
  read_file: ['path'], write_file: ['path', 'text'], list_files: ['path'], run_tests: [],
  get_active_file: [], get_diagnostics: ['path'], open_file: ['path'], get_git_status: [],
}));
function nativeUi(v) {
  return {
    async confirm(request) {
      const writing = request.command === 'write_file';
      const label = writing ? (request.replace ? 'Replace file' : 'Create file') : 'Run task';
      const detail = writing
        ? `${request.path}\n${request.replace ? 'Replace all existing content with' : 'Create a new file containing'} ${request.bytes} UTF-8 bytes.\n\nContent preview:\n${request.preview}`
        : `${request.task}\nThis executes the selected workspace task with your local permissions. Review its definition before approving.`;
      return await v.window.showWarningMessage(`Sentinel: ${label} in ${request.workspace}?`, { modal: true, detail }, label) === label;
    },
    async selectTestTask(tasks) {
      const picked = await v.window.showQuickPick(tasks.map(task => ({ label: task.name, description: task.source, task })), {
        title: 'Sentinel: Select a foreground Test task', placeHolder: 'Choose a task from this workspace folder', ignoreFocusOut: true,
      });
      return picked?.task;
    },
  };
}
function docFor(v, file) {
  return v.workspace.textDocuments.find(d => local(d.uri) && samePath(d.uri.fsPath, file.full));
}
function docText(v, doc) {
  const end = doc.positionAt(MAX_TEXT + 1);
  return doc.getText(new v.Range(new v.Position(0, 0), end));
}
function diagnostics(v, root, args) {
  const files = Object.hasOwn(args, 'path') ? (() => {
    const uri = v.Uri.file(resolvePath(root, args.path).full);
    return [[uri, v.languages.getDiagnostics(uri)]];
  })() : v.languages.getDiagnostics();
  const lines = [];
  let visited = 0;
  for (const [uri, messages] of files) {
    if (++visited > 512) { lines.push('[diagnostics truncated]'); break; }
    let rel;
    try { rel = fileForUri(root, uri).rel; } catch { continue; }
    for (const d of messages) {
      if (lines.length >= 100) return lines.join('\n') + '\n[diagnostics truncated]';
      lines.push(`${rel}:${d.range.start.line + 1}:${d.range.start.character + 1} ${v.DiagnosticSeverity[d.severity]}: ${d.message.slice(0, 500)}`);
    }
  }
  return lines.join('\n') || 'No workspace diagnostics.';
}

async function gitStatus(v, folder, root, check) {
  const extension = v.extensions.getExtension('vscode.git');
  if (!extension) throw new Error('The built-in VS Code Git extension is unavailable.');
  const git = await extension.activate();
  check();
  if (!git.enabled) throw new Error('Git is disabled in VS Code.');
  const api = git.getAPI(1);
  const repo = api.getRepository(folder.uri) || await api.openRepository?.(folder.uri);
  check();
  if (!repo || !local(repo.rootUri) || !samePath(repo.rootUri.fsPath, root)) {
    throw new Error('Open a workspace folder that is the root of a Git repository.');
  }
  await repo.status(); // read the refreshed index/worktree, not a cached guess
  check();
  const lines = [];
  const codes = ['modified', 'added', 'deleted', 'renamed', 'copied', 'modified', 'deleted', 'untracked', 'ignored', 'intent to add', 'intent to rename', 'type changed'];
  let count = 0, skipped = false;
  for (const [area, changes] of [['index', repo.state.indexChanges], ['worktree', repo.state.workingTreeChanges], ['conflict', repo.state.mergeChanges], ['untracked', repo.state.untrackedChanges]]) {
    for (const change of changes || []) {
      if (++count > 256) return lines.join('\n') + '\n[Git status truncated]';
      try {
        const path = require('node:path');
        if (!local(change.uri)) throw new Error();
        const file = resolvePath(root, path.relative(root, change.uri.fsPath), { allowNew: true });
        lines.push(`${area}: ${codes[change.status] || 'changed'} ${file.rel}`);
      } catch { skipped = true; }
    }
  }
  if (skipped) lines.push('[protected or unavailable paths omitted]');
  return lines.join('\n') || 'Working tree clean.';
}

// The only injected behavior in the handler factory is UI. The actual trust,
// filesystem, editor, task execution/events and Git APIs always come from VS Code.
function createHandlers({ confirm, selectTestTask } = {}) {
  const v = require('vscode');
  const native = nativeUi(v);
  // Native modal dialogs cannot be forcibly dismissed. Never stack a new
  // approval behind an expired/disconnected request's still-visible prompt.
  let promptOpen = false;
  const singlePrompt = fn => async value => {
    if (promptOpen) throw new Error('Dismiss the previous Sentinel prompt before retrying.');
    promptOpen = true;
    try { return await fn(value); } finally { promptOpen = false; }
  };
  const ui = { confirm: singlePrompt(confirm || native.confirm), selectTestTask: singlePrompt(selectTestTask || native.selectTestTask) };
  return async function dispatch(command, args, context = {}) {
    const allowed = ARGUMENTS.get(command);
    if (!allowed) throw new Error('Unsupported workspace command.');
    if (!isObject(args) || Object.keys(args).some(k => !allowed.includes(k))) throw new Error('Unexpected command arguments.');
    const deadline = Math.min(context.deadline ?? Infinity, Date.now() + REQUEST_MS);
    const controller = new AbortController();
    const abort = () => controller.abort(context.signal.reason || new Error('Request cancelled.'));
    const timer = setTimeout(() => controller.abort(new Error('Request timed out after 110 seconds.')), Math.max(0, deadline - Date.now()));
    context.signal?.addEventListener('abort', abort, { once: true });
    if (context.signal?.aborted) abort();
    try {
      const { root, folder, info } = workspace(v);
      const check = () => {
        if (controller.signal.aborted) throw controller.signal.reason;
        if (Date.now() >= deadline) throw new Error('Request timed out.');
        const current = workspace(v);
        if (!samePath(root, current.root) || !sameFile(info, current.info)) throw new Error('Workspace changed. Request cancelled.');
      };
      check();
      let text;
      switch (command) {
        case 'read_file': {
          const file = resolvePath(root, args.path);
          const disk = readText(file);
          const doc = docFor(v, file);
          text = doc?.isDirty && sameFile(fileForUri(root, doc.uri).info, file.info) ? docText(v, doc) : disk;
          if (text === '') text = `${file.rel} is empty.`;
          break;
        }
        case 'write_file': {
          const content = args.text;
          if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_FILE || content.includes('\0')) {
            throw new Error('Expected UTF-8 text content of at most 64 KiB.');
          }
          const bytes = Buffer.from(content, 'utf8');
          const original = resolvePath(root, args.path, { allowNew: true });
          if (original.info) readText(original); // never replace binary/oversized files
          const before = docFor(v, original), version = before?.version;
          const writable = () => {
            check();
            const doc = docFor(v, original);
            if (doc?.isDirty) throw new Error('File has unsaved editor changes. Save or discard them first.');
            if (before && (before !== doc || doc.version !== version)) throw new Error('Editor changed while awaiting approval. Retry.');
          };
          writable();
          const approve = await ui.confirm({ command, path: original.rel, workspace: folder.name, replace: !!original.info,
            bytes: bytes.length, preview: content.slice(0, 400) + (content.length > 400 ? '…' : '') });
          if (approve !== true) throw new Error('Write cancelled. No file was written.');
          writeText(root, original, bytes, writable);
          text = `Wrote ${bytes.length} bytes to ${original.rel}.`;
          break;
        }
        case 'list_files': text = list(root, Object.hasOwn(args, 'path') ? args.path : '.'); break;
        case 'run_tests': text = await runTests(v, folder, ui, check, controller.signal); break;
        case 'get_active_file': {
          const doc = v.window.activeTextEditor?.document;
          if (!doc) throw new Error('There is no active file editor.');
          const file = fileForUri(root, doc.uri);
          text = `${file.rel}\n${docText(v, doc)}`;
          break;
        }
        case 'get_diagnostics': text = diagnostics(v, root, args); break;
        case 'open_file': {
          const file = resolvePath(root, args.path);
          readText(file);
          const doc = await v.workspace.openTextDocument(v.Uri.file(file.full));
          check();
          if (!sameFile(fileForUri(root, doc.uri).info, file.info)) throw new Error('File changed while opening.');
          await v.window.showTextDocument(doc, { preview: true });
          text = `Opened ${file.rel}.`;
          break;
        }
        case 'get_git_status': text = await gitStatus(v, folder, root, check); break;
      }
      check();
      return bounded(text);
    } catch (error) {
      // Native filesystem exceptions can contain absolute paths. Return the code,
      // never the path, stack, secret or an unbounded dump of the request.
      if (error?.syscall && error?.code) throw new Error(`Workspace file operation failed (${error.code}).`);
      throw error;
    } finally {
      clearTimeout(timer);
      context.signal?.removeEventListener('abort', abort);
    }
  };
}
module.exports = { createHandlers };
