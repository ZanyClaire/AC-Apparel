# Aethel & Code — Shopify OS 2.0 theme

The storefront in this repo's root was the design reference. This directory is the Shopify theme: same design system, rebuilt as sections, snippets and JSON templates with the phygital product model wired to metafields.

## Install

```bash
shopify theme push --path theme --store your-store.myshopify.com
# or, to work against an unpublished preview theme:
shopify theme dev --path theme --store your-store.myshopify.com
```

Without the CLI: upload the prepared archive in the repo root, **`aethel-and-code-theme.zip`**, under Online Store → Themes → Add theme → Upload zip. It contains the seven theme directories at the archive root, with this README excluded — Shopify rejects unsupported files such as `.md` in a theme upload. Rebuild it after changes with:

```bash
node scripts/package-theme.mjs   # writes and verifies aethel-and-code-theme.zip
```

## Shopify setup this theme expects

1. **Collections**: `frontpage` (default), plus `outerwear`, `trousers`, `digital`. The home page and the collection grid point at these; missing collections render a "choose a collection" placeholder rather than breaking.
2. **Menus**: `main-menu` (header) and `footer` (footer + mobile).
3. **Pages** to exist for the alternate templates: `about` (assign `page.about`), `shipping-returns` (assign `page.policies`), `contact` (assign `page.contact`).
4. **Products**: physical garments and digital-only assets are separate products. Digital-only products must have **This is a physical product** unchecked, so no shipping is charged.

## Metafield definitions

Create these in Settings → Custom data → Products. All use the `custom` namespace; the theme reads them defensively, so any that are missing simply hide their UI.

| Key | Type | Used for |
| --- | --- | --- |
| `custom.digital_twin` | Product reference | Links a garment to its digital-only product. Enables the "Buy digital only" CTA and the Digital Look tab. |
| `custom.digital_look` | File (image or video) | Media shown in the product's **Digital Look** tab. Falls back to generated wireframe art. |
| `custom.digital_look_caption` | Single line text | Caption over the digital look media. |
| `custom.is_digital_asset` | Boolean | Marks a product as a digital asset: changes the tab labels, hides size/shipping cues, tags cart lines "Instant download". |
| `custom.digital_format` | Single line text | Format/delivery line on digital products ("CLO 3D + OBJ/FBX, delivered instantly"). |
| `custom.short_description` | Multi-line text | Standfirst under the product title (falls back to the first 42 words of the description). |
| `custom.specs` | Rich text | Materials & construction accordion. |
| `custom.fit` | Multi-line text | Fit accordion. |
| `custom.care` | Multi-line text | Care & licence accordion. |
| `custom.material` | Single line text | Card meta line ("Italian wool, 320gsm"). |

Suggested values for a garment:

- `digital_twin` → *The Digital Cirque* (product)
- `digital_look` → a render or short loop of the asset on an avatar
- `digital_look_caption` → "Digital look — avatar preview"

## The product template

`templates/product.json` → `sections/main-product.liquid`:

- **Images / Digital Look tabs** — the second tab only renders when the product has a `digital_twin`, a `digital_look` file, or is itself a digital asset (and `enable_digital_look` is on).
- **Variant picker** — option values render as colour swatches when Shopify has swatch data (`value.swatch.color`), otherwise as text buttons. Availability is recalculated per option client-side; sold-out combinations are disabled.
- **Dual CTA** — "Add to cart" posts to `/cart/add.js`; "Buy digital only — £45" posts the twin's variant with a `Delivery: Instant download` line property. Both open the cart drawer.
- **Accordions** — native `<details>`: description/specs, fit, care, delivery.

## What the theme cannot do alone

Shopify line items cannot mix fulfilment types, so **including the digital twin free with a garment needs a backend rule**, not theme code. The theme expresses the offer (copy, Digital Look tab, secondary CTA); pick one of:

- **Cart transform function** (Shopify Plus): add the twin product as a £0 line whenever a garment is present.
- **A bundle/auto-gift app** (works on standard plans): "buy X get Y free", scoped to twin products.
- **Order-confirmation automation**: a Flow or fulfilment app emails the asset after checkout.

Configure one before launch, or turn off *Digital twin is included* in Theme settings → Product pages so the copy does not promise it.

## Sections

| Section | Purpose |
| --- | --- |
| `header` | Wordmark/logo, primary menu, cart count, mobile menu, announcement |
| `footer` | Brand text, menu blocks, payment icons |
| `hero` | Image, muted background video, or generated terrain art; up to 2 CTAs |
| `pillars` | Numbered commitments |
| `collections-feature` | Asymmetric collection grid (first block tall) |
| `featured-products` | Product grid from a collection |
| `phygital-split` | Physical/digital pairing card, product-driven captions and price |
| `digital-wardrobe` | Dark strip of digital products |
| `quote` | Centred pull quote |
| `newsletter` | Shopify customer form |
| `main-product` | PDP |
| `related-products` | Same-collection recommendations |
| `main-collection` | Grid, category chips, native sort |
| `main-cart` | Cart page |
| `main-page`, `page-hero`, `contact-form` | Content pages |

## Design notes

- Generated "terrain plates" (`snippets/plate.liquid`) stand in wherever photography is missing, so a new store looks composed before assets are uploaded. Uppercase product media with real photography and the plates disappear.
- Typography loads Newsreader + Inter from Google Fonts, with the family names editable in Theme settings. Self-host before launch if you care about third-party requests.
- Cart drawer, variant picker, filters and tabs are vanilla JS (`assets/theme.js`); there is no build step and no dependency.
