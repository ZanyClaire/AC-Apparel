#!/usr/bin/env node
/**
 * Creates the ten product metafield definitions the theme reads.
 *
 *   SHOPIFY_STORE_DOMAIN=<handle>.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_... \
 *   node scripts/define-metafields.mjs
 *
 * Or pass the app's SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET instead of a
 * token, and one is minted first, exactly as the pre-launch gate does.
 *
 *   --dry-run   print what would be created and change nothing
 *
 * Needs the write_products scope: read_products can inspect definitions but not
 * create them. Re-running is safe — an existing definition answers TAKEN and is
 * left untouched, so this can be run after adding a scope or fixing a type.
 *
 * Exit codes: 0 every definition exists, 1 some need a human, 2 could not run.
 */

import { pathToFileURL } from 'node:url';
import { EXPECTED, adminToken } from './verify-metafields.mjs';
import { mintToken, storeDomain } from './mint-admin-token.mjs';

const CREATE_MUTATION = `
mutation DefineThemeMetafield($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id key }
    userErrors { field message code }
  }
}
`;

/** Display names and admin-facing descriptions, kept identical to docs/metafield-definitions.graphql. */
const COPY = {
  digital_twin: {
    name: 'Digital twin',
    description:
      'The digital asset product sold alongside this garment. Drives the Digital Look tab, the card badge and the Buy digital only button.',
  },
  is_digital_asset: {
    name: 'Is digital asset',
    description:
      'True for digital-only products. Flips the product tabs to Asset preview / What you receive and marks the line as an instant download.',
  },
  digital_look: {
    name: 'Digital look',
    description:
      'Image or video shown in the Digital Look tab. Videos autoplay muted and looped. Falls back to generated wireframe art when empty.',
  },
  digital_look_caption: {
    name: 'Digital look caption',
    description: 'Caption for the digital look media, also used as its alt text.',
  },
  digital_format: {
    name: 'Digital format',
    description:
      'Formats and delivery line for an asset, e.g. FBX, USDZ, 4K PBR textures. Falls back to "Files delivered instantly".',
  },
  short_description: {
    name: 'Short description',
    description:
      'Plain-text standfirst under the product title. No HTML. Falls back to the first 42 words of the description.',
  },
  specs: {
    name: 'Specs',
    description:
      'Contents of the Materials & construction accordion. Rich text. Falls back to the full product description.',
  },
  material: {
    name: 'Material',
    description:
      'Short material line shown under the product name on cards, e.g. Wool gabardine. Falls back to product type or vendor.',
  },
  fit: { name: 'Fit', description: 'Fit notes. The Fit accordion is hidden when this is empty.' },
  care: {
    name: 'Care and licence',
    description:
      'Care instructions and digital licence terms. The Care & licence accordion is hidden when this is empty.',
  },
};

const SCOPE = 'write_products';

class DefineError extends Error {}

function pad(value, width) {
  return String(value).padEnd(width);
}

function graphqlUrl(env) {
  if (env.SHOPIFY_ADMIN_API_URL) return env.SHOPIFY_ADMIN_API_URL;
  return `https://${storeDomain(env)}/admin/api/${env.SHOPIFY_API_VERSION || '2026-10'}/graphql.json`;
}

async function credential(env) {
  if (env.SHOPIFY_ADMIN_TOKEN) return { token: adminToken(env), source: 'SHOPIFY_ADMIN_TOKEN' };

  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
    throw new DefineError(
      'set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET to mint one',
    );
  }
  const { token, scope } = await mintToken({
    domain: storeDomain(env),
    clientId: env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
  });
  if (scope && !scope.split(',').map((s) => s.trim()).includes(SCOPE)) {
    throw new DefineError(
      `the app only grants ${scope}, but creating definitions needs ${SCOPE}. ` +
        `Add ${SCOPE} to the app's Admin API scopes, release the version and re-install, then run this again.`,
    );
  }
  return { token, source: 'minted from the app credentials' };
}

async function createDefinition(url, token, definition) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: CREATE_MUTATION, variables: { definition } }),
    });
  } catch (error) {
    throw new DefineError(`could not reach ${url}: ${error.message}`);
  }

  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new DefineError(
      `HTTP ${res.status}: the token cannot write metafield definitions. ` +
        `Add the ${SCOPE} scope to the app, release the version and re-install it.`,
    );
  }
  if (!res.ok) throw new DefineError(`HTTP ${res.status}: ${text.slice(0, 300)}`);

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new DefineError(`response was not JSON: ${text.slice(0, 200)}`);
  }

  const result = payload.data?.metafieldDefinitionCreate;
  const errors = result?.userErrors ?? [];
  const denied =
    errors.find((e) => /ACCESS_DENIED|access scope/i.test(`${e.code} ${e.message}`)) ?? null;
  if (denied) {
    throw new DefineError(
      `access denied for ${definition.key}: the token needs the ${SCOPE} scope. ` +
        `Add it to the app, release the version and re-install.`,
    );
  }
  if (errors.length) {
    return { status: errors.some((e) => e.code === 'TAKEN') ? 'exists' : 'failed', errors };
  }
  return { status: 'created', errors: [] };
}

async function main() {
  const env = process.env;
  const dryRun = process.argv.includes('--dry-run');
  const unknown = process.argv.slice(2).filter((a) => a !== '--dry-run');
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(' ')}`);
    return 2;
  }

  const url = graphqlUrl(env);
  const store = env.SHOPIFY_STORE_DOMAIN || url;
  console.log(`Store: ${store}`);

  const definitions = EXPECTED.map((entry) => ({
    name: COPY[entry.key]?.name ?? entry.key,
    namespace: 'custom',
    key: entry.key,
    description: COPY[entry.key]?.description,
    type: entry.type,
    ownerType: 'PRODUCT',
    access: { storefront: 'PUBLIC_READ' },
  }));

  if (dryRun) {
    console.log(`\nWould create ${definitions.length} definition(s):`);
    for (const d of definitions) console.log(`  ${pad(`custom.${d.key}`, 28)} ${d.type}`);
    return 0;
  }

  const { token, source } = await credential(env);
  console.log(`Credential: ${source}\n`);

  const results = [];
  for (const definition of definitions) {
    const outcome = await createDefinition(url, token, definition);
    results.push({ key: definition.key, type: definition.type, ...outcome });
  }

  console.log(`  ${pad('definition', 28)} ${pad('expected type', 24)} result`);
  for (const r of results) {
    const detail =
      r.status === 'failed'
        ? `FAILED: ${r.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`
        : r.status;
    console.log(`  ${pad(`custom.${r.key}`, 28)} ${pad(r.type, 24)} ${detail}`);
  }
  console.log('');

  const failed = results.filter((r) => r.status === 'failed');
  const created = results.filter((r) => r.status === 'created');
  const existing = results.filter((r) => r.status === 'exists');

  if (failed.length) {
    console.log(`${failed.length} definition(s) could not be created:`);
    for (const r of failed) console.log(`  - custom.${r.key}: ${r.errors.map((e) => e.message).join('; ')}`);
    console.log('\nA type cannot be edited in place: delete that definition in Settings > Metafields, then re-run.');
    return 1;
  }

  console.log(
    `${created.length} created, ${existing.length} already present. ` +
      'All ten definitions now match what the theme reads.',
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`Cannot create metafield definitions: ${error.message}`);
      process.exit(2);
    });
}
