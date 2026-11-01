# Store setup checklist — Aethel & Code theme

Everything the theme reads from the store, in the order it has to happen. Metafield **definitions must exist before you enter values**, and values must exist before the theme can render the digital panels, so the order below is not arbitrary.

This starts after the theme is uploaded as an unpublished theme (Admin → Online Store → Themes → Add theme → Upload zip, or `shopify theme push`). See [theme/README.md](../theme/README.md#install).

---

## 0. Decide two things first

- [ ] **Currency.** All copy defaults to GBP (`£250` free-shipping threshold, `£45`-style twin pricing comes from the product itself). If the store sells in another currency, edit the theme copy in step 6 — prices themselves always come from Shopify, so they are correct either way.
- [ ] **Is the digital twin free with a garment?** The theme can *describe* that offer but cannot price a line at zero. If you have no cart transform, bundle app or post-purchase automation, leave **Digital twin is included** off in theme settings so product pages read "Available separately for £45" instead. See [Known constraints](#known-constraints).

---

## Install the theme

Two routes, both fed from `theme/` in this repo.

**GitHub connection (recommended).** Shopify's GitHub integration only accepts a theme whose files sit at the **root of the connected branch**. This repo's root is the static storefront, with the theme nested in `theme/`, so connecting `main` fails with *"Branch isn't a valid theme"*. [.github/workflows/publish-theme.yml](../.github/workflows/publish-theme.yml) mirrors `theme/` onto a generated **`shopify-theme`** branch on every push that touches `theme/`, after the theme checks pass.

1. Push to `main` (or run the **Publish theme branch** workflow manually) and confirm the `shopify-theme` branch exists.
2. Admin → **Online Store → Themes → Add theme → Connect from GitHub** → authorise the GitHub app for `ZanyClaire/AC-Apparel` if asked → branch **`shopify-theme`**.
3. Shopify imports it as an unpublished theme. Preview it, then **Publish** when you're ready.

Rules that follow from the mirror:

- Edit `theme/` on `main`. Never edit the `shopify-theme` branch — it is rebuilt from scratch on each push, so anything committed there is discarded.
- Edits made in Shopify's code editor on a connected theme are commits on that branch, and the next mirror overwrites them. Make theme edits in this repo instead.
- The mirror is flat: `theme/layout` becomes `/layout` on the branch, and `theme/README.md` stays behind because it documents the theme rather than being part of it.

**Upload a zip.** `aethel-and-code-theme.zip` in the repo root holds the same 52 files (the theme minus its README). Upload it with **Themes → Add theme → Upload zip** — useful for a one-off install or a client who has no repo access. Rebuild it after theme edits:

```bash
cd theme && zip -r ../aethel-and-code-theme.zip . -x 'README.md' && cd ..
```

---

## 1. Metafield definitions

Admin → **Settings → Custom data → Products → Add definition**. The namespace must be `custom` — the theme reads `product.metafields.custom.*` literally. If a type is wrong the value silently renders blank, so match these exactly.

| Definition (key) | Type | Where it appears | Required |
| --- | --- | --- | --- |
| `digital_twin` | Product — single reference | Links a garment to its 3D asset. Drives the *Digital Look* tab, the card badge, and the "Buy digital only" CTA with its price. | Garments only |
| `is_digital_asset` | Boolean | Marks a product as the asset itself. Flips the PDP tabs to *Asset preview* / *What you receive*, shows "Instant download" on cards. | Asset products |
| `digital_look` | File — single reference (image **or** video) | The media in the digital panel. Video is detected via `.sources` and autoplays muted/looped; anything else is treated as an image. | Optional |
| `digital_look_caption` | Single line text | Caption under that media (also used as alt text). | Optional |
| `digital_format` | Single line text | Formats line in the asset panel, e.g. `FBX · USDZ · 4K PBR`. Falls back to "Files delivered instantly". | Recommended |
| `short_description` | Multi-line text | Lead paragraph at the top of the product info column, above the buy buttons. Plain text, so no HTML. Falls back to the first 42 words of the description. | Recommended |
| `specs` | Rich text | Contents of the *Materials & construction* accordion. Falls back to the product description if empty. | Recommended |
| `material` | Single line text | Small line under the product name on cards (e.g. `Wool gabardine`). Falls back to product type/vendor. | Optional |
| `fit` | Multi-line text | The *Fit* accordion. The accordion is hidden entirely when empty. | Optional |
| `care` | Multi-line text | The *Care & licence* accordion. Hidden when empty. | Optional |

**Create all ten in one go.** Run the script with app credentials that carry the `write_products` scope:

```bash
SHOPIFY_STORE_DOMAIN=<handle>.myshopify.com \
SHOPIFY_CLIENT_ID=... SHOPIFY_CLIENT_SECRET=shps_... \
node scripts/define-metafields.mjs
```

It creates whichever definitions are missing, reports `exists` for the ones already there, and is safe to re-run after fixing a type. `--dry-run` lists what it would create without touching the store. Read-only credentials are rejected up front with a message naming the missing scope, so nothing is half-written.

**Or paste it by hand.** [metafield-definitions.graphql](metafield-definitions.graphql) contains one `metafieldDefinitionCreate` call per definition above. Install Shopify's free [GraphiQL app](https://shopify-graphiql-app.shopifycloud.com/), paste the whole document, and click Run — each alias reports its own `userErrors`, and re-running only returns `TAKEN` for definitions that already exist. There is no native CSV import for definitions: Shopify's product CSV can only write values *after* a definition exists, and bulk-import apps require the definitions first too. The manual route is Settings → Custom data → Products → Add definition, ten times.

Checklist:

- [ ] All ten definitions created, namespace `custom`, types as above.
- [ ] Definitions set to *storefront*-visible (default) — a non-visible definition returns `nil` in Liquid.
- [ ] No definition reuses a key from this table with a different type.

**Verify them.** [scripts/verify-metafields.mjs](../scripts/verify-metafields.mjs) asks the Admin API for every `custom` product definition, prints each one with its expected and actual type, then checks active products for a missing or broken twin link:

```bash
SHOPIFY_STORE_DOMAIN=<handle>.myshopify.com \
SHOPIFY_CLIENT_ID=... SHOPIFY_CLIENT_SECRET=shps_... \
node scripts/verify-metafields.mjs
```

Pass `SHOPIFY_ADMIN_TOKEN=shpat_...` instead of the two app values if you already hold a token; otherwise `node scripts/prelaunch.mjs` and this script mint one from the app credentials first. That is the only route now: apps created in the [Dev Dashboard](https://dev.shopify.com) never display a copyable Admin API token, so the Client ID and secret from the app's **Settings** page are traded for a 24-hour `shpat_` token at `/admin/oauth/access_token`. The app must be installed on the store, with a released version carrying the `read_products` scope, and it must belong to the same Shopify organization as the store — otherwise Shopify answers `application_cannot_be_found` or `shop_not_permitted`.

Exit `0` means all ten match and no twin link is broken; `1` lists what to fix. On the definition side: a missing key, a wrong type, or storefront access `NONE` (which hides the value from Liquid). On the product side: a garment with no `digital_twin`, a twin that doesn't resolve to a product, a twin that isn't flagged `is_digital_asset`, a twin that is draft or archived, or a twin pointing at the product itself. Draft and archived products are skipped.

Each valid twin is then checked twice more: whether any of its variants is available for sale (otherwise "Buy digital only" renders disabled), and whether it is a member of the `digital` collection (otherwise it never appears in the Digital Wardrobe or the home strip). If that collection doesn't exist at all, the check says so once instead of repeating it per product. Availability reads up to 100 variants per twin; if a twin has more and none of those are available, the result is treated as unknown rather than reported, so the check never guesses.

Exit `2` means the check itself could not run: bad token, HTTP error or GraphQL error. The token only needs product read access, is read from the environment, and is never written to disk by the script. A wrong type cannot be edited in place, so delete that definition, re-create it, and re-run until the output is 10/10 with no twin-link issues.

No token to hand? Paste this into the GraphiQL app and compare the `type.name` column with the table above:

```graphql
{
  metafieldDefinitions(ownerType: PRODUCT, namespace: "custom", first: 100) {
    nodes { key name type { name } access { storefront } }
  }
}
```

> Note: `short_description`, `fit` and `care` render as plain text inside `<p>` tags. Do not put line breaks or HTML in them — use `specs` (rich text) for structured content.

---

## 2. Pages and their templates

Admin → **Online Store → Pages**. The handle matters because the theme's navigation examples point at it; the template is a separate dropdown (*Theme template*) that must be assigned after the page exists.

| Page title | Handle | Theme template | Used for |
| --- | --- | --- | --- |
| About | `about` | `about` | Brand story with the hero treatment (`page.about`). |
| Contact | `contact` | `contact` | Contact form + studio details (`page.contact`). Posts natively to Shopify, no app needed. |
| Shipping & Returns | `shipping-returns` | `policies` | Delivery windows, returns, digital-licence terms (`page.policies`). |

- [ ] Three pages created with those handles.
- [ ] Theme template assigned on each (the default `page` template is a plain article-style page and looks unfinished for these).
- [ ] Shop policies filled in under **Settings → Policies** (refund, privacy, terms) — Shopify serves these at `/policies/…` and they are linked from checkout.

---

## 3. Collections

Admin → **Products → Collections**. Handles are load-bearing: `digital` is **hardcoded** in [digital-wardrobe.liquid](../theme/sections/digital-wardrobe.liquid), so renaming it blanks the home page's digital strip. The other three are defaults you can repoint in the theme editor, but creating them as named keeps the stock templates working.

| Handle | Build it as | What it powers | Suggested contents |
| --- | --- | --- | --- |
| `frontpage` | Manual | Home "featured" section | 4–8 pieces, mixed garments and assets |
| `outerwear` | Automated: product type = `Outerwear` | Home collection block 1; source of "Continue" related products | Coats, jackets, overshirts |
| `trousers` | Automated: product type = `Trousers` | Home collection block 2 | Trousers, shorts |
| `digital` | Automated: product type = `Digital` | Home digital strip **and** the Digital Wardrobe nav target | Every asset product, including twins |

**Fastest route:** paste [storefront-setup.graphql](storefront-setup.graphql) into [GraphiQL](https://shopify-graphiql-app.shopifycloud.com/) and Run. It creates `digital`, `outerwear` and `trousers` (all manual — the API cannot set automation rules at creation), the three pages the menus link to, and both menus. `frontpage` already exists in every new store. Add the product-type rule later in the collection's edit screen if you want them to fill themselves.

- [ ] All four collections exist with these exact handles.
- [ ] Each has a title, description and image — collection pages render the description, and the home blocks show the image.
- [ ] `digital` contains every product with `is_digital_asset = true`.
- [ ] Every physical garment belongs to at least one collection — related products are drawn from the product's **first** collection, so an uncollected garment gets no "Continue" row.

`/collections/all` is built into Shopify and needs no setup; use it for the *Shop* nav item.

---

## 4. Products

**Seed demo content.** `node scripts/seed-demo.mjs` creates one garment and its twin, links `custom.digital_twin`, and puts both in the `digital` collection. It matches products by handle, so re-running updates rather than duplicates, and it needs the `write_products` scope.

Without that scope, import [demo-products.csv](demo-products.csv) instead — **Products → Import** in the admin, which uses your own login rather than an API token. It creates the same two products, prices and metafield values; the twin reference is written as the referenced product's handle. The CSV cannot create the collection, so afterwards make one with handle `digital` and add the twin to it. `node scripts/seed-demo.mjs --emit-csv` regenerates the file if the demo copy changes.

### 4a. Garment

- [ ] Title, **Product type** (`Outerwear` or `Trousers`) — the collection chips are built from `collection.all_types`, so inconsistent casing creates duplicate chips like `outerwear` and `Outerwear`.
- [ ] Price, and variants only where a real size/colour choice exists. Colour swatches appear automatically when Shopify provides swatch data; sold-out combinations are disabled as the customer selects.
- [ ] At least one image, with alt text. Without one the card falls back to a generated plate, which is intentional but not a substitute for product photography.
- [ ] `short_description`, `specs`, `fit`, `care`, `material`.
- [ ] `digital_twin` → the asset product.
- [ ] Inventory tracked per variant if you sell limited runs (sold-out badges come from availability).

### 4b. Digital asset / twin

- [ ] `is_digital_asset` = **true**.
- [ ] Price set (the PDP's secondary CTA shows `twin_variant.price`).
- [ ] **Uncheck "This is a physical product"** — a physical twin will demand a shipping address at checkout. Inventory tracking off unless you deliberately limit licences.
- [ ] `digital_format`, `short_description`, optional `digital_look` + `digital_look_caption`.
- [ ] File attached through your digital-delivery app (see step 7), or delivered by your own automation.
- [ ] Member of the `digital` collection.
- [ ] At least one variant available — if every variant is sold out the "Buy digital only" button renders disabled.

### 4c. Digital-only product

Same as 4b. No garment, no twin reference, no shipping. The PDP shows *Asset preview* / *What you receive* instead of garment tabs.

---

## 5. Navigation

Admin → **Online Store → Navigation**. Menu handles are defaults in the section schemas (`main-menu` for the header, `footer` for the footer and for the header's secondary menu).

[storefront-setup.graphql](storefront-setup.graphql) creates both menus with the links below, as URL-type items (`/collections/digital`, `/pages/about`), so nothing breaks if a page or collection is renamed later — repoint the item then, or swap it for a real PAGE/COLLECTION item in the admin.

**Main menu**

- [ ] Shop → `/collections/all`
- [ ] Outerwear → `/collections/outerwear`
- [ ] Trousers → `/collections/trousers`
- [ ] Digital Wardrobe → `/collections/digital`
- [ ] About → `/pages/about`
- [ ] Contact → `/pages/contact`

**Footer menu**

- [ ] Shipping & Returns → `/pages/shipping-returns`
- [ ] Contact → `/pages/contact`
- [ ] Refund policy → `/policies/refund-policy` (and privacy/terms as needed)

- [ ] If you renamed either menu, reselect it in the theme editor — the header and footer fall back to the handles above.

---

## 6. Theme settings

Admin → **Online Store → Themes → Customize → Theme settings**.

| Setting | Default | Do this |
| --- | --- | --- |
| Background / text / surface / accent | `#F4F1EA` / `#1A1B18` / `#EBE7DD` / `#1F3A2E` | Keep, or set your brand palette |
| Heading font / body font | Newsreader / Inter | Keep, or swap — both are loaded from Google Fonts remotely |
| Page width | 1560 | 1400–1600 is the intended range |
| Cart type | Drawer | Drawer is the designed path; the cart page still works |
| Free-shipping threshold | 250 | Must match your real rate, in store currency |
| Cart note | "Digital looks are emailed the moment your order is confirmed." | Rewrite to match how assets are actually delivered |
| Enable digital look | on | Turn off to hide the digital panel entirely |
| Digital twin included | on | **Turn off unless a bundle/cart transform is wired** (step 0) |
| Delivery note | "Free shipping over £250…" | Keep consistent with your threshold |
| Favicon | — | Upload |
| Social: Instagram / Substack / Are.na | — | Fill in; each icon hides when blank |

- [ ] Settings reviewed against the real offer, especially the two copy-heavy fields (threshold and twin inclusion) which contradict the store if left on defaults.

---

## 7. Commerce plumbing

- [ ] **Payments** — Shopify Payments or your gateway, test mode transaction completed.
- [ ] **Shipping** — zones and rates matching the £250 threshold; digital products must not require shipping (step 4b).
- [ ] **Taxes** — configured for your registrations; digital-goods VAT rules apply if selling to the EU.
- [ ] **Markets/currency** — GBP as base; add markets only if you price them separately.
- [ ] **Domain** — primary domain set, SSL issued.
- [ ] **Notifications** — order confirmation copy mentions how the digital file arrives.
- [ ] **Digital delivery app** — Shopify Digital Downloads, SendOwl, or similar, so the file is emailed on fulfilment and the download link is licence-limited. Nothing in the theme ships files.
- [ ] **Twin inclusion (if used)** — cart transform (Plus), bundle app, or Shopify Flow + order tagging. Until this exists, the theme only labels the offer.

---

## 8. Pre-launch QA

On the unpublished theme preview, on desktop and a phone:

- [ ] Home renders all nine sections with real content — no "choose a collection" or empty-grid placeholders.
- [ ] Garment PDP: both tabs present, garment price and the "Buy digital only — £…" CTA, and the digital panel names the actual twin rather than a generic description.
- [ ] Adding a garment opens the drawer with the right line and total; adding the digital-only line does too.
- [ ] Digital-only PDP: tabs read *Asset preview* / *What you receive*, no size selector.
- [ ] A product **without** a twin shows no second tab and no digital CTA (this is the most common content error).
- [ ] Collection page: chips filter and the count updates, sorting works, pagination works.
- [ ] Cart drawer: quantity +/− updates totals and the free-shipping bar; emptying it shows the empty state.
- [ ] Cart page and drawer agree after a change.
- [ ] Search returns products and articles; 404 page renders.
- [ ] Contact form submits and arrives by email.
- [ ] Keyboard-only pass: header menu, tabs, accordions, cart drawer close.
- [ ] Browser console clean on home, collection, PDP, cart.
- [ ] `node scripts/prelaunch.mjs` passes against the live store: theme validation, 10/10 definitions, and no twin-link issues. `--theme-only` skips the store pass when there is no store to check yet; the same gate runs in CI on every push once the repository secrets are set.

Then:

- [ ] Publish the theme.
- [ ] Place one real order of each kind (garment, digital only), confirm the email and the download, then refund both.
- [ ] Re-check the live theme on a phone — theme editor settings can differ between the preview and published theme.

---

## Known constraints

- **The free twin cannot be done in theme code.** Liquid cannot price a line at zero; you need a cart transform (Shopify Plus), a bundle app, or post-purchase automation. Keep *Digital twin is included* off until one is configured.
- **Collection filtering is client-side and page-scoped.** Chips come from the product types present in that collection. Shopify's native filters (Search & Discovery) can replace it later.
- **The `digital` collection handle is hardcoded** in the digital wardrobe section; the other three handles are only defaults.
- **Fonts are loaded from Google Fonts.** Self-host Newsreader and Inter before launch for privacy and performance.
- The theme has **no store data in this repo** — everything above lives in your Shopify admin and is not version-controlled. Re-creating a store from scratch means repeating this checklist.
