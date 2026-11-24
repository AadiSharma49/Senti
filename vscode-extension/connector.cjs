'use strict';
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const WebSocket = require('ws');

const MAX_PAYLOAD = 128 * 1024;
const MAX_TEXT = 16000;
const REQUEST_MS = 110000;
const isHex = value => typeof value === 'string' && value.length === 64 && /^[0-9a-f]+$/.test(value);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => typeof value === 'string' && value.length === 36 && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
function bounded(text) {
  const suffix = '\n[truncated]';
  return text.length <= MAX_TEXT ? text : text.slice(0, MAX_TEXT - suffix.length) + suffix;
}

// Production constructs this only after validating workspace eligibility and loading SecretStorage.
// Each socket owns its handshake, deadlines and requests: nothing is carried over to a retry.
function createConnector({ port, secret, dispatch, onStatus = () => {} }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !isHex(secret) || typeof dispatch !== 'function') {
    throw new Error('Invalid bridge connection parameters.');
  }
  const key = Buffer.from(secret, 'hex');
  secret = undefined;
  let current, retry, disposed = false, delay = 1000, status = 'Stopped';
  const setStatus = value => { status = value; onStatus(value); };
  const proof = (role, server, client) => createHmac('sha256', key).update(`${role}:${server}:${client}`, 'utf8').digest();

  function finish(session, reason) {
    if (current !== session) return;
    current = undefined;
    clearTimeout(session.handshake);
    if (session.pending) {
      clearTimeout(session.pending.timer);
      session.pending.controller.abort(new Error('Desktop disconnected.'));
    }
    session.ws.terminate();
    if (disposed) return;
    setStatus(`${reason} Retrying.`);
    retry = setTimeout(() => { retry = undefined; connect(); }, delay);
    delay = Math.min(delay * 2, 30000);
  }

  function send(session, message) {
    if (session !== current) return;
    const { ws } = session;
    if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > MAX_PAYLOAD) return finish(session, 'Connection unavailable.');
    ws.send(JSON.stringify(message), error => { if (error) finish(session, 'Send failed.'); });
  }

  function request(session, { id, command, args }) {
    if (session.ids.has(id)) return finish(session, 'Duplicate request ID.');
    session.ids.add(id);
    if (session.ids.size > 512) session.ids.delete(session.ids.values().next().value);
    if (session.pending) return send(session, { type: 'result', id, ok: false, text: 'Workspace busy. Retry after the current request.' });
    const controller = new AbortController();
    const deadline = Date.now() + REQUEST_MS;
    const pending = { controller, timer: undefined };
    session.pending = pending;
    const reply = (ok, text) => {
      if (current !== session || session.pending !== pending) return;
      session.pending = undefined;
      clearTimeout(pending.timer);
      send(session, { type: 'result', id, ok, text: bounded(text) });
    };
    const timeout = () => {
      controller.abort(new Error('Request timed out after 110 seconds.'));
      reply(false, 'Request timed out after 110 seconds.');
    };
    pending.timer = setTimeout(timeout, REQUEST_MS);
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw controller.signal.reason;
      return dispatch(command, args, { signal: controller.signal, deadline });
    }).then(text => {
      if (Date.now() >= deadline) return timeout();
      if (typeof text !== 'string') throw new Error('Handler returned no text.');
      reply(true, text);
    }).catch(error => reply(false, error instanceof Error ? error.message : 'Workspace command failed.'));
  }

  function connect() {
    if (disposed || current || retry) return;
    setStatus('Connecting');
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      agent: false, maxPayload: MAX_PAYLOAD, perMessageDeflate: false, followRedirects: false, handshakeTimeout: 5000,
    });
    const session = { ws, phase: 'challenge', ids: new Set(), pending: undefined };
    current = session;
    session.handshake = setTimeout(() => finish(session, 'Authentication timed out.'), 7000);
    ws.on('upgrade', response => {
      const peer = response.socket;
      if (peer.remoteAddress !== '127.0.0.1' || peer.remotePort !== port) finish(session, 'Not a direct loopback connection.');
    });
    ws.on('error', () => finish(session, 'Desktop unavailable.'));
    ws.on('close', () => finish(session, 'Disconnected.'));
    ws.on('message', (raw, binary) => {
      if (current !== session) return;
      try {
        if (binary) throw new Error();
        const msg = JSON.parse(raw.toString('utf8'));
        if (!isObject(msg)) throw new Error();
        if (session.phase === 'challenge' && msg.type === 'challenge' && isHex(msg.nonce)) {
          session.server = msg.nonce;
          session.client = randomBytes(32).toString('hex');
          session.phase = 'ready';
          return send(session, { type: 'authenticate', nonce: session.client, proof: proof('client', session.server, session.client).toString('hex') });
        }
        if (session.phase === 'ready' && msg.type === 'ready' && isHex(msg.proof) &&
            timingSafeEqual(proof('server', session.server, session.client), Buffer.from(msg.proof, 'hex'))) {
          session.phase = 'authenticated';
          clearTimeout(session.handshake);
          delay = 1000;
          return setStatus('Connected');
        }
        if (session.phase === 'authenticated' && msg.type === 'request' && isId(msg.id) &&
            typeof msg.command === 'string' && msg.command.length <= 64 && isObject(msg.args)) return request(session, msg);
        throw new Error();
      } catch {
        finish(session, 'Invalid bridge message or pairing proof.');
      }
    });
  }

  return {
    start: connect,
    get status() { return status; },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(retry);
      if (current) finish(current, 'Stopped.');
      key.fill(0);
      setStatus('Stopped');
    },
  };
}

module.exports = { createConnector, bounded, isHex, isObject, REQUEST_MS, MAX_TEXT };
