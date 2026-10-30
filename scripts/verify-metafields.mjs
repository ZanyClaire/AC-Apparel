#!/usr/bin/env node
/**
 * Checks the store against what the theme reads:
 *   1. the ten product metafield definitions, with the right types;
 *   2. active products, for a missing or broken digital-twin link.
 *
 *   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_... \
 *   node scripts/verify-metafields.mjs
 *
 * Optional: SHOPIFY_API_VERSION (default 2026-10), SHOPIFY_ADMIN_API_URL
 * (full endpoint override, used by the local tests).
 *
 * Exit codes: 0 all good, 1 definitions or products need attention,
 * 2 the check could not run.
 */

import { pathToFileURL } from 'node:url';

export const DEFINITIONS_QUERY = `
query ThemeMetafieldDefinitions($ownerType: MetafieldOwnerType!, $namespace: String, $first: Int, $after: String) {
  metafieldDefinitions(ownerType: $ownerType, namespace: $namespace, first: $first, after: $after) {
    nodes {
      name
      namespace
      key
      type { name }
      access { storefront }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;

export const PRODUCTS_QUERY = `
query ThemeTwinLinks($first: Int, $after: String) {
  products(first: $first, after: $after) {
    nodes {
      id
      title
      handle
      status
      isDigital: metafield(namespace: "custom", key: "is_digital_asset") { value }
      twin: metafield(namespace: "custom", key: "digital_twin") {
        value
        reference {
          ... on Product {
            id
            title
            handle
            status
            isDigital: metafield(namespace: "custom", key: "is_digital_asset") { value }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;

export const AVAILABILITY_QUERY = `
query TwinAvailability($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Product {
      id
      variants(first: 100) {
        nodes { availableForSale }
        pageInfo { hasNextPage }
      }
    }
  }
}
`;

export const COLLECTION_QUERY = `
query DigitalCollection($handle: String, $first: Int, $after: String) {
  collectionByIdentifier(identifier: { handle: $handle }) {
    id
    title
    products(first: $first, after: $after) {
      nodes { id }
      pageInfo { hasNextPage endCursor }
    }
  }
}
`;

/** key -> metafield type, matching theme/sections/main-product.liquid and product-card.liquid */
export const EXPECTED = [
  { key: 'digital_twin', type: 'product_reference', used: 'Digital Look tab, card badge, Buy digital only' },
  { key: 'is_digital_asset', type: 'boolean', used: 'Asset tabs, instant-download tag' },
  { key: 'digital_look', type: 'file_reference', used: 'Digital Look media' },
  { key: 'digital_look_caption', type: 'single_line_text_field', used: 'Media caption and alt' },
  { key: 'digital_format', type: 'single_line_text_field', used: 'What you receive panel' },
  { key: 'short_description', type: 'multi_line_text_field', used: 'PDP standfirst' },
  { key: 'specs', type: 'rich_text_field', used: 'Materials & construction accordion' },
  { key: 'material', type: 'single_line_text_field', used: 'Card meta line' },
  { key: 'fit', type: 'multi_line_text_field', used: 'Fit accordion' },
  { key: 'care', type: 'multi_line_text_field', used: 'Care & licence accordion' },
];

/** Types that keep a definition readable from Liquid. */
const LIQUID_ACCESS = new Set(['PUBLIC_READ', 'LEGACY_LIQUID_ONLY']);

class CheckError extends Error {}

function endpoint(env) {
  if (env.SHOPIFY_ADMIN_API_URL) return env.SHOPIFY_ADMIN_API_URL;
  const raw = env.SHOPIFY_STORE_DOMAIN;
  if (!raw) return null;
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) {
    throw new CheckError(`SHOPIFY_STORE_DOMAIN does not look like a store domain: ${raw}`);
  }
  const version = env.SHOPIFY_API_VERSION || '2026-10';
  return `https://${domain}/admin/api/${version}/graphql.json`;
}

async function post(url, token, query, variables) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new CheckError(`could not reach ${url}: ${error.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? ' (token missing, expired, or lacking metafield/product read access)'
        : '';
    throw new CheckError(`HTTP ${res.status}${hint}: ${text.slice(0, 400)}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new CheckError(`response was not JSON: ${text.slice(0, 200)}`);
  }
  if (payload.errors?.length) {
    throw new CheckError('GraphQL error: ' + payload.errors.map((e) => e.message).join('; '));
  }
  return payload.data ?? {};
}

async function paginate(url, token, query, field) {
  const nodes = [];
  let cursor = null;
  for (let page = 0; page < 50; page += 1) {
    const data = await post(url, token, query, { first: 100, after: cursor });
    const connection = data[field];
    if (!connection) throw new CheckError(`response had no ${field} field`);
    nodes.push(...(connection.nodes ?? []));
    if (!connection.pageInfo?.hasNextPage) return nodes;
    cursor = connection.pageInfo.endCursor;
  }
  throw new CheckError(`stopped after 50 pages of ${field}; the store looks unexpectedly large`);
}

export function fetchDefinitions({ url, token }) {
  return paginate(url, token, DEFINITIONS_QUERY, 'metafieldDefinitions');
}

export function fetchProducts({ url, token }) {
  return paginate(url, token, PRODUCTS_QUERY, 'products');
}

/** Availability for the twins that passed the link checks, in small batches to stay inside query cost limits. */
export async function fetchTwinAvailability({ url, token, ids }) {
  const result = new Map();
  for (let i = 0; i < ids.length; i += 5) {
    const data = await post(url, token, AVAILABILITY_QUERY, { ids: ids.slice(i, i + 5) });
    for (const node of data.nodes ?? []) {
      if (!node?.id) continue;
      const variants = node.variants?.nodes ?? [];
      result.set(node.id, {
        anyAvailable: variants.some((v) => v.availableForSale === true),
        complete: !node.variants?.pageInfo?.hasNextPage && variants.length > 0,
      });
    }
  }
  return result;
}

/** Product IDs inside the `digital` collection, or null when that collection does not exist. */
export async function fetchDigitalCollection({ url, token }) {
  const ids = new Set();
  let cursor = null;
  let meta = null;

  for (let page = 0; page < 20; page += 1) {
    const data = await post(url, token, COLLECTION_QUERY, { handle: 'digital', first: 250, after: cursor });
    const collection = data.collectionByIdentifier;
    if (!collection) return null;
    meta = { id: collection.id, title: collection.title };
    for (const node of collection.products?.nodes ?? []) ids.add(node.id);
    if (!collection.products?.pageInfo?.hasNextPage) break;
    cursor = collection.products.pageInfo.endCursor;
  }

  return { ids, ...meta };
}

export function compare(definitions) {
  const byKey = new Map(definitions.map((d) => [d.key, d]));
  return EXPECTED.map(({ key, type, used }) => {
    const found = byKey.get(key);
    if (!found) return { key, type, used, found: null, status: 'MISSING' };
    const foundType = found.type?.name ?? '(unknown)';
    if (foundType !== type) return { key, type, used, found: foundType, status: 'TYPE MISMATCH' };
    const access = found.access?.storefront ?? '(unknown)';
    if (!LIQUID_ACCESS.has(access)) {
      return { key, type, used, found: foundType, status: 'NO LIQUID ACCESS', access };
    }
    return { key, type, used, found: foundType, status: 'ok', access };
  });
}

/**
 * Garments must link to a twin that exists, is active, and is itself flagged as a
 * digital asset — otherwise the PDP either hides the digital panel or offers a
 * line that behaves like a parcel.
 */
export function compareProducts(products) {
  const findings = [];
  const twins = [];
  const active = products.filter((p) => p.status === 'ACTIVE');

  for (const product of active) {
    if (product.isDigital?.value === 'true') continue;

    const twin = product.twin;
    if (!twin?.value) {
      findings.push({
        handle: product.handle,
        title: product.title,
        issue: 'NO TWIN',
        detail: 'garment has no digital twin: no Digital Look tab and no digital offer on its PDP',
      });
      continue;
    }

    const reference = twin.reference;
    if (!reference?.id) {
      findings.push({
        handle: product.handle,
        title: product.title,
        issue: 'BROKEN TWIN',
        detail: 'digital_twin does not resolve to a product: wrong metafield type, deleted product, or a missing definition',
      });
      continue;
    }
    if (reference.id === product.id) {
      findings.push({
        handle: product.handle,
        title: product.title,
        issue: 'SELF TWIN',
        detail: 'digital_twin points at the product itself',
      });
      continue;
    }
    if (reference.isDigital?.value !== 'true') {
      findings.push({
        handle: product.handle,
        title: product.title,
        issue: 'TWIN NOT DIGITAL',
        detail: `twin ${reference.handle} is not flagged is_digital_asset, so it sells as a physical product`,
      });
      continue;
    }
    if (reference.status !== 'ACTIVE') {
      findings.push({
        handle: product.handle,
        title: product.title,
        issue: 'TWIN INACTIVE',
        detail: `twin ${reference.handle} is ${String(reference.status).toLowerCase()}, so Buy digital only is unavailable`,
      });
      continue;
    }

    twins.push({ garment: product.handle, id: reference.id, handle: reference.handle });
  }

  return { findings, twins, activeCount: active.length, skipped: products.length - active.length };
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function reportDefinitions(rows) {
  console.log(`  ${pad('definition', 30)} ${pad('expected type', 24)} ${pad('found', 24)} status`);
  for (const row of rows) {
    const name = `custom.${row.key}`;
    console.log(
      `  ${pad(name, 30)} ${pad(row.type, 24)} ${pad(row.found ?? '-', 24)} ${row.status}` +
        (row.access && row.status !== 'ok' ? ` (${row.access})` : ''),
    );
  }

  const problems = rows.filter((r) => r.status !== 'ok');
  console.log('');
  if (!problems.length) {
    console.log(`${rows.length}/${rows.length} definitions present with the expected types.`);
    return 0;
  }

  console.log(`${rows.length - problems.length}/${rows.length} ok, ${problems.length} to fix:`);
  for (const row of problems) {
    if (row.status === 'MISSING') {
      console.log(`  - custom.${row.key} is missing (create it as ${row.type}; used by: ${row.used})`);
    } else if (row.status === 'TYPE MISMATCH') {
      console.log(
        `  - custom.${row.key} is ${row.found}, the theme reads ${row.type}. ` +
          'Type cannot be changed in place: delete the definition, then re-create it.',
      );
    } else {
      console.log(
        `  - custom.${row.key} has storefront access ${row.access}; Liquid needs PUBLIC_READ or LEGACY_LIQUID_ONLY.`,
      );
    }
  }
  return 1;
}

function reportProducts({ findings, activeCount, skipped, collectionNote }) {
  console.log(`\nProducts: ${activeCount} active${skipped ? `, ${skipped} draft/archived skipped` : ''}`);
  if (collectionNote) console.log(`  ${collectionNote}`);
  if (!activeCount) {
    console.log('  nothing to check yet.');
    return 0;
  }  if (!findings.length) {
    if (!collectionNote) {
      console.log(`no twin-link issues across ${activeCount} active products.`);
      return 0;
    }
    console.log(`\n1 setup issue:\n  - ${collectionNote}`);
    return 1;
  }

  console.log(`  ${pad('handle', 30)} ${pad('issue', 22)} detail`);
  for (const finding of findings) {
    console.log(`  ${pad(finding.handle, 30)} ${pad(finding.issue, 22)} ${finding.detail}`);
  }
  console.log('');

  console.log(`${findings.length} product(s) need attention:`);
  for (const finding of findings) {
    console.log(`  - ${finding.handle}: ${finding.issue.toLowerCase()} — ${finding.detail}`);
  }
  return 1;
}

async function main() {
  const env = process.env;
  const url = endpoint(env);
  if (!url) {
    throw new CheckError(
      'set SHOPIFY_STORE_DOMAIN (e.g. your-store.myshopify.com) and SHOPIFY_ADMIN_TOKEN, ' +
        'or SHOPIFY_ADMIN_API_URL for a custom endpoint',
    );
  }
  if (!env.SHOPIFY_ADMIN_TOKEN && !env.SHOPIFY_ADMIN_API_URL) {
    throw new CheckError('SHOPIFY_ADMIN_TOKEN is not set');
  }

  const store = env.SHOPIFY_STORE_DOMAIN || url;
  const token = env.SHOPIFY_ADMIN_TOKEN ?? '';
  console.log(`Store: ${store}`);

  const definitions = await fetchDefinitions({ url, token });
  console.log(`${definitions.length} custom PRODUCT definition(s) returned\n`);
  const definitionProblems = reportDefinitions(compare(definitions));

  const products = await fetchProducts({ url, token });
  const check = compareProducts(products);
  let collectionNote = null;

  if (check.twins.length) {
    const availability = await fetchTwinAvailability({
      url,
      token,
      ids: [...new Set(check.twins.map((t) => t.id))],
    });
    const collection = await fetchDigitalCollection({ url, token });

    if (!collection) {
      collectionNote = 'collection "digital" not found: twins cannot appear in the Digital Wardrobe or the home strip';
    }

    for (const twin of check.twins) {
      const state = availability.get(twin.id);
      if (state?.complete && !state.anyAvailable) {
        check.findings.push({
          handle: twin.garment,
          issue: 'TWIN SOLD OUT',
          detail: `twin ${twin.handle} has no variant available for sale, so Buy digital only is disabled`,
        });
      }
      if (collection && !collection.ids.has(twin.id)) {
        check.findings.push({
          handle: twin.garment,
          issue: 'TWIN OUT OF COLLECTION',
          detail: `twin ${twin.handle} is not in the digital collection, so it is missing from the Digital Wardrobe`,
        });
      }
    }
  }

  const productProblems = reportProducts({ ...check, collectionNote });

  return definitionProblems || productProblems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`Cannot verify metafields: ${error.message}`);
      process.exit(2);
    });
}
