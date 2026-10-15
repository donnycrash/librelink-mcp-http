#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Test environment-variable overrides for ConfigManager.
 * CONFIG_DIR is read once at import, so each scenario runs in its own process.
 */

const fileConfig = {
  credentials: { email: 'file@example.com', password: 'file-pass' },
  client: { version: '4.12.0', region: 'US' },
  display: { units: 'mg/dL' }
};

const LOAD = `
  import { ConfigManager } from './dist/config.js';
  const c = new ConfigManager();
  console.log(JSON.stringify({ ...c.getConfig(), configured: c.isConfigured() }));
`;

function loadWith(env, withFile) {
  const dir = mkdtempSync(join(tmpdir(), 'librelink-config-test-'));
  try {
    if (withFile) writeFileSync(join(dir, 'config.json'), JSON.stringify(fileConfig));
    const out = execFileSync('node', ['--input-type=module', '-e', LOAD], {
      env: { ...process.env, LIBRELINK_MCP_CONFIG_DIR: dir, ...env },
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return JSON.parse(out.toString());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function strip(env) {
  const cleaned = { ...env };
  for (const key of ['LIBRELINK_EMAIL', 'LIBRELINK_PASSWORD', 'LIBRELINK_REGION', 'LIBRELINK_UNITS']) {
    delete cleaned[key];
  }
  return cleaned;
}
process.env = strip(process.env);

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`[TEST] ${ok ? '✅' : '❌'} ${name}${ok ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  if (!ok) failures++;
}

const none = loadWith({}, false);
check('no file, no env: not configured', none.configured, false);

const envOnly = loadWith({
  LIBRELINK_EMAIL: 'env@example.com',
  LIBRELINK_PASSWORD: 'env-pass',
  LIBRELINK_REGION: 'eu',
  LIBRELINK_UNITS: 'mmol/l'
}, false);
check('env only: credentials applied', envOnly.credentials, { email: 'env@example.com', password: 'env-pass' });
check('env only: configured', envOnly.configured, true);
check('env only: region normalised to upper case', envOnly.client.region, 'EU');
check('env only: units normalised', envOnly.display.units, 'mmol/L');

const fileOnly = loadWith({}, true);
check('file only: file credentials used', fileOnly.credentials, fileConfig.credentials);
check('file only: file region kept', fileOnly.client.region, 'US');

const both = loadWith({ LIBRELINK_EMAIL: 'env@example.com', LIBRELINK_PASSWORD: 'env-pass' }, true);
check('file and env: env credentials win', both.credentials, { email: 'env@example.com', password: 'env-pass' });
check('file and env: untouched fields come from file', both.client.region, 'US');

const invalid = loadWith({ LIBRELINK_REGION: 'MARS', LIBRELINK_UNITS: 'stones' }, true);
check('invalid region ignored', invalid.client.region, 'US');
check('invalid units ignored', invalid.display.units, 'mg/dL');

console.log(failures === 0 ? '\n🎉 All config tests passed!' : `\n❌ ${failures} config test(s) failed`);
process.exit(failures === 0 ? 0 : 1);
