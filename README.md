# Aethel &amp; Code — storefront + Shopify theme

A quiet-luxury / gorpcore shop where every physical garment ships with a digital twin.

- **`theme/`** — a Shopify OS 2.0 theme: sections, JSON templates, product template with the Digital Look tab and metafield-driven twin logic, cart drawer. See [theme/README.md](theme/README.md) for install steps and the metafield contract.
- **Root** — the original static storefront, kept as a design reference and for quick local preview. No build step, no dependencies.

```bash
node server.js          # http://localhost:4173
```

## What is here

| Page | File | Notes |
| --- | --- | --- |
| Home | `index.html` | Video-scale hero (generated terrain art), pillars, editorial collections, phygital explainer, digital wardrobe strip |
| Shop | `shop.html` | Live category filters + sorting, 8 garments |
| Product | `product.html?p=slug` | Images / **Digital Look** tabs, colourways, sizes, dual CTA (physical + digital-only) |
| Digital Wardrobe | `digital-wardrobe.html` | Lookbook grid of the 4 digital-only pieces, formats & licence |
| About | `about.html` | Story, materials, digital-twin position |
| Contact | `contact.html` | Validated enquiry form, studio details |
| Policies | `policies.html` | Shipping rates, 30-day returns, **digital delivery**, licence, repairs |

Shared:

- `assets/css/site.css` — design tokens, type scale, plate system, all layout
- `assets/js/data.js` — the catalog: prices, colourways, sizes, specs, digital twins
- `assets/js/site.js` — chrome, cart (localStorage), shop filtering, PDP rendering, forms
- `assets/img/contours.svg`, `assets/img/grain.svg` — the art overlays

## Design decisions

- **Palette** — warm bone `#f4f1ea`, charcoal `#1a1b18`, stone, and a single deep forest accent used only for focus rings, the cart badge and digital markers.
- **Type** — Newsreader (a Canela/Plantin-adjacent serif) for display; Inter for body and 0.6875rem uppercase micro-labels with wide tracking.
- **Motion** — a single slow drift on the hero contour layer, plate parallax on hover, and a one-shot reveal. All of it collapses under `prefers-reduced-motion`.
- **Art** — the atmospheric "plates" are generated in CSS from layered gradients, contour lines and film grain, with a wireframe/mannequin treatment for anything digital. They stand in for the cinematic photography the brief calls for: swap each `.plate` for a real `<img>`/`<video>` and the composition, crop and hover behaviour stay identical.
- **Typography is remote** (Google Fonts). Self-host Newsreader and Inter before launch for privacy and performance.

## Cart behaviour

- Physical piece → adds at garment price, labelled "digital look included".
- "Buy digital only" → adds the same product's twin at `twin.price`.
- A digital-only product adds at its own price with "instant delivery".
- Flat £8 shipping, free over £250, persisted in `localStorage`. The checkout button is intentionally not connected — it points at where Shopify's checkout goes.

## Shopify theme

`theme/` is the production target: an OS 2.0 theme carrying the same design system, built as sections and JSON templates with the phygital product model wired to metafields. Install steps, required collections and the full metafield contract (`custom.digital_twin`, `custom.digital_look`, `custom.is_digital_asset`, and the rest) live in [theme/README.md](theme/README.md). The step-by-step launch checklist — collections, menus, pages, metafield definitions and pre-launch QA — is in [docs/store-setup.md](docs/store-setup.md).

Validate the theme without a store:

```bash
node scripts/validate-theme.mjs   # JSON, Liquid balance, section/snippet references
```

The full pre-launch gate is `node scripts/prelaunch.mjs`: the theme checks above, then the live store audit (metafield definitions and digital-twin links). It needs `SHOPIFY_STORE_DOMAIN` plus either `SHOPIFY_ADMIN_TOKEN` or the app's `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`, from which a 24-hour token is minted; pass `--theme-only` when there is no store yet. Both checks exit `0` when clean, `1` on problems, `2` when they cannot run.

CI runs the same gate on every push ([.github/workflows/prelaunch.yml](.github/workflows/prelaunch.yml)). Shopify issues no long-lived token to copy for an app created in the Dev Dashboard, so the workflow holds `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` as repository secrets under Settings → Secrets and variables → Actions and mints a token per run; it fails with a named error if any is missing rather than reporting an unverified pass.

Pull requests run a lighter workflow, [.github/workflows/theme-check.yml](.github/workflows/theme-check.yml), which executes only the static theme checks and references no secrets at all — so a contributor without store access, including one opening a PR from a fork, still gets a pass or fail on their change.

The static pages in the repository root remain the visual reference and a quick way to review interactions without a Shopify store.

## Publishing

The static storefront is published on Freebuff Sites; the site ID and both environment URLs are recorded in [freebuff-site.json](freebuff-site.json). Build the uploadable output with:

```bash
node scripts/build-sites.mjs   # writes freebuff-sites-build/{assets,worker.js,manifest.json}
```

Only the static storefront is uploaded — the Shopify theme cannot run on Workers, so the build whitelist excludes `theme/`, `scripts/` and the dev server. The Worker serves assets and resolves `.html` requests to Cloudflare's pretty-URL assets in one hop, so internal links report 200 instead of a redirect.

## Known gaps

**Static reference build**

- Cart is client-side (`localStorage`); checkout is a signpost, not a transaction.
- Contact and newsletter forms validate in the browser only.
- Photography is generated art (see Design decisions), not the final campaign.

**Shopify theme**

- Including the digital twin free with a garment needs a cart transform, bundle app or post-purchase automation — theme code can express the offer but cannot price a line at zero. Details in [theme/README.md](theme/README.md).
- Filtering on collection pages is page-scoped (client-side chips). Shopify's native filter API can replace it once filters are configured in Search & Discovery.
- Theme-check passes with 3 `RemoteAsset` warnings for the Google Fonts stylesheet; self-host fonts to clear them.
