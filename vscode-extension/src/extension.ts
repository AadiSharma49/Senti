import * as vscode from 'vscode'
import * as ws from 'ws'

const SENTI_WS_PORT = 9876
const SENTI_WS_HOST = '127.0.0.1'

let client: ws.WebSocket | null = null
let statusBarItem: vscode.StatusBarItem | null = null
let connected = false

/**
 * VS Code extension — Senti Code Bridge.
 *
 * Activate on VS Code startup, connect to the Senti desktop app via
 * WebSocket, and expose code operations so Senti can help you build things.
 */
export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = 'senti.connect'
  statusBarItem.tooltip = 'Senti Code Bridge'
  statusBarItem.show()

  connectToSenti()

  context.subscriptions.push(
    vscode.commands.registerCommand('senti.connect', () => connectToSenti()),
    vscode.commands.registerCommand('senti.disconnect', () => disconnect()),
    vscode.commands.registerCommand('senti.readFile', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage('No file open')
        return
      }
      const text = editor.document.getText()
      const path = editor.document.fileName
      sendToSenti({ type: 'file_read', path, text, language: editor.document.languageId })
    }),
    vscode.commands.registerCommand('senti.runTerminal', async () => {
      const terminal = vscode.window.activeTerminal
      if (!terminal) {
        vscode.window.showWarningMessage('No terminal open')
        return
      }
      const selection = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection) || ''
      if (selection) {
        terminal.sendText(selection)
        vscode.window.showInformationMessage(`Sent to terminal: ${selection.slice(0, 50)}`)
      }
    }),
    statusBarItem
  )
}

function connectToSenti(): void {
  if (connected) {
    vscode.window.showInformationMessage('Senti Code Bridge is already connected')
    return
  }

  try {
    client = new ws.WebSocket(`ws://${SENTI_WS_HOST}:${SENTI_WS_PORT}`)

    client.on('open', () => {
      connected = true
      updateStatusBar()
      vscode.window.showInformationMessage('Senti Code Bridge connected')
      sendToSenti({ type: 'extension_ready', version: '0.1.0' })
    })

    client.on('message', async (data: ws.Data) => {
      try {
        const msg = JSON.parse(data.toString())
        await handleSentiMessage(msg)
      } catch {
        // ignore malformed messages
      }
    })

    client.on('close', () => {
      connected = false
      updateStatusBar()
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (!connected) connectToSenti()
      }, 3000)
    })

    client.on('error', () => {
      connected = false
      updateStatusBar()
    })
  } catch {
    vscode.window.showErrorMessage('Could not connect to Senti — is the desktop app running?')
  }
}

function disconnect(): void {
  if (client) {
    client.close()
    client = null
  }
  connected = false
  updateStatusBar()
  vscode.window.showInformationMessage('Senti Code Bridge disconnected')
}

async function handleSentiMessage(msg: Record<string, unknown>): Promise<void> {
  const type = msg.type as string

  switch (type) {
    case 'ping':
      sendToSenti({ type: 'pong' })
      break

    case 'read_file': {
      const path = typeof msg.path === 'string' ? msg.path : ''
      try {
        const uri = vscode.Uri.file(path)
        const content = await vscode.workspace.fs.readFile(uri)
        const text = Buffer.from(content).toString('utf-8')
        sendToSenti({ type: 'file_content', path, text, exists: true })
      } catch {
        sendToSenti({ type: 'file_content', path, error: 'File not found', exists: false })
      }
      break
    }

    case 'write_file': {
      const path = typeof msg.path === 'string' ? msg.path : ''
      const text = typeof msg.text === 'string' ? msg.text : ''
      try {
        const uri = vscode.Uri.file(path)
        await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf-8'))
        sendToSenti({ type: 'write_result', path, ok: true })
        // Open the file in the editor
        const doc = await vscode.workspace.openTextDocument(uri)
        await vscode.window.showTextDocument(doc)
      } catch (err) {
        sendToSenti({ type: 'write_result', path, ok: false, error: String(err) })
      }
      break
    }

    case 'list_files': {
      const folder = typeof msg.folder === 'string' ? msg.folder : ''
      try {
        const uri = vscode.Uri.file(folder)
        const entries = await vscode.workspace.fs.readDirectory(uri)
        const files = entries
          .filter(([, type]) => type === vscode.FileType.File)
          .map(([name]) => name)
          .slice(0, 100)
        const folders = entries
          .filter(([, type]) => type === vscode.FileType.Directory)
          .map(([name]) => name)
          .slice(0, 50)
        sendToSenti({ type: 'folder_listing', folder, files, folders })
      } catch (err) {
        sendToSenti({ type: 'folder_listing', folder, error: String(err), files: [], folders: [] })
      }
      break
    }

    case 'run_terminal': {
      const command = typeof msg.command === 'string' ? msg.command : ''
      const terminal = vscode.window.createTerminal('Senti')
      terminal.sendText(command)
      terminal.show()
      sendToSenti({ type: 'terminal_result', command, ok: true })
      break
    }

    case 'get_active_file': {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        sendToSenti({ type: 'active_file', path: '', text: '', language: '', open: false })
        break
      }
      const text = editor.document.getText()
      sendToSenti({
        type: 'active_file',
        path: editor.document.fileName,
        text,
        language: editor.document.languageId,
        open: true,
      })
      break
    }

    case 'get_diagnostics': {
      const diagnostics: Record<string, { message: string; severity: string; line: number }[]> = {}
      for (const [uri, diags] of vscode.languages.getDiagnostics()) {
        const path = uri.fsPath
        if (!diagnostics[path]) diagnostics[path] = []
        for (const d of diags) {
          diagnostics[path].push({
            message: d.message,
            severity: vscode.DiagnosticSeverity[d.severity] || 'error',
            line: d.range.start.line,
          })
        }
      }
      sendToSenti({ type: 'diagnostics', diagnostics })
      break
    }

    case 'get_git_status': {
      try {
        const repos = await vscode.workspace.findFiles('**/.git', null, 10)
        const status: Record<string, { branch: string; changes: number }> = {}
        for (const repo of repos.slice(0, 5)) {
          const folder = repo.fsPath.replace(/[\\/]\.git$/, '')
          status[folder] = { branch: 'unknown', changes: 0 }
        }
        sendToSenti({ type: 'git_status', repos: status })
      } catch {
        sendToSenti({ type: 'git_status', repos: {} })
      }
      break
    }

    case 'open_file': {
      const path = typeof msg.path === 'string' ? msg.path : ''
      try {
        const uri = vscode.Uri.file(path)
        const doc = await vscode.workspace.openTextDocument(uri)
        await vscode.window.showTextDocument(doc)
        sendToSenti({ type: 'open_result', path, ok: true })
      } catch {
        sendToSenti({ type: 'open_result', path, ok: false })
      }
      break
    }

    default:
      break
  }
}

function sendToSenti(msg: Record<string, unknown>): void {
  if (client && client.readyState === ws.OPEN) {
    try {
      client.send(JSON.stringify(msg))
    } catch {
      // ignore send errors
    }
  }
}

function updateStatusBar(): void {
  if (!statusBarItem) return
  if (connected) {
    statusBarItem.text = '$(check) Senti'
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground')
  } else {
    statusBarItem.text = '$(x) Senti'
    statusBarItem.backgroundColor = undefined
  }
}

export function deactivate(): void {
  disconnect()
}
