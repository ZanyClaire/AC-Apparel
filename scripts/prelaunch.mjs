#!/usr/bin/env node
/**
 * One command for both pre-launch checks:
 *
 *   node scripts/prelaunch.mjs                # theme + live store
 *   node scripts/prelaunch.mjs --theme-only   # static checks only
 *
 * The store pass needs SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN, or
 * SHOPIFY_ADMIN_API_URL. Without them it reports NOT RUN rather than passing.
 *
 * Exit codes: 0 everything passed, 1 a check found problems,
 * 2 a check could not run.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/prelaunch.mjs [--theme-only]

  --theme-only   skip the store checks (no Shopify credentials required)

Environment for the store checks:
  SHOPIFY_STORE_DOMAIN   <handle>.myshopify.com
  SHOPIFY_ADMIN_TOKEN    admin API access token with product read access
  SHOPIFY_CLIENT_ID      app Client ID; with the secret, a token is minted
  SHOPIFY_CLIENT_SECRET  app Client secret
  SHOPIFY_ADMIN_API_URL  optional full endpoint override`);
  process.exit(0);
}

const unknown = args.filter((a) => a !== '--theme-only');
if (unknown.length) {
  console.error(`Unknown option: ${unknown.join(' ')}\nTry --help.`);
  process.exit(2);
}

const themeOnly = args.includes('--theme-only');

/**
 * The Dev Dashboard app only hands out credentials, so a token is minted here
 * and kept in memory for the child process. Nothing is written to disk.
 */
function mintTokenIfNeeded() {
  const env = process.env;
  if (env.SHOPIFY_ADMIN_TOKEN || env.SHOPIFY_ADMIN_API_URL) return;
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) return;

  const run = spawnSync(process.execPath, [path.join(here, 'mint-admin-token.mjs')], {
    encoding: 'utf8',
    cwd: path.resolve(here, '..'),
  });
  if (run.status !== 0) {
    console.log(`\n${(run.stderr || 'could not mint an Admin API token').trim()}`);
    return;
  }
  const token = (run.stdout || '').trim().split(/\r?\n/).pop();
  if (!token) return;
  env.SHOPIFY_ADMIN_TOKEN = token;
  console.log(`\nminted an Admin API token from the app credentials (${token.slice(0, 7)}...)`);
}

const checks = [
  { name: 'Theme validation', script: 'validate-theme.mjs', skipped: false },
  { name: 'Store verification', script: 'verify-metafields.mjs', skipped: themeOnly },
];

const results = [];

if (!themeOnly) mintTokenIfNeeded();

for (const check of checks) {
  if (check.skipped) {
    results.push({ ...check, status: 'SKIPPED', code: null });
    continue;
  }

  console.log(`\n--- ${check.name} ---`);
  // Children resolve repository paths from the working directory, so anchor
  // them at the repo root rather than wherever this command was invoked from.
  const run = spawnSync(process.execPath, [path.join(here, check.script)], {
    stdio: 'inherit',
    cwd: path.resolve(here, '..'),
  });

  let status;
  if (run.error) {
    status = 'NOT RUN';
    console.log(`could not start ${check.script}: ${run.error.message}`);
  } else if (run.signal) {
    status = 'NOT RUN';
    console.log(`${check.script} was terminated by ${run.signal}`);
  } else if (run.status === 0) {
    status = 'PASS';
  } else if (run.status === 1) {
    status = 'FAIL';
  } else {
    status = 'NOT RUN';
  }

  results.push({ ...check, status, code: run.status ?? 2 });
}

const width = Math.max(...results.map((r) => r.name.length));
console.log('\nPre-launch summary');
for (const r of results) {
  console.log(`  ${r.name.padEnd(width)}  ${r.status}`);
}

const notRun = results.filter((r) => r.status === 'NOT RUN');
const failed = results.filter((r) => r.status === 'FAIL');
const skipped = results.filter((r) => r.status === 'SKIPPED');

console.log('');
if (notRun.length) {
  console.log(`${notRun.length} check(s) could not run. Set the Shopify environment variables, or pass --theme-only.`);
} else if (failed.length) {
  console.log(`${failed.length} check(s) failed. Fix the output above, then re-run.`);
} else if (skipped.length) {
  console.log('Static checks passed. The store was not checked (--theme-only).');
} else {
  console.log('All checks passed.');
}

if (notRun.length) process.exit(2);
if (failed.length) process.exit(1);
process.exit(0);
