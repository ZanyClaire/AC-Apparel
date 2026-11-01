#!/usr/bin/env node
/**
 * Seeds one demo garment and its digital twin, plus the `digital` collection the
 * theme's wardrobe sections read.
 *
 *   SHOPIFY_STORE_DOMAIN=<handle>.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_... \
 *   node scripts/seed-demo.mjs
 *
 * Pass SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET instead of a token and one
 * is minted first. Creating products needs write_products, not just
 * read_products.
 *
 *   --dry-run     print the plan and change nothing
 *   --emit-csv    print a Shopify product CSV for Products > Import, which
 *                 needs no API scopes at all
 *
 * Safe to re-run: products are matched by handle and updated, not duplicated.
 *
 * Exit codes: 0 seeded, 1 something needs a human, 2 could not run.
 */

import { pathToFileURL } from 'node:url';
import { mintToken, storeDomain } from './mint-admin-token.mjs';

const GARMENT = {
  handle: 'demo-field-jacket',
  title: 'Field Jacket — Wool Gabardine',
  bodyHtml:
    '<p>Heavyweight wool gabardine field jacket, cut long and squared at the shoulder. ' +
    'Every one ships with a digital twin you can wear on screen before the parcel arrives.</p>',
  vendor: 'Aethel & Code',
  productType: 'Outerwear',
  tags: ['demo', 'garment'],
  price: '480.00',
  sku: 'DEMO-FJ-01',
  requiresShipping: true,
  metafields: {
    material: { type: 'single_line_text_field', value: 'Wool gabardine' },
    short_description: {
      type: 'multi_line_text_field',
      value: 'A long, square-shouldered field jacket in heavyweight wool gabardine.',
    },
    fit: {
      type: 'multi_line_text_field',
      value: 'Relaxed through the body, dropped shoulder. Size down for a closer line.',
    },
    care: {
      type: 'multi_line_text_field',
      value: 'Dry clean only. The digital twin is licensed for personal, non-commercial use.',
    },
  },
};

const TWIN = {
  handle: 'demo-field-jacket-digital',
  title: 'Field Jacket — Digital Twin',
  bodyHtml:
    '<p>The digital twin of the wool gabardine field jacket: rigged mesh, textures and a ' +
    'worn-once virtual fit. Delivered instantly as a download.</p>',
  vendor: 'Aethel & Code',
  productType: 'Digital asset',
  tags: ['demo', 'digital'],
  price: '45.00',
  sku: 'DEMO-FJ-01-DIGITAL',
  requiresShipping: false,
  metafields: {
    is_digital_asset: { type: 'boolean', value: 'true' },
    digital_format: { type: 'single_line_text_field', value: 'FBX · USDZ · 4K PBR textures' },
    short_description: {
      type: 'multi_line_text_field',
      value: 'Rigged mesh, 4K PBR textures and a virtual fit of the field jacket.',
    },
  },
};

const COLLECTION = { handle: 'digital', title: 'Digital Wardrobe' };

const CREATE_PRODUCT = `
mutation SeedProduct($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product { id handle }
    userErrors { field message code }
  }
}
`;

const FIND_PRODUCT = `
query FindProduct($handle: String!) {
  productByIdentifier(identifier: { handle: $handle }) { id handle }
}
`;

const PRODUCT_VARIANT = `
query SeedVariant($id: ID!) {
  product(id: $id) { variants(first: 1) { nodes { id } } }
}
`;

const SET_VARIANT_PRICE = `
mutation SeedPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    userErrors { field message }
  }
}
`;

const SET_METAFIELDS = `
mutation SeedMetafields($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    userErrors { field message code }
  }
}
`;

const FIND_COLLECTION = `
query FindCollection($handle: String!) {
  collectionByIdentifier(identifier: { handle: $handle }) { id handle }
}
`;

const CREATE_COLLECTION = `
mutation SeedCollection($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id handle }
    userErrors { field message }
  }
}
`;

const ADD_TO_COLLECTION = `
mutation SeedCollectionProducts($id: ID!, $productIds: [ID!]!) {
  collectionAddProducts(id: $id, productIds: $productIds) {
    userErrors { field message }
  }
}
`;

const PUBLICATIONS = `query SeedPublications { publications(first: 20) { nodes { id name } } }`;

