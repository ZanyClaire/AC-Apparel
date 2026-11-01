#!/usr/bin/env node
/**
 * Trade the app's Client ID and Client secret for a short-lived Admin API
 * access token (shpat_...), which is what the store checks need.
 *
 *   node scripts/mint-admin-token.mjs
 *
 * Shopify no longer shows a copyable Admin API token for admin-created custom
 * apps, so an app from the Dev Dashboard hands out credentials instead and the
 * token is minted on demand:
 *
 *   POST https://{store}/admin/oauth/access_token
 *   grant_type=client_credentials&client_id=...&client_secret=...
 *
 * The token lasts 24 hours. This only works for an app installed on a store
 * that belongs to the same Shopify organization as the app.
 *
 * Requires SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.
 * In CI it writes SHOPIFY_ADMIN_TOKEN to $GITHUB_ENV and masks it; locally it
 * prints the token to stdout. Exit codes: 0 minted, 2 could not mint.
 */

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SCOPE_NEEDED = 'read_products';

class MintError extends Error {}

function headerOffender(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code > 0x7e) return { index, code };
  }
  return null;
}

function describeOffender({ index, code }) {
  let what;
  if (code === 0x2026) {
    what = 'an ellipsis (…), the mark left when a value is copied from a truncated or masked display';
  } else if (code === 0x20 || (code >= 0x09 && code <= 0x0d)) {
    what = 'whitespace';
  } else {
    what = `a character outside ASCII (U+${code.toString(16).toUpperCase().padStart(4, '0')})`;
  }
  return `${what} at position ${index}`;
}

function readClean(env, name, { required = true } = {}) {
  const raw = env[name] ?? '';
  const value = raw.trim();
  if (!value) {
    if (required) throw new MintError(`${name} is not set`);
    return '';
  }
  const offender = headerOffender(value);
  if (offender) {
    throw new MintError(
      `${name} contains ${describeOffender(offender)}, so it cannot be sent. ` +
        'Re-copy the whole value rather than from a shortened or masked display.',
    );
  }
  if (value.includes('...')) {
    throw new MintError(`${name} contains "...", so it looks truncated. Re-copy the full value.`);
  }
  return value;
}

export function storeDomain(env) {
  const domain = readClean(env, 'SHOPIFY_STORE_DOMAIN')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
    throw new MintError(
      `SHOPIFY_STORE_DOMAIN is not a domain like your-store.myshopify.com: ${domain}`,
    );
  }
  return domain;
}

function hintFor(error = '') {
  switch (error) {
    case 'shop_not_permitted':
      return (
        'the app is not installed on this store, or the store belongs to a different Shopify ' +
        'organization than the app. In the Dev Dashboard open the app, release a version with the ' +
        'Admin API scopes, then use Home > Install app to install it on the store.'
      );
    case 'invalid_client':
    case 'invalid_client_credentials':
      return 'the Client ID and Client secret do not belong to the same app, or the secret was rotated after it was copied.';
    case 'invalid_grant':
      return 'the store rejected the grant; confirm the domain is the store the app is installed on.';
    case 'unsupported_grant_type':
      return 'this store does not offer client credentials, which usually means the app is not a Dev Dashboard app or was never installed.';
    case 'app_not_installed':
      return 'the app exists but is not installed on this store. Install it from the Dev Dashboard Home tab.';
    case 'http_404':
      return 'no Shopify store answers at that domain. SHOPIFY_STORE_DOMAIN must be the store\'s own your-store.myshopify.com address.';
    case 'http_423':
      return 'the store is locked or paused (for example an unpaid bill), so it will not issue tokens.';
    default:
      return 'check the app installation, the released scopes, and that the credentials are current.';
  }
}

/**
 * Exchanges credentials for a token. `fetchImpl` is injectable so the error
 * paths can be tested without a real store.
 */
export async function mintToken({ domain, clientId, clientSecret, fetchImpl = fetch }) {
  const url = `https://${domain}/admin/oauth/access_token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });
  } catch (error) {
    throw new MintError(`could not reach ${url}: ${error.message}`);
  }

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new MintError(`${url} answered HTTP ${res.status} with non-JSON: ${text.slice(0, 200)}`);
  }

  if (!res.ok || payload.error) {
    const code = payload.error || `http_${res.status}`;
    const detail = payload.error_description ? ` (${payload.error_description})` : '';
    throw new MintError(`Shopify refused the grant: ${code}${detail}. Fix: ${hintFor(code)}`);
  }
  const token = String(payload.access_token ?? '');
  if (!token.startsWith('shpat_')) {
    throw new MintError(
      `the response carried no Admin API access token (got "${token.slice(0, 6)}..."); ` +
        'this store does not issue shpat_ tokens for the client credentials grant.',
    );
  }

  const scope = String(payload.scope ?? '');
  if (scope && !scope.split(',').map((s) => s.trim()).includes(SCOPE_NEEDED)) {
    throw new MintError(
      `the token was minted without the ${SCOPE_NEEDED} scope (granted: ${scope}). ` +
        'Add it to the app version in the Dev Dashboard, release the version, then re-install the app.',
    );
  }

  return { token, scope };
}

/**
 * Hands the token to later CI steps: masked in the log, written to $GITHUB_ENV.
 * Outside CI it prints to stdout so the value can be piped somewhere.
 */
export function publishToken({ token, scope, env = process.env, log = console.log }) {
  if (env.GITHUB_ENV) {
    log(`::add-mask::${token}`);
    appendFileSync(env.GITHUB_ENV, `SHOPIFY_ADMIN_TOKEN=${token}\n`);
    log(`Minted an Admin API token (scope: ${scope || 'not reported'}).`);
    return;
  }
  log(token);
}

async function main() {
  try {
    const env = process.env;
    const domain = storeDomain(env);
    const clientId = readClean(env, 'SHOPIFY_CLIENT_ID');
    const clientSecret = readClean(env, 'SHOPIFY_CLIENT_SECRET');

    const { token, scope } = await mintToken({ domain, clientId, clientSecret });
    publishToken({ token, scope, env });
    process.exit(0);
  } catch (error) {
    if (!(error instanceof MintError)) throw error;
    console.error(`Could not mint a Shopify Admin API token: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
