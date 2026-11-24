# Sentinel Workspace Bridge

This desktop VS Code extension lets Sentinel Desktop work in **one folder you pair**. It is a WebSocket **client**, not a listener. It connects only to `ws://127.0.0.1:9876`; it has no cloud endpoint, telemetry, shell-command API or URL setting.

## Install and pair

1. Install the VSIX in desktop VS Code: run **Extensions: Install from VSIX…**, or `code --install-extension workspace-bridge.vsix`. Reload VS Code if prompted. Extension ID: `local-workspace.workspace-bridge`.
2. Open one local workspace folder and decide whether you trust it. Don't grant workspace trust just to use the bridge. Remote windows (SSH, WSL, containers), web/virtual workspaces, empty windows and multi-root workspaces aren't supported.
3. In Sentinel Desktop's settings, enable desktop pairing and obtain its 64-character lowercase hex secret. In VS Code run **Sentinel: Pair Workspace Bridge** and type it into the masked password box. Do not put the secret in source code, a terminal command, a setting, or a task. The extension keeps it in VS Code SecretStorage, keyed by folder, not in workspace files or Settings Sync.
4. **Sentinel: Show Workspace Bridge Status** should say `Connected`. Once paired, startup and reconnect are automatic (1–30 s backoff). **Sentinel: Retry Workspace Bridge Connection** reconnects immediately. If the proof is rejected, pair again with the current desktop secret. Keep just the intended paired window open; the desktop accepts one client at a time.
5. **Sentinel: Unpair Workspace Bridge** stops the socket in this window and deletes this folder's saved secret. Disable or rotate pairing in Sentinel Desktop to revoke the desktop credential itself.

**Voice and data flow.** Use a linked Sentinel desktop and the matching dashboard. The dashboard recognizes the exact requests “read my active file” and “run my tests” without a model tool call; other phrasings and editor operations need a configured tool-calling provider. Only the transcript and normal chat context go to the dashboard for routing. The editor reply is not added to cloud chat history or cloud TTS. Sentinel speaks a short preview with an offline voice; find the bounded reply in **Control Center → VS Code integration → Last VS Code reply**. Independent screen sharing/background screen context still have their own permissions.

Pairing is authorization to **read workspace data**, including source, active editor content and diagnostics, without additional prompts. Review Sentinel Desktop's own data-sharing/assistant settings. Keep sensitive material outside folders you authorize. Local pairing authenticates peers; it does not sandbox other extensions or processes on your machine.

## Available operations

| Desktop request | Result and safeguards |
| --- | --- |
| `read_file {path}` | UTF-8 text; returns the editor's latest text if the file has unsaved changes. |
| `write_file {path, text}` | Always asks with a native modal showing create/replace, relative path, size and preview. Replaces the **whole file** or exclusively creates a new one in an existing directory. Refuses binary/large files, dirty editors, and files that changed during approval. |
| `list_files {path?}` | One directory level. Omit `path` or use `.` for the root. Protected and linked entries are omitted. |
| `run_tests {}` | Choose a folder-scoped, foreground **Test** group process/shell task. A separate native modal must approve execution. Runs that exact task via VS Code, never shell text from the request. The task's terminal shows its output; the reply reports its actual process exit code. Nonzero, cancelled, missing exit code and timeout are failures. Review the task and its dependencies before approving. |
| `get_active_file {}` | Relative path and active editor text, including unsaved edits to an existing workspace file. Refuses outside/untitled editors. |
| `get_diagnostics {path?}` | Current VS Code diagnostics, scoped to eligible workspace files, or a specific relative file. |
| `open_file {path}` | Opens an existing local UTF-8 text file in the editor. |
| `get_git_status {}` | Uses the built-in VS Code Git extension and refreshes the repository before reporting index, worktree and conflict changes. Open the actual repository root; Git must be enabled. |

