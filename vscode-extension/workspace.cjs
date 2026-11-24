'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const MAX_FILE = 64 * 1024;
const statOptions = { bigint: true };
const noFollow = fs.constants.O_NOFOLLOW || 0;
const samePath = (a, b) => path.relative(a, b) === '';
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
const unchanged = (a, b) => sameFile(a, b) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
const local = uri => uri && uri.scheme === 'file' && !uri.authority && !/^(?:\\\\|\/\/)/.test(uri.fsPath);

function workspace(v) {
  const folders = v.workspace.workspaceFolders;
  if (v.env.uiKind !== v.UIKind.Desktop || v.env.remoteName || !v.workspace.isTrusted || folders?.length !== 1 ||
      !local(folders[0].uri) || (v.workspace.workspaceFile && !local(v.workspace.workspaceFile))) {
    throw new Error('Open exactly one trusted local folder in desktop VS Code.');
  }
  const root = path.resolve(folders[0].uri.fsPath);
  const info = fs.lstatSync(root, statOptions);
  if (!info.isDirectory() || !samePath(fs.realpathSync.native(root), root) ||
      root.split(path.sep).some(isGit)) throw new Error('The workspace must be a real directory outside .git, not a link.');
  return { root, info, folder: folders[0] };
}

function isGit(name) {
  // Ignore Unicode format controls used by some filesystems in name comparison.
  return /^\.git[ .]*$/i.test(name.normalize('NFKC').replace(/\p{Cf}/gu, ''));
}
function safePart(name) {
  return !!name && !isGit(name) && name !== '.' && name !== '..' && name.length <= 255 &&
    !/[<>:"|?*\x00-\x1f\x7f]/.test(name) && !/[ .]$/.test(name) && !/~\d+(?:\.|$)/.test(name) &&
    !/^(?:aux|prn|nul|con|conin\$|conout\$|(?:com|lpt)[0-9¹²³])(?:\.|$)/i.test(name);
}
function resolvePath(root, input, { directory = false, allowNew = false } = {}) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Expected a workspace-relative path.');
  const raw = input.split(/[\\/]/);
  if (directory && raw.at(-1) === '') raw.pop();
  const parts = raw.filter(part => part !== '.');
  if (directory && !parts.length) return { full: root, rel: '.', info: fs.lstatSync(root, statOptions) };
  if (!parts.length || parts.length > 64 || !parts.every(safePart)) throw new Error('Unsafe workspace path (absolute, traversal, protected or invalid name).');
  let full = root, info;
  for (let i = 0; i < parts.length; i++) {
    full = path.join(full, parts[i]);
    try { info = fs.lstatSync(full, statOptions); } catch (error) {
      if (allowNew && i === parts.length - 1 && error.code === 'ENOENT') { info = undefined; break; }
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error('Symbolic links and junctions are not allowed.');
    if (i < parts.length - 1 && !info.isDirectory()) throw new Error('Parent is not a directory.');
  }
  const exists = info ? full : path.dirname(full);
  if (!samePath(fs.realpathSync.native(exists), exists)) throw new Error('Path resolves through a link or alias.');
  if (info && (directory ? !info.isDirectory() : !info.isFile() || info.nlink !== 1n)) {
    throw new Error(directory ? 'Not a directory.' : 'Not a regular, single-link file.');
  }
  return { full, rel: parts.join('/'), info };
}

function fileForUri(root, uri) {
  if (!local(uri)) throw new Error('Not a local workspace file.');
  const file = resolvePath(root, path.relative(root, uri.fsPath));
  // Relative strings from outside the root (including a different Windows drive)
  // never pass resolvePath. Also insist on the actual editor URI, not a decoded alias.
  // path.relative() folds case on Windows even on case-sensitive directories.
  // Verify identity too: a differently-cased sibling tree is not this workspace.
  if (!samePath(file.full, uri.fsPath) || !sameFile(file.info, fs.lstatSync(uri.fsPath, statOptions))) {
    throw new Error('File is outside the workspace.');
  }
  return file;
}
function readText(file) {
  const fd = fs.openSync(file.full, fs.constants.O_RDONLY | noFollow | (fs.constants.O_NONBLOCK || 0));
  try {
    const info = fs.fstatSync(fd, statOptions);
    if (!unchanged(info, file.info) || info.nlink !== 1n) throw new Error('File changed. Retry.');
    if (info.size > BigInt(MAX_FILE)) throw new Error('File exceeds the 64 KiB limit.');
    const bytes = Buffer.alloc(Number(info.size));
    let n = 0;
    while (n < bytes.length) {
      const count = fs.readSync(fd, bytes, n, bytes.length - n, n);
      if (count === 0) throw new Error('File changed. Retry.');
      n += count;
    }
    if (!unchanged(fs.fstatSync(fd, statOptions), info)) throw new Error('File changed. Retry.');
    if (bytes.includes(0)) throw new Error('Binary files are not supported.');
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error('File is not valid UTF-8.'); }
  } finally { fs.closeSync(fd); }
}

// Never open with truncate. A new file must win O_EXCL; replacements must still be
// the exact approved inode/revision *after* opening. All writes use that pinned fd.
function writeText(root, original, bytes, check) {
  check();
  const file = resolvePath(root, original.rel, { allowNew: true });
  if (!!original.info !== !!file.info || (file.info && !unchanged(original.info, file.info))) throw new Error('File changed while awaiting approval. Retry.');
  const flags = fs.constants.O_WRONLY | noFollow | (fs.constants.O_NONBLOCK || 0);
  const fd = fs.openSync(file.full, file.info ? flags : flags | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    const opened = fs.fstatSync(fd, statOptions);
    if ((file.info && !unchanged(opened, file.info)) || !opened.isFile() || opened.nlink !== 1n ||
        !sameFile(resolvePath(root, original.rel).info, opened)) throw new Error('File changed while opening. Retry.');
    check();
    fs.writeFileSync(fd, bytes);
    fs.ftruncateSync(fd, bytes.length);
  } finally { fs.closeSync(fd); }
}
function list(root, rel) {
  const file = resolvePath(root, rel, { directory: true });
  const dir = fs.opendirSync(file.full);
  const entries = [];
  let truncated = false;
  try {
    for (let n = 0, entry; (entry = dir.readSync()); n++) {
      if (n >= 512 || entries.length >= 256) { truncated = true; break; }
      if (!safePart(entry.name) || /[\\/]/.test(entry.name) || !(entry.isFile() || entry.isDirectory())) continue;
      entries.push(entry.name + (entry.isDirectory() ? '/' : ''));
    }
  } finally { dir.closeSync(); }
  if (!sameFile(file.info, resolvePath(root, rel, { directory: true }).info)) throw new Error('Directory changed. Retry.');
  return entries.sort().join('\n') + (truncated ? '\n[listing truncated]' : '') || '(empty directory)';
}
module.exports = { workspace, resolvePath, fileForUri, readText, writeText, list, local, samePath, sameFile, MAX_FILE };
