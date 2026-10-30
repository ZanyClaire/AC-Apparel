/* Package theme/ as a Shopify-uploadable zip.
   Shopify accepts only the theme directories at the archive root, and rejects
   unsupported files (the theme README, OS cruft). This writes a deterministic
   zip with an embedded integrity check, then verifies every entry. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const THEME = path.join(ROOT, 'theme');
const OUTPUT = path.join(ROOT, 'aethel-and-code-theme.zip');

// Directories Shopify recognises at the theme root.
const THEME_DIRS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const IGNORED = new Set(['README.md', '.DS_Store', 'Thumbs.db']);

/* ---------- crc32 ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ---------- collect ---------- */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = [];
for (const dir of THEME_DIRS) {
  const full = path.join(THEME, dir);
  if (!fs.existsSync(full)) continue;
  files.push(...walk(full));
}
files.sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.error('No theme files found.');
  process.exit(1);
}

/* ---------- build ---------- */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 30; // 2026-10-30

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const name = path.relative(THEME, file).split(path.sep).join('/');
  const data = fs.readFileSync(file);
  const compressed = zlib.deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const nameBuffer = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  local.writeUInt16LE(0, 28);

  localParts.push(local, nameBuffer, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt16LE(0, 30); // extra
  central.writeUInt16LE(0, 32); // comment
  central.writeUInt16LE(0, 34); // disk
  central.writeUInt16LE(0, 36); // internal attrs
  central.writeUInt32LE(0, 38); // external attrs
  central.writeUInt32LE(offset, 42);

  centralParts.push(central, nameBuffer);
  offset += local.length + nameBuffer.length + compressed.length;
}

const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralSize, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

const archive = Buffer.concat([...localParts, ...centralParts, eocd]);
fs.writeFileSync(OUTPUT, archive);

/* ---------- verify: re-read the archive and compare to disk ---------- */
const read = fs.readFileSync(OUTPUT);
const eocdOffset = read.length - 22;
const totalEntries = read.readUInt16LE(eocdOffset + 10);
const cdStart = read.readUInt32LE(eocdOffset + 16);

let cursor = cdStart;
const problems = [];
const seen = new Set();

for (let i = 0; i < totalEntries; i += 1) {
  if (read.readUInt32LE(cursor) !== 0x02014b50) {
    problems.push(`central header ${i} has a bad signature`);
    break;
  }
  const method = read.readUInt16LE(cursor + 10);
  const crc = read.readUInt32LE(cursor + 16);
  const compressedSize = read.readUInt32LE(cursor + 20);
  const size = read.readUInt32LE(cursor + 24);
  const nameLength = read.readUInt16LE(cursor + 28);
  const extraLength = read.readUInt16LE(cursor + 30);
  const commentLength = read.readUInt16LE(cursor + 32);
  const localOffset = read.readUInt32LE(cursor + 42);
  const name = read.slice(cursor + 46, cursor + 46 + nameLength).toString('utf8');

  seen.add(name);

  if (name.includes('\\')) problems.push(`${name}: backslash path separator`);
  if (path.posix.isAbsolute(name) || name.split('/').includes('..')) {
    problems.push(`${name}: unsafe path`);
  }
  if (!THEME_DIRS.includes(name.split('/')[0])) {
    problems.push(`${name}: top-level directory is not part of a theme`);
  }

  // local header
  const localNameLength = read.readUInt16LE(localOffset + 26);
  const localExtraLength = read.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const payload = read.slice(dataStart, dataStart + compressedSize);
  const inflated = method === 8 ? zlib.inflateRawSync(payload) : payload;

  if (method !== 8) problems.push(`${name}: unexpected compression method ${method}`);
  if (inflated.length !== size) problems.push(`${name}: size mismatch`);
  if (crc32(inflated) !== crc) problems.push(`${name}: CRC mismatch`);

  const source = fs.readFileSync(path.join(THEME, name));
  if (Buffer.compare(source, inflated) !== 0) problems.push(`${name}: content differs from source`);

  cursor += 46 + nameLength + extraLength + commentLength;
}

for (const file of files) {
  const name = path.relative(THEME, file).split(path.sep).join('/');
  if (!seen.has(name)) problems.push(`${name}: missing from archive`);
}

const included = [...seen].filter((n) => n === 'README.md' || IGNORED.has(path.basename(n)));
if (included.length) problems.push(`non-theme files included: ${included.join(', ')}`);

if (problems.length) {
  console.error(`Archive verification failed (${problems.length}):`);
  problems.forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}

const bytes = fs.statSync(OUTPUT).size;
console.log(`Wrote ${path.basename(OUTPUT)} — ${totalEntries} entries, ${(bytes / 1024).toFixed(1)} KB`);
console.log('Verified: CRC, sizes, paths and byte-for-byte content match theme/.');