Paths are relative to the paired folder. Absolute paths, `..`, `.git`, symlinks/junctions, special files and multiply-linked file targets are not permitted. Text file I/O is limited to 64 KiB. Results are at most 16,000 characters; listings and diagnostics have additional entry limits. One request runs at a time. Disconnect, unpair, folder change or the 110 s request deadline invalidates pending approvals. A native prompt may remain visible, but answering a stale prompt cannot start a task or write a file. A running bridge task is asked to terminate on cancellation; actions already performed by a task cannot be undone.

A minimal `.vscode/tasks.json` for a trusted Node project with an existing `npm test` script:

```json
{
  "version": "2.0.0",
  "tasks": [{ "label": "Project tests", "type": "shell", "command": "npm test", "group": "test", "problemMatcher": [] }]
}
```

## Build a VSIX and verify it

Use Node.js **22 or newer** and npm from this directory. The CommonJS files are the actual shipped extension; no transpilation step is needed.

```sh
npm ci
npm run package:vsix
code --install-extension workspace-bridge.vsix --force
```

`npm exec -- vsce ls` lists the packaged files. They must include `extension.cjs`, the handler/connector modules, and **`node_modules/ws`**. Do not use `--no-dependencies`. The lockfile pins both the runtime and packaging tool; dev dependencies and `tests/**` aren't shipped. For production activation lifecycle coverage, close any paired VS Code windows, stop the desktop listener, and run `npm run test:activation`. The test uses a temporary workspace, in-memory SecretStorage/native UI doubles and real loopback sockets. It skips (rather than contacting another listener) if port 9876 is occupied. For the separate real VS Code extension-host suite, run `npm run test:host` from the source tree (requires desktop VS Code).

For a full app-to-app run on Windows, use Node 24+, Git and installed desktop VS Code. Run `npm ci` and `npx vite build` in `desktop/`, then `npm ci`, `npm run package:vsix`, and `npm run test:host -- --electron` here. Leave port 9876 free. The test installs the **VSIX into a temporary profile** and pairs a separate instance of the built Sentinel app. Native prompt answers and test-task choices are scripted; Electron preload/IPC, both WebSocket peers, editor buffers, filesystem, Git, diagnostics and task processes are real. It verifies successful and rejected operations, app restart/reconnect and revocation. It doesn't use the microphone, a dashboard account, or your VS Code workspace. Set `VSCODE_EXECUTABLE_PATH` if the executable is not found automatically.

**Publish a reviewed VSIX:** obtain the owner's authorization, settle the distribution license, and use a Marketplace publisher account that owns the `publisher` ID in `package.json`. If that ID is unavailable, choose one you own and update the extension ID in the installation/testing instructions before packaging. For an update, bump `version`, refresh the lockfile and rebuild/test the VSIX. Create a scoped Marketplace publishing token, run `npm exec -- vsce login local-workspace` (enter credentials interactively), then `npm exec -- vsce publish --packagePath workspace-bridge.vsix`. Alternatively upload the same file through the publisher's **Manage Publishers** page. Never commit publishing credentials. Building or installing a local VSIX does **not** publish it.

## Protocol and integration surface

The desktop sends a random 32-byte hex `challenge.nonce`. The client supplies a fresh nonce and authenticates with HMAC-SHA256 over UTF-8 `client:<serverNonce>:<clientNonce>`. The key is the **decoded 32-byte** pairing secret. Before dispatching anything the client verifies the reciprocal `ready.proof` over `server:<serverNonce>:<clientNonce>` with a timing-safe comparison. Each connection has its own handshake, replay window and request lifetime. Binary frames, invalid handshakes and frames over 128 KiB are rejected. The secret itself is never sent.

`extension.cjs` exports `createConnector({ port, secret, dispatch })` (`start()`, `dispose()`, `status`) and `createHandlers({ confirm?, selectTestTask? })` (returns `dispatch(command, args, {signal, deadline})`, resolving to text or rejecting with an error). The latter uses real VS Code APIs; only the confirmation dialog and test-task picker are replaceable in host integration tests. Normal activation uses these same functions, **only** port `9876`, SecretStorage and native UI. There is no environment/setting to disable confirmation or select a custom endpoint.
