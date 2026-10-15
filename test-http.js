#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Test the Streamable HTTP entrypoint: health route, bearer auth, and a full
 * initialize + tools/list round trip. No LibreLink credentials required.
 */

const TOKEN = 'test-token-' + Math.random().toString(36).slice(2);
const configDir = mkdtempSync(join(tmpdir(), 'librelink-http-test-'));
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`[TEST] ${ok ? '✅' : '❌'} ${name}${ok || !detail ? '' : ` (${detail})`}`);
  if (!ok) failures++;
}

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/http.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LIBRELINK_MCP_CONFIG_DIR: configDir, ...env }
    });
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      const match = stderr.match(/listening on http:\/\/0\.0\.0\.0:(\d+)\/mcp/);
      if (match) resolve({ child, port: Number(match[1]) });
    });
    child.on('exit', (code) => reject(Object.assign(new Error(`server exited early: ${stderr.trim()}`), { code })));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
}

async function rpc(port, body, token = TOKEN) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  if (res.headers.get('content-type')?.includes('text/event-stream')) {
    const data = text.split('\n').find(line => line.startsWith('data: '));
    if (data) json = JSON.parse(data.slice(6));
  } else if (text) {
    json = JSON.parse(text);
  }
  return { status: res.status, json };
}

// Refuses to start without a token: the endpoint must never be open.
try {
  await startServer({ PORT: '0', MCP_AUTH_TOKEN: '' });
  check('refuses to start without MCP_AUTH_TOKEN', false, 'server started');
} catch (error) {
  check('refuses to start without MCP_AUTH_TOKEN', error.code === 1, error.message);
}

const { child, port } = await startServer({ PORT: '0', MCP_AUTH_TOKEN: TOKEN });
console.log(`[TEST] Server listening on port ${port}`);

try {
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  check('GET /health returns 200', health.status === 200, String(health.status));

  const missing = await fetch(`http://127.0.0.1:${port}/nowhere`);
  check('unknown path returns 404', missing.status === 404, String(missing.status));

  const noAuth = await rpc(port, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, null);
  check('POST /mcp without token returns 401', noAuth.status === 401, String(noAuth.status));

  const badAuth = await rpc(port, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'wrong-token');
  check('POST /mcp with wrong token returns 401', badAuth.status === 401, String(badAuth.status));

  const init = await rpc(port, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } }
  });
  check('initialize succeeds with token', init.status === 200 && init.json?.result?.serverInfo?.name === 'librelink-mcp-server',
    JSON.stringify(init.json));

  const list = await rpc(port, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const toolNames = (list.json?.result?.tools ?? []).map(t => t.name).sort();
  const expectedTools = [
    'configure_credentials', 'configure_ranges', 'configure_units', 'get_current_glucose',
    'get_glucose_history', 'get_glucose_stats', 'get_glucose_trends', 'get_sensor_info', 'validate_connection'
  ];
  check('tools/list returns every tool', JSON.stringify(toolNames) === JSON.stringify(expectedTools), toolNames.join(', '));

  const call = await rpc(port, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'validate_connection', arguments: {} } });
  check('tools/call responds without credentials', call.status === 200 && Array.isArray(call.json?.result?.content),
    JSON.stringify(call.json));
} finally {
  const exited = new Promise(resolve => child.on('exit', resolve));
  child.kill('SIGTERM');
  const code = await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve('timeout'), 3000))]);
  check('SIGTERM shuts down cleanly', code === 0, String(code));
  if (code === 'timeout') child.kill('SIGKILL');
  rmSync(configDir, { recursive: true, force: true });
}

console.log(failures === 0 ? '\n🎉 All HTTP tests passed!' : `\n❌ ${failures} HTTP test(s) failed`);
process.exit(failures === 0 ? 0 : 1);
