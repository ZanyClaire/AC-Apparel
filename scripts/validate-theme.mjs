/* Structural checks for the Shopify theme. No Shopify account required. */
import fs from 'node:fs';
import path from 'node:path';

const THEME = path.resolve('theme');
const errors = [];
const warnings = [];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(THEME);
const rel = (file) => path.relative(THEME, file).replace(/\\/g, '/');

/* ---------- 1. JSON files ---------- */
for (const file of files.filter((f) => f.endsWith('.json'))) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    JSON.parse(raw);
  } catch (error) {
    errors.push(`${rel(file)}: invalid JSON — ${error.message}`);
  }
}

/* ---------- 2. schemas + tag balance ---------- */
const BLOCKS = {
  if: 'endif',
  unless: 'endunless',
  for: 'endfor',
  case: 'endcase',
  form: 'endform',
  paginate: 'endpaginate',
  capture: 'endcapture',
  comment: 'endcomment',
  schema: 'endschema',
  tablerow: 'endtablerow',
  style: 'endstyle',
  stylesheet: 'endstylesheet',
  javascript: 'endjavascript',
  ifchanged: 'endifchanged',
  raw: 'endraw'
};
const CLOSERS = new Set(Object.values(BLOCKS));

const liquidFiles = files.filter((f) => f.endsWith('.liquid') || f.endsWith('.css.liquid'));

for (const file of liquidFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const body = src.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, '');
  const stack = [];

  const tagRe = /\{%-?\s*(\w+)/g;
  let match;
  while ((match = tagRe.exec(body))) {
    const tag = match[1];
    if (BLOCKS[tag]) {
      stack.push({ tag, index: match.index });
    } else if (CLOSERS.has(tag)) {
      const open = stack.pop();
      if (!open) {
        errors.push(`${rel(file)}: closing {% ${tag} %} without an opener`);
      } else if (BLOCKS[open.tag] !== tag) {
        errors.push(`${rel(file)}: {% ${open.tag} %} closed by {% ${tag} %}`);
      }
    }
  }
  if (stack.length) {
    errors.push(
      `${rel(file)}: unclosed ${stack.map((s) => '{% ' + s.tag + ' %}').join(', ')}`
    );
  }

  const opens = (src.match(/\{%-?/g) || []).length;
  const closes = (src.match(/-?%\}/g) || []).length;
  if (opens !== closes) errors.push(`${rel(file)}: unbalanced Liquid tag delimiters`);

  const outOpens = (src.match(/\{\{/g) || []).length;
  const outCloses = (src.match(/\}\}/g) || []).length;
  if (outOpens !== outCloses) errors.push(`${rel(file)}: unbalanced {{ }} delimiters`);

  // schema JSON
  const schemaMatch = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (schemaMatch) {
    try {
      JSON.parse(schemaMatch[1]);
    } catch (error) {
      errors.push(`${rel(file)}: invalid {% schema %} JSON — ${error.message}`);
    }
  } else if (src.includes('{% schema %}') && !src.includes('{% endschema %}')) {
    errors.push(`${rel(file)}: schema block is not closed`);
  }
}

/* ---------- 3. references ---------- */
const sectionNames = new Set(
  files.filter((f) => rel(f).startsWith('sections/')).map((f) => path.basename(f, '.liquid'))
);
const snippetNames = new Set(
  files.filter((f) => rel(f).startsWith('snippets/')).map((f) => path.basename(f, '.liquid'))
);
const assetNames = new Set(files.filter((f) => rel(f).startsWith('assets/')).map((f) => path.basename(f)));
const normalisedAssets = new Set([...assetNames].map((n) => n.replace(/\.liquid$/, '')));

for (const file of liquidFiles) {
  const src = fs.readFileSync(file, 'utf8');

  for (const m of src.matchAll(/\{%-?\s*render\s+'([^']+)'/g)) {
    if (!snippetNames.has(m[1])) errors.push(`${rel(file)}: render '${m[1]}' — snippet not found`);
  }
  for (const m of src.matchAll(/\{%-?\s*section\s+'([^']+)'/g)) {
    if (!sectionNames.has(m[1])) errors.push(`${rel(file)}: section '${m[1]}' — section not found`);
  }
  for (const m of src.matchAll(/'([\w.-]+\.(?:css|js|svg|png|jpg|webp))'\s*\|\s*asset_url/g)) {
    if (!normalisedAssets.has(m[1])) {
      warnings.push(`${rel(file)}: asset_url '${m[1]}' not found in assets/`);
    }
  }
}

/* ---------- 4. templates reference real sections ---------- */
for (const file of files.filter((f) => rel(f).startsWith('templates/') && f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const declared = new Set(Object.keys(data.sections || {}));
  for (const [id, section] of Object.entries(data.sections || {})) {
    if (!sectionNames.has(section.type)) {
      errors.push(`${rel(file)}: section "${id}" has unknown type "${section.type}"`);
    }
    if (section.blocks && section.block_order) {
      for (const blockId of Object.keys(section.blocks)) {
        if (!section.block_order.includes(blockId)) {
          warnings.push(`${rel(file)}: block "${blockId}" is not in block_order`);
        }
      }
    }
  }
  for (const id of data.order || []) {
    if (!declared.has(id)) errors.push(`${rel(file)}: order references missing section "${id}"`);
  }
}

/* ---------- 5. layout + locale sanity ---------- */
if (!fs.existsSync(path.join(THEME, 'layout/theme.liquid'))) {
  errors.push('layout/theme.liquid is missing (required to upload a theme)');
}

const localeFile = path.join(THEME, 'locales/en.default.json');
if (fs.existsSync(localeFile)) {
  const locale = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
  const flat = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([key, value]) =>
      value && typeof value === 'object' ? flat(value, `${prefix}${key}.`) : [`${prefix}${key}`]
    );
  const keys = new Set(flat(locale));

  for (const file of liquidFiles) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/'([a-z0-9_.]+)'\s*\|\s*t\b/g)) {
      if (!keys.has(m[1])) errors.push(`${rel(file)}: translation key '${m[1]}' missing in locale file`);
    }
  }
}

/* ---------- report ---------- */
console.log(`Checked ${files.length} files (${liquidFiles.length} Liquid, ${files.filter((f) => f.endsWith('.json')).length} JSON).`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log('  ~ ' + w));
}

if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.log('  ✗ ' + e));
  process.exit(1);
}

console.log('\nNo structural errors.');