const PUBLISH = `
mutation SeedPublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
  }
}
`;

class SeedError extends Error {}

function graphqlUrl(env) {
  if (env.SHOPIFY_ADMIN_API_URL) return env.SHOPIFY_ADMIN_API_URL;
  return `https://${storeDomain(env)}/admin/api/${env.SHOPIFY_API_VERSION || '2026-10'}/graphql.json`;
}

async function post(url, token, query, variables = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new SeedError(`could not reach ${url}: ${error.message}`);
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new SeedError(
      `HTTP ${res.status}: this token cannot write products. ` +
        'Add the write_products scope to the app, release the version and re-install, ' +
        'or import docs/demo-products.csv instead.',
    );
  }
  if (!res.ok) throw new SeedError(`HTTP ${res.status}: ${text.slice(0, 300)}`);

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new SeedError(`response was not JSON: ${text.slice(0, 200)}`);
  }
  if (payload.errors?.length) {
    const message = payload.errors.map((e) => e.message).join('; ');
    if (/access|scope|denied/i.test(message)) {
      throw new SeedError(
        `${message}. Creating products needs write_products; ` +
          'or import docs/demo-products.csv from the admin instead.',
      );
    }
    throw new SeedError(`GraphQL error: ${message}`);
  }
  return payload.data ?? {};
}

function userErrors(result, what) {
  const errors = result?.userErrors ?? [];
  if (!errors.length) return;
  const message = errors.map((e) => `${e.code ? `${e.code}: ` : ''}${e.message}`).join('; ');
  throw new SeedError(`${what}: ${message}`);
}

async function ensureProduct(url, token, spec) {
  const found = await post(url, token, FIND_PRODUCT, { handle: spec.handle });
  const existing = found.productByIdentifier;
  let id = existing?.id;

  if (id) {
    console.log(`  ${spec.handle}: exists, updating`);
  } else {
    const created = await post(url, token, CREATE_PRODUCT, {
      product: {
        title: spec.title,
        descriptionHtml: spec.bodyHtml,
        vendor: spec.vendor,
        productType: spec.productType,
        tags: spec.tags,
        handle: spec.handle,
        status: 'ACTIVE',
        productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
      },
    });
    userErrors(created.productCreate, `could not create ${spec.handle}`);
    id = created.productCreate.product.id;
    console.log(`  ${spec.handle}: created`);
  }

  const variantData = await post(url, token, PRODUCT_VARIANT, { id });
  const variant = variantData.product?.variants?.nodes?.[0];
  if (variant) {
    const priced = await post(url, token, SET_VARIANT_PRICE, {
      productId: id,
      variants: [
        {
          id: variant.id,
          price: spec.price,
          inventoryItem: { sku: spec.sku, requiresShipping: spec.requiresShipping },
        },
      ],
    });
    userErrors(priced.productVariantsBulkUpdate, `could not price ${spec.handle}`);
  }

  return id;
}

async function setMetafields(url, token, ownerId, fields) {
  const metafields = Object.entries(fields).map(([key, { type, value }]) => ({
    ownerId,
    namespace: 'custom',
    key,
    type,
    value,
  }));
  if (!metafields.length) return;
  const data = await post(url, token, SET_METAFIELDS, { metafields });
  userErrors(data.metafieldsSet, 'could not set metafields');
}

/** Shopify imports a product_reference from CSV as the referenced product's handle. */
function toCsv(rows) {
  const cell = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\n') + '\n';
}

