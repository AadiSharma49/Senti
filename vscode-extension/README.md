# Senti Code Bridge — VS Code Extension

Lets Senti read, write, and run code in your VS Code editor.

## Install

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Click "Install from VSIX..."
4. Select `vscode-extension/senti-code-bridge-0.1.0.vsix`

Or from command line:
```bash
code --install-extension vscode-extension/senti-code-bridge-0.1.0.vsix
```

## How it works

1. The Senti desktop app starts a WebSocket server on `localhost:9876`
2. This extension connects to it when VS Code opens
3. Senti can now:
   - **Read files** — "read the server file", "what's in package.json"
   - **Write code** — "build a chat app", "create a login page", "add error handling"
   - **Run commands** — "npm install", "npm run dev", "git status"
   - **See your screen** — "what am I looking at", "help me with this"
   - **Get diagnostics** — "what's broken", "show me errors"

## Requirements

- Senti desktop app running (the code bridge server starts automatically)
- VS Code 1.80+

## Privacy

This extension only communicates with `localhost:9876` — your code never leaves your machine. Senti sees what you're working on so it can help, but nothing is uploaded or stored.
