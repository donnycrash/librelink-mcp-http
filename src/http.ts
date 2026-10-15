#!/usr/bin/env node

import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createServer, initializeClient } from './index.js';

const PORT = Number(process.env.PORT ?? 3000);

function requireToken(): string {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    console.error('MCP_AUTH_TOKEN is required: the HTTP endpoint exposes glucose data and must not run unauthenticated.');
    process.exit(1);
  }
  return token;
}

const AUTH_TOKEN = requireToken();

function authorized(req: IncomingMessage): boolean {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return false;
  const provided = Buffer.from(token);
  const expected = Buffer.from(AUTH_TOKEN);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Stateless: a fresh Server and transport per request. This runs as a single
// replica and the tools hold nothing per session, so there is no state worth
// tracking across calls, and nothing to leak if a client never sends DELETE.
async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}

const httpServer = createHttpServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (pathname !== '/mcp') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (!authorized(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  try {
    await handleMcp(req, res);
  } catch (error) {
    console.error('LibreLink MCP HTTP error:', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
});

initializeClient();

httpServer.listen(PORT, '0.0.0.0', () => {
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : PORT;
  console.error(`LibreLink MCP Server listening on http://0.0.0.0:${port}/mcp`);
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