function csvRows() {
  const columns = [
    'Handle',
    'Title',
    'Body (HTML)',
    'Vendor',
    'Type',
    'Tags',
    'Published',
    'Status',
    'Option1 Name',
    'Option1 Value',
    'Variant SKU',
    'Variant Price',
    'Variant Requires Shipping',
    'Variant Inventory Policy',
    'Variant Fulfillment Service',
    'Metafield: custom.digital_twin [product_reference]',
    'Metafield: custom.is_digital_asset [boolean]',
    'Metafield: custom.digital_format [single_line_text_field]',
    'Metafield: custom.short_description [multi_line_text_field]',
    'Metafield: custom.material [single_line_text_field]',
    'Metafield: custom.fit [multi_line_text_field]',
    'Metafield: custom.care [multi_line_text_field]',
  ];

  const row = (spec, extra) => {
    const m = (key) => spec.metafields[key]?.value ?? '';
    return [
      spec.handle,
      spec.title,
      spec.bodyHtml,
      spec.vendor,
      spec.productType,
      spec.tags.join(', '),
      'TRUE',
      'active',
      'Title',
      'Default Title',
      spec.sku,
      spec.price,
      spec.requiresShipping ? 'TRUE' : 'FALSE',
      'deny',
      'manual',
      extra.digitalTwin ?? '',
      m('is_digital_asset'),
      m('digital_format'),
      m('short_description'),
      m('material'),
      m('fit'),
      m('care'),
    ];
  };

  return [columns, row(GARMENT, { digitalTwin: TWIN.handle }), row(TWIN, {})];
}

async function seed(env) {
  const url = graphqlUrl(env);
  const token = env.SHOPIFY_ADMIN_TOKEN
    ? env.SHOPIFY_ADMIN_TOKEN
    : (
        await mintToken({
          domain: storeDomain(env),
          clientId: env.SHOPIFY_CLIENT_ID,
          clientSecret: env.SHOPIFY_CLIENT_SECRET,
        })
      ).token;

  const twinId = await ensureProduct(url, token, TWIN);
  const garmentId = await ensureProduct(url, token, GARMENT);

  await setMetafields(url, token, twinId, TWIN.metafields);
  await setMetafields(url, token, garmentId, {
    ...GARMENT.metafields,
    // Lands last so the reference points at a product that already exists.
    digital_twin: { type: 'product_reference', value: twinId },
  });
  console.log('  metafields: set on both products');

  const found = await post(url, token, FIND_COLLECTION, { handle: COLLECTION.handle });
  let collectionId = found.collectionByIdentifier?.id;
  if (collectionId) {
    console.log(`  collection ${COLLECTION.handle}: exists`);
  } else {
    const created = await post(url, token, CREATE_COLLECTION, {
      input: { title: COLLECTION.title, handle: COLLECTION.handle },
    });
    userErrors(created.collectionCreate, 'could not create the collection');
    collectionId = created.collectionCreate.collection.id;
    console.log(`  collection ${COLLECTION.handle}: created`);
  }

  const added = await post(url, token, ADD_TO_COLLECTION, {
    id: collectionId,
    productIds: [twinId, garmentId],
  });
  userErrors(added.collectionAddProducts, 'could not add products to the collection');
  console.log('  collection: twin and garment added');

  const publications = await post(url, token, PUBLICATIONS);
  const channels = publications.publications?.nodes ?? [];
  if (!channels.length) {
    console.log('  publish: no sales channels returned, skipped');
    return;
  }
  for (const [label, id] of [
    ['garment', garmentId],
    ['twin', twinId],
  ]) {
    const published = await post(url, token, PUBLISH, {
      id,
      input: channels.map((c) => ({ publicationId: c.id })),
    });
    userErrors(published.publishablePublish, `could not publish the ${label}`);
  }
  console.log(`  publish: both products pushed to ${channels.map((c) => c.name).join(', ')}`);
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => !['--dry-run', '--emit-csv'].includes(a));
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(' ')}`);
    return 2;
  }

  if (args.includes('--emit-csv')) {
    process.stdout.write(toCsv(csvRows()));
    return 0;
  }

  const env = process.env;
  console.log(`Store: ${env.SHOPIFY_STORE_DOMAIN || graphqlUrl(env)}`);

  if (args.includes('--dry-run')) {
    console.log('\nWould create or update:');
    for (const spec of [GARMENT, TWIN]) {
      console.log(`  product ${spec.handle} (${spec.price}, ${Object.keys(spec.metafields).join(', ')})`);
    }
    console.log(`  garment ${GARMENT.handle}.custom.digital_twin -> ${TWIN.handle}`);
    console.log(`  collection ${COLLECTION.handle} (${COLLECTION.title}) holding both products`);
    console.log('  publish both to every sales channel');
    return 0;
  }

  await seed(env);
  console.log('\nSeeded. Run the gate to verify:\n  node scripts/prelaunch.mjs');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`Cannot seed demo products: ${error.message}`);
      process.exit(2);
    });
}
