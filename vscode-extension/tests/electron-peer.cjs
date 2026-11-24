// Optional full-app peer. Starts the *built* desktop with an isolated DPAPI
// profile and goes through its real preload and ipcMain handlers. No production
// env var, backdoor IPC handler or test endpoint is needed. Native dialog clicks
// are the only desktop UI interaction supplied by this fixture.
const { app, dialog } = require('electron')
const { pathToFileURL } = require('node:url')
const path = require('node:path')
const fs = require('node:fs')
const profile = process.env.SENTINEL_ELECTRON_PROFILE
if (!profile || !path.isAbsolute(profile) || !/^sentinel-ide-test-/.test(path.basename(path.dirname(profile)))) throw new Error('Expected an isolated test profile')
const restart = process.argv.includes('--resume-fixture')
const keyFile = path.join(profile, 'code-bridge.key')
if (!restart) fs.mkdirSync(profile) // refuses to overwrite an existing profile
else if (!fs.existsSync(keyFile)) throw new Error('No fixture pairing to restore')
app.setPath('userData', profile)
const failure = error => { console.error(error); app.exit(1) }
process.on('disconnect', () => app.quit())
let key
// These prompts exist only inside our throwaway Electron process. Don't alter
// the system clipboard or log the key. Check exact dialog order and contents.
dialog.showMessageBox = async (_win, options) => {
  if (options.type === 'question' && options.buttons[0] === 'Cancel') return { response: 1 }
  if (options.type === 'info' && /^[a-f0-9]{64}$/.test(options.detail)) {
    key = options.detail
    return { response: 1 }
  }
  throw new Error('Unexpected desktop prompt in test')
}
app.once('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const call = (method, args = []) => window.webContents.executeJavaScript(`window.senti.${method}(...${JSON.stringify(args)})`)
      if (!restart) {
        if (!(await call('codeBridgeStatus')).includes('disabled')) throw new Error('Not using a fresh desktop profile')
        const result = await call('codeBridgePair')
        if (!result.ok || !key) throw new Error(`Could not start desktop bridge: ${result.text}`)
        if (fs.readFileSync(keyFile).includes(key)) throw new Error('Pairing key persisted as plaintext')
      }
      process.on('message', async ({ id, command, args }) => {
        try {
          if (command === '$revoke') {
            const result = await call('codeBridgeDisable')
            if (fs.existsSync(keyFile)) throw new Error('Revoke left a pairing key on disk')
            process.send({ id, result })
          } else process.send({ id, result: await call('codeBridgeRequest', [command, args]) })
        } catch (err) { failure(err) }
      })
      process.send({ port: 9876, secret: key })
    } catch (err) { failure(err) }
  })
})
import(pathToFileURL(path.resolve(__dirname, '../../desktop/dist-electron/main.js')).href).catch(failure)
