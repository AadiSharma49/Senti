// Windows, Node >= 22.13 with stripTypeScriptTypes, stock Edge. No npm install.
import { createServer } from 'node:http'
import { execFileSync, spawn } from 'node:child_process'
import { stripTypeScriptTypes } from 'node:module'
import { mkdtemp, mkdir, rm, readFile, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { parseArgs } from 'node:util'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(here, '../../..')
const { values: opts } = parseArgs({ options: {
  rev: { type: 'string' }, seconds: { type: 'string', default: '6' },
  preset: { type: 'string', default: 'smooth' }, edge: { type: 'string' },
  'observe-legacy': { type: 'boolean' },
} })
const seconds = Number(opts.seconds)
if (!(seconds >= 2 && seconds <= 60)) throw Error('--seconds must be 2..60')
if (!['smooth', 'balanced', 'sharp'].includes(opts.preset)) throw Error('invalid --preset')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trimEnd()
const commit = git('rev-parse', '--verify', '--end-of-options', `${opts.rev || 'HEAD'}^{commit}`)
const edge = opts.edge || join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe')
await access(edge)
const tempRoot = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp/opencode') : tmpdir()
await mkdir(tempRoot, { recursive: true })
const profile = await mkdtemp(join(tempRoot, 'senti-loopback-'))
const prefix = `/${randomUUID()}/`
const cache = new Map()
let finish, fail
const result = new Promise((yes, no) => { finish = yes; fail = no })
const config = { seconds, preset: opts.preset, strict: !opts['observe-legacy'] }
const server = createServer(async (req, res) => {
  try {
    const pathname = (req.url || '').split('?')[0]
    if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return }
    const file = pathname.slice(prefix.length)
    if (req.method === 'POST' && file === 'result') {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 256000) throw Error('oversize result')
      }
      const report = JSON.parse(body)
      res.writeHead(204).end()
      finish(report)
      return
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return }
    // No arbitrary local files, traversal, .env loading, or proxy to any backend.
    let type = 'text/javascript', text
    if (file === '' || file === 'peer.html') {
      type = 'text/html'
      text = `<!doctype html><meta charset="utf-8"><title>Loopback</title><script type="module" src="./${file ? 'peer' : 'scenario'}.js"></script><body></body>`
    } else if (file === 'config.js') text = `export default ${JSON.stringify(config)}`
    else if (file === 'peer.js' || file === 'scenario.js') text = await readFile(join(here, file), 'utf8')
    else if (/^src\/(?:[\w-]+\/)*[\w-]+(?:\.ts)?$/.test(file)) {
      const src = `desktop/${file.replace(/\.ts$/, '')}.ts`
      if (!cache.has(src)) {
        const ts = opts.rev ? git('show', `${commit}:${src}`) : await readFile(join(root, src), 'utf8')
        cache.set(src, 'import.meta.env = Object.freeze({});\n' + stripTypeScriptTypes(ts, { mode: 'transform' }))
      }
      text = cache.get(src)
    } else { res.writeHead(404).end(); return }
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; frame-src 'self'; media-src blob: 'self'; style-src 'unsafe-inline'; img-src 'none'",
      'Permissions-Policy': 'camera=(), microphone=(), display-capture=()',
    }).end(text)
  } catch (err) { res.writeHead(500).end(); fail(err) }
})
let browser, timeout
const interrupted = () => fail(Error('interrupted'))
process.once('SIGINT', interrupted)
process.once('SIGTERM', interrupted)
try {
  await new Promise((ok, no) => server.once('error', no).listen(Number(process.env.PORT || 0), '127.0.0.1', ok))
  const url = `http://127.0.0.1:${server.address().port}${prefix}`
  browser = spawn(edge, [
    '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-component-update', '--disable-background-networking',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE *.local', '--no-proxy-server',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--allow-loopback-in-peer-connection', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required',
    '--edge-skip-compat-layer-relaunch', '--window-size=1280,800', url,
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
  let diagnostic = ''
  browser.stderr.on('data', data => { diagnostic = (diagnostic + data).slice(-2048) })
  browser.once('error', fail)
  browser.once('exit', code => fail(Error(`Edge exited early (${code}): ${diagnostic}`)))
  timeout = setTimeout(() => fail(Error('Edge did not post a result before the watchdog')), (seconds + 90) * 1000)
  const report = await result
  const hash = createHash('sha256')
  for (const file of [...cache.keys()].sort()) hash.update(file).update('\0').update(cache.get(file)).update('\0')
  console.log(JSON.stringify({ source: opts.rev ? commit : `working tree (HEAD ${commit})`, rendererModuleSHA256: hash.digest('hex'), config, ...report }, null, 2))
  if (!report.pass) process.exitCode = 1
} finally {
  clearTimeout(timeout)
  if (browser?.pid && browser.exitCode === null) {
    // Only the tree launched above, never an image-name kill or the user's Edge profile.
    try { execFileSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }) }
    catch { browser.kill() }
  }
  server.closeAllConnections()
  await new Promise(ok => server.close(ok))
  await rm(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 })
}
