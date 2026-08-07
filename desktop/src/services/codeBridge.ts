import { useScreenContextStore } from '../state/screenContextStore'

/**
 * codeBridge — renderer-side client for the VS Code WebSocket server.
 *
 * The actual WebSocket server lives in main.ts (it needs Node.js `ws`). This
 * module talks to it through the preload bridge: it tells main when to
 * start/stop the server, and sends/receives code commands through IPC.
 */

export interface CodeBridgeMessage {
  type: string
  [key: string]: unknown
}

const listeners = new Set<(msg: CodeBridgeMessage) => void>()

export function onCodeBridgeMessage(cb: (msg: CodeBridgeMessage) => void): () => void {
  listeners.add(cb)
  // The preload bridge passes `unknown`; cast at the boundary.
  const unsub = window.senti?.onCodeBridgeMessage?.((msg: unknown) => {
    try {
      cb(msg as CodeBridgeMessage)
    } catch {
      // ignore
    }
  })
  return () => {
    listeners.delete(cb)
    unsub?.()
  }
}

/**
 * Tell main to start the WebSocket server for VS Code.
 */
export function startCodeBridge(): void {
  void window.senti?.startCodeBridge?.()
}

/**
 * Tell main to stop the WebSocket server.
 */
export function stopCodeBridge(): void {
  void window.senti?.stopCodeBridge?.()
}

/**
 * Send a command to VS Code via the main-process WebSocket server.
 */
export async function sendToVSCode(msg: CodeBridgeMessage): Promise<boolean> {
  return (await window.senti?.sendToVSCode?.(msg)) ?? false
}

export async function isCodeBridgeConnected(): Promise<boolean> {
  return (await window.senti?.isCodeBridgeConnected?.()) ?? false
}

/**
 * High-level helpers for common code operations.
 */

export async function readActiveFile(): Promise<{ path: string; text: string; language: string } | null> {
  return new Promise((resolve) => {
    if (!isCodeBridgeConnected()) {
      // Fire and forget the connection check, but also try to send.
      sendToVSCode({ type: 'get_active_file' }).then((sent) => {
        if (!sent) resolve(null)
      })
    } else {
      sendToVSCode({ type: 'get_active_file' }).then((sent) => {
        if (!sent) resolve(null)
      })
    }
    const unsub = onCodeBridgeMessage((msg) => {
      if (msg.type === 'active_file') {
        unsub()
        const path = typeof msg.path === 'string' ? msg.path : ''
        const text = typeof msg.text === 'string' ? msg.text : ''
        const language = typeof msg.language === 'string' ? msg.language : ''
        resolve(path && text ? { path, text, language } : null)
      }
    })
    setTimeout(() => {
      unsub()
      resolve(null)
    }, 5000)
  })
}

export async function readFile(path: string): Promise<{ path: string; text: string } | null> {
  return new Promise((resolve) => {
    sendToVSCode({ type: 'read_file', path }).then((sent) => {
      if (!sent) resolve(null)
    })
    const unsub = onCodeBridgeMessage((msg) => {
      if (msg.type === 'file_content' && msg.path === path) {
        unsub()
        const text = typeof msg.text === 'string' ? msg.text : ''
        resolve(text ? { path, text } : null)
      }
    })
    setTimeout(() => {
      unsub()
      resolve(null)
    }, 5000)
  })
}

export async function writeFile(path: string, text: string): Promise<boolean> {
  return sendToVSCode({ type: 'write_file', path, text })
}

export async function listFolder(folder: string): Promise<{ files: string[]; folders: string[] } | null> {
  return new Promise((resolve) => {
    sendToVSCode({ type: 'list_files', folder }).then((sent) => {
      if (!sent) resolve(null)
    })
    const unsub = onCodeBridgeMessage((msg) => {
      if (msg.type === 'folder_listing' && msg.folder === folder) {
        unsub()
        const files = Array.isArray(msg.files) ? msg.files.filter((f): f is string => typeof f === 'string') : []
        const folders = Array.isArray(msg.folders) ? msg.folders.filter((f): f is string => typeof f === 'string') : []
        resolve({ files, folders })
      }
    })
    setTimeout(() => {
      unsub()
      resolve(null)
    }, 5000)
  })
}

export async function runInTerminal(command: string): Promise<boolean> {
  return sendToVSCode({ type: 'run_terminal', command })
}

export async function getDiagnostics(): Promise<Record<string, { message: string; severity: string; line: number }[]>> {
  return new Promise((resolve) => {
    sendToVSCode({ type: 'get_diagnostics' }).then((sent) => {
      if (!sent) resolve({})
    })
    const unsub = onCodeBridgeMessage((msg) => {
      if (msg.type === 'diagnostics') {
        unsub()
        const diags = msg.diagnostics as Record<string, { message: string; severity: string; line: number }[]>
        resolve(diags || {})
      }
    })
    setTimeout(() => {
      unsub()
      resolve({})
    }, 5000)
  })
}
