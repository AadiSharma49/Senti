// Separate process running the production Electron-main transport. The IPC pipe
// is the test driver only; every actual command/result must cross the WebSocket.
import { randomBytes } from 'node:crypto'
import { CodeBridgeServer } from '../../desktop/electron/codeBridge.ts'

const secret = randomBytes(32).toString('hex')
const server = new CodeBridgeServer({ secret, port: 0 })
const port = await server.start()
process.on('disconnect', () => { void server.stop() })
process.on('message', async ({ id, command, args }) => {
  const result = await server.request(command, args)
  process.send?.({ id, result })
})
process.send({ port, secret })
