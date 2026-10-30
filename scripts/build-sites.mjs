/* Build the public storefront for Freebuff Sites.
   Only the static storefront is deployable to Workers — the Shopify theme
   in theme/ is not, so it must never reach the asset directory. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'freebuff-sites-build');
const PUBLIC = path.join(OUT, 'assets');

const FILES = [
  'index.html',
  'shop.html',
  'product.html',
  'digital-wardrobe.html',
  'about.html',
  'contact.html',
  'policies.html',
  'assets/css/site.css',
  'assets/js/data.js',
  'assets/js/site.js',
  'assets/img/contours.svg',
  'assets/img/grain.svg'
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(PUBLIC, { recursive: true });

let bytes = 0;
for (const relative of FILES) {
  const source = path.join(ROOT, relative);
  if (!fs.existsSync(source)) {
    console.error(`Missing required file: ${relative}`);
    process.exit(1);
  }
  const destination = path.join(PUBLIC, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  bytes += fs.statSync(source).size;
}

// Workers entrypoint: static assets only.
// Workers entrypoint: static assets only.
// The asset layer publishes pretty URLs and 307s *.html requests to them.
// Internal links keep their .html form, so resolve them here instead of
// sending the browser through a redirect on every navigation.
fs.writeFileSync(
  path.join(OUT, 'worker.js'),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('.html')) {
      url.pathname = url.pathname === '/index.html' ? '/' : url.pathname.slice(0, -5);
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }
    return env.ASSETS.fetch(request);
  }
};
`
);

fs.writeFileSync(
  path.join(OUT, 'manifest.json'),
  JSON.stringify(
    {
      entrypoint: 'worker.js',
      compatibilityDate: '2026-10-01',
      compatibilityFlags: [],
      modules: [{ name: 'worker.js', type: 'esm', path: 'worker.js' }],
      assetsDirectory: 'assets',
      spa: false
    },
    null,
    2
  ) + '\n'
);

fs.writeFileSync(path.join(OUT, '.freebuff-generated'), 'Freebuff Sites build output\n');

const files = fs.readdirSync(PUBLIC, { recursive: true }).filter((f) => {
  const stat = fs.statSync(path.join(PUBLIC, f));
  return stat.isFile();
});

console.log(`Built ${files.length} asset files (${(bytes / 1024).toFixed(1)} KB) into ${path.relative(ROOT, PUBLIC)}`);
