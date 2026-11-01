/* ============================================================
   Aethel & Code — storefront runtime
   ============================================================ */

/* ---------------- line-art figure for digital looks ---------------- */
const FIGURE_SVG = `
<svg viewBox="0 0 200 470" aria-hidden="true">
  <circle cx="100" cy="38" r="17"/>
  <path d="M100 55v18"/>
  <path d="M72 82q28-12 56 0l10 106q-38 14-76 0z"/>
  <path d="M72 88c-11 34-14 78-11 122"/>
  <path d="M128 88c11 34 14 78 11 122"/>
  <path d="M70 196l-8 236h22l14-152"/>
  <path d="M130 196l8 236h-22l-14-152"/>
  <path class="dash" d="M62 210h76"/>
  <path class="dash" d="M64 330h72"/>
  <path class="accent" d="M34 120v-16h16"/>
  <path class="accent" d="M166 120v-16h-16"/>
  <path class="accent" d="M34 300v16h16"/>
  <path class="accent" d="M166 300v16h-16"/>
  <circle class="accent" cx="100" cy="38" r="26" stroke-opacity=".35"/>
  <path class="dash" d="M100 470V404"/>
</svg>`;

const FIGURE_PLAIN = `
<svg viewBox="0 0 200 470" aria-hidden="true" opacity=".55">
  <circle cx="100" cy="38" r="17"/>
  <path d="M72 82q28-12 56 0l10 106q-38 14-76 0z"/>
  <path d="M70 196l-8 236h22l14-152"/>
  <path d="M130 196l8 236h-22l-14-152"/>
</svg>`;

/* ---------------- art helpers ---------------- */
function artHTML(product, variant, opts = {}) {
  const { figure = false, plain = false } = opts;
  const pal = product.palette || {};
  const style = `--p1:${pal.p1 || '#33352e'};--p2:${pal.p2 || '#6d6f62'};--p3:${pal.p3 || '#131410'}`;
  const cls = `plate plate--${variant || product.plate}`;
  const fig = figure ? `<div class="figure">${plain ? FIGURE_PLAIN : FIGURE_SVG}</div>` : '';
  return `<div class="${cls}" style="${style}" aria-hidden="true">
    <span class="plate__contour"></span>
    <span class="plate__grain"></span>${fig}
  </div>`;
}

function cardHTML(product) {
  const tag =
    product.kind === 'physical'
      ? '<span class="media__tag">Digital look included</span>'
      : '<span class="media__tag">Instant download</span>';
  return `<a class="card reveal" href="product.html?p=${product.slug}">
    <div class="media">
      ${artHTML(product, null, { figure: product.kind === 'digital' })}
      ${tag}
    </div>
    <div class="card__info">
      <span class="card__name">${product.name}</span>
      <span class="card__price">${money(product.price)}</span>
    </div>
    <div class="card__meta">
      <span>${product.material}</span>
      <span>${product.category}</span>
    </div>
  </a>`;
}

/* ---------------- storage ---------------- */
const CART_KEY = 'aethel-code-cart-v1';

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (err) {
    /* storage unavailable — cart stays in memory for this page */
  }
}

let CART = readCart();

/* ---------------- cart logic ---------------- */
function cartLineKey(item) {
  return [item.slug, item.kind, item.size, item.colorway].join('|');
}

function addToCart(entry) {
  const key = cartLineKey(entry);
  const existing = CART.find((line) => cartLineKey(line) === key);
  if (existing) {
    existing.qty = Math.min(existing.qty + (entry.qty || 1), 9);
  } else {
    CART.push({ ...entry, qty: entry.qty || 1 });
  }
  commitCart();
}

function setQty(key, delta) {
  CART = CART.map((line) =>
    cartLineKey(line) === key ? { ...line, qty: Math.max(1, Math.min(9, line.qty + delta)) } : line
  );
  commitCart();
}

function removeLine(key) {
  CART = CART.filter((line) => cartLineKey(line) !== key);
  commitCart();
}

function cartCount() {
  return CART.reduce((sum, line) => sum + line.qty, 0);
}

function cartSubtotal() {
  return CART.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
}

function commitCart() {
  writeCart(CART);
  renderCart();
}

/* ---------------- checkout / shipping copy ---------------- */
const FREE_SHIPPING_AT = 250;
const SHIPPING_FLAT = 8;

/* ---------------- chrome ---------------- */
const NAV = [
  ['Shop', 'shop.html', 'shop'],
  ['Digital Wardrobe', 'digital-wardrobe.html', 'digital-wardrobe'],
  ['About', 'about.html', 'about'],
  ['Shipping & Returns', 'policies.html', 'policies']
];

function chromeHTML(page) {
  const links = NAV.map(
    ([label, href, key]) =>
      `<li><a href="${href}"${page === key ? ' aria-current="page"' : ''}>${label}</a></li>`
  ).join('');

  return {
    header: `<a class="skip" href="#main">Skip to content</a>
    <header class="nav">
      <div class="wrap nav__inner">
        <a class="wordmark" href="index.html">Aethel <span>&amp;</span> Code</a>
        <nav aria-label="Primary">
          <ul class="nav__links">${links}</ul>
        </nav>
        <div class="nav__actions">
          <button class="cart-btn" type="button" data-open-cart aria-haspopup="dialog" aria-controls="drawer">
            Cart <span class="cart-btn__count" data-cart-count data-empty="true">0</span>
          </button>
          <button class="menu-toggle" type="button" data-open-menu aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu"><span></span></button>
        </div>
      </div>
    </header>

    <div class="mobile-nav" id="mobile-nav" data-open="false" role="dialog" aria-modal="true" aria-label="Menu">
      <button class="mobile-nav__close" type="button" data-close-menu aria-label="Close menu">&times;</button>
      <ul>
        ${NAV.map(([label, href], i) => `<li><a href="${href}">${label}<span>0${i + 1}</span></a></li>`).join('')}
        <li><a href="contact.html">Contact<span>0${NAV.length + 1}</span></a></li>
      </ul>
      <p class="mobile-nav__foot">Studio, Iloilo City, Philippines<br>Digital wardrobe delivered by email.</p>
    </div>`,

    footer: `<footer class="footer">
      <div class="wrap">
        <div class="footer__grid">
          <div class="footer__brand">
            <a class="wordmark" href="index.html">Aethel <span>&amp;</span> Code</a>
            <p>Garments for the ground you stand on, with a digital twin for the ground you inhabit next.</p>
          </div>
          <div>
            <h3>Shop</h3>
            <ul>
              <li><a href="shop.html">All garments</a></li>
              <li><a href="shop.html?c=Outerwear">Outerwear</a></li>
              <li><a href="shop.html?c=Trousers">Trousers</a></li>
              <li><a href="digital-wardrobe.html">Digital wardrobe</a></li>
            </ul>
          </div>
          <div>
            <h3>Studio</h3>
            <ul>
              <li><a href="about.html">About</a></li>
              <li><a href="contact.html">Contact</a></li>
              <li><a href="policies.html">Shipping &amp; returns</a></li>
              <li><a href="policies.html#digital">Digital delivery</a></li>
            </ul>
          </div>
          <div>
            <h3>Elsewhere</h3>
            <ul>
              <li><a href="#" rel="noopener">Instagram</a></li>
              <li><a href="#" rel="noopener">Substack</a></li>
              <li><a href="#" rel="noopener">Are.na</a></li>
            </ul>
          </div>
        </div>
        <div class="footer__base">
          <span>&copy; 2026 Aethel &amp; Code. All rights reserved.</span>
          <span>Iloilo City &middot; Philippines</span>
        </div>
      </div>
    </footer>`
  };
}

let lastFocused = null;

function drawerHTML() {
  return `<div class="scrim" id="scrim" data-open="false"></div>
  <aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-open="false">
    <div class="drawer__head">
      <h2 id="drawer-title">Your cart <span class="muted" data-cart-count>0</span></h2>
      <button class="drawer__close" type="button" data-close-cart aria-label="Close cart">&times;</button>
    </div>
    <div class="drawer__body" data-cart-body></div>
    <div class="drawer__foot">
      <div class="drawer__row"><span>Subtotal</span><span data-cart-subtotal>£0</span></div>
      <div class="drawer__row"><span data-shipping-label>Shipping</span><span data-cart-shipping>—</span></div>
      <div class="drawer__row drawer__total"><span>Total</span><strong data-cart-total>£0</strong></div>
      <button class="btn btn--block" type="button" data-checkout>Checkout</button>
      <p class="drawer__note" data-checkout-note>Taxes calculated at checkout. Digital looks are delivered by email the moment your order is confirmed.</p>
    </div>
  </aside>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

function mountChrome() {
  const page = document.body.dataset.page || '';
  const { header, footer } = chromeHTML(page);
  const headerMount = document.querySelector('[data-chrome="header"]');
  const footerMount = document.querySelector('[data-chrome="footer"]');
  if (headerMount) headerMount.innerHTML = header;
  if (footerMount) footerMount.innerHTML = footer;
  document.body.insertAdjacentHTML('beforeend', drawerHTML());
  bindDrawerEvents();
  renderCart();
}

function openDrawer() {
  lastFocused = document.activeElement;
  document.getElementById('scrim').dataset.open = 'true';
  const drawer = document.getElementById('drawer');
  drawer.dataset.open = 'true';
  document.body.classList.add('is-locked');
  const close = drawer.querySelector('[data-close-cart]');
  if (close) close.focus();
}

function closeDrawer() {
  document.getElementById('scrim').dataset.open = 'false';
  document.getElementById('drawer').dataset.open = 'false';
  document.body.classList.remove('is-locked');
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

function openMenu() {
  const menu = document.getElementById('mobile-nav');
  menu.dataset.open = 'true';
  document.body.classList.add('is-locked');
  const toggle = document.querySelector('[data-open-menu]');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  const close = menu.querySelector('[data-close-menu]');
  if (close) close.focus();
}

function closeMenu() {
  const menu = document.getElementById('mobile-nav');
  if (!menu) return;
  menu.dataset.open = 'false';
  document.body.classList.remove('is-locked');
  const toggle = document.querySelector('[data-open-menu]');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
}

function bindDrawerEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-cart]')) {
      openDrawer();
      return;
    }
    if (event.target.closest('[data-close-cart]') || event.target.id === 'scrim') {
      closeDrawer();
      return;
    }
    if (event.target.closest('[data-open-menu]')) {
      openMenu();
      return;
    }
    if (event.target.closest('[data-close-menu]')) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const drawer = document.getElementById('drawer');
    if (drawer && drawer.dataset.open === 'true') closeDrawer();
    const menu = document.getElementById('mobile-nav');
    if (menu && menu.dataset.open === 'true') closeMenu();
  });

  const scrim = document.getElementById('scrim');
  if (scrim) {
    scrim.addEventListener('transitionend', () => {
      if (scrim.dataset.open === 'false') document.body.classList.remove('is-locked');
    });
  }

  document.addEventListener('click', (event) => {
    const qtyBtn = event.target.closest('[data-qty]');
    if (qtyBtn) {
      setQty(qtyBtn.dataset.key, Number(qtyBtn.dataset.qty));
      return;
    }
    const removeBtn = event.target.closest('[data-remove]');
    if (removeBtn) {
      removeLine(removeBtn.dataset.remove);
      return;
    }
    if (event.target.closest('[data-checkout]')) {
      const note = document.querySelector('[data-checkout-note]');
      if (note) {
        note.textContent =
          'Checkout runs on Shopify in production. This build is the storefront only — the cart, bundles and totals above are live.';
        note.style.color = 'var(--ink)';
      }
    }
  });
}

function renderCart() {
  const body = document.querySelector('[data-cart-body]');
  if (!body) return;

  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = cartCount();
    if (el.classList.contains('cart-btn__count')) {
      el.dataset.empty = cartCount() === 0 ? 'true' : 'false';
    }
  });

  if (!CART.length) {
    body.innerHTML = `<div class="drawer__empty">
      <p class="label">Nothing selected</p>
      <p class="muted" style="max-width:30ch">Every garment ships with its digital twin. Add a piece, or browse the digital wardrobe on its own.</p>
      <p style="margin-top:1.5rem"><a class="link-underline" href="shop.html">Explore the collection</a></p>
    </div>`;
  } else {
    body.innerHTML = CART.map((line) => {
      const product = CATALOG_BY_SLUG[line.slug];
      if (!product) return '';
      const key = cartLineKey(line);
      const label = line.kind === 'digital' && product.twin ? product.twin.name : product.name;
      const meta =
        line.kind === 'digital'
          ? 'Digital asset &middot; instant delivery'
          : `${line.colorway} &middot; Size ${line.size} &middot; digital look included`;
      return `<div class="line-item">
        <div class="line-item__media">${artHTML(product, line.kind === 'digital' ? 'wire' : null, { figure: line.kind === 'digital' })}</div>
        <div>
          <div class="line-item__name">${label}</div>
          <div class="line-item__meta">${meta}</div>
          <div class="line-item__row">
            <div class="qty">
              <button type="button" data-qty="-1" data-key="${key}" aria-label="Decrease quantity of ${label}">&minus;</button>
              <span>${line.qty}</span>
              <button type="button" data-qty="1" data-key="${key}" aria-label="Increase quantity of ${label}">+</button>
            </div>
            <span class="line-item__price">${money(line.unitPrice * line.qty)}</span>
          </div>
          <button class="line-item__remove" type="button" data-remove="${key}">Remove</button>
        </div>
      </div>`;
    }).join('');
  }

  const subtotal = cartSubtotal();
  const shipping = !CART.length ? null : subtotal >= FREE_SHIPPING_AT ? 0 : SHIPPING_FLAT;
  const total = subtotal + (shipping || 0);

  const set = (sel, value) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = value;
  };
  set('[data-cart-subtotal]', money(subtotal));
  set('[data-cart-shipping]', shipping === null ? '—' : shipping === 0 ? 'Free' : money(shipping));
  set('[data-cart-total]', money(total));
  set('[data-shipping-label]', shipping === null ? 'Shipping' : subtotal >= FREE_SHIPPING_AT ? 'Shipping (free)' : 'Shipping');

  const checkout = document.querySelector('[data-checkout]');
  if (checkout) checkout.disabled = CART.length === 0;
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.show = 'true';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.dataset.show = 'false';
  }, 2600);
}

/* ---------------- reveal on scroll ---------------- */
function initReveal() {
  const nodes = document.querySelectorAll('.reveal');
  if (!nodes.length) return;
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  nodes.forEach((n) => io.observe(n));

  // Safety net: never leave content hidden if callbacks are starved
  // (throttled tabs, prerender, unusual embeds). Drop the hidden state
  // entirely rather than depending on a transition completing.
  setTimeout(() => {
    nodes.forEach((n) => {
      n.classList.add('is-in');
      n.classList.remove('reveal');
    });
  }, 1500);
}

/* ---------------- home ---------------- */
function initHome() {
  const featured = document.getElementById('featured-grid');
  if (featured) {
    const picks = ['ridgeline-shell', 'cirque-trouser', 'meridian-overshirt']
      .map((slug) => CATALOG_BY_SLUG[slug])
      .filter(Boolean);
    featured.innerHTML = picks.map(cardHTML).join('');
  }

  const strip = document.getElementById('digital-strip');
  if (strip) {
    strip.innerHTML = DIGITAL.slice(0, 4)
      .map(
        (product) => `<a href="product.html?p=${product.slug}">
          <div class="media" aria-hidden="true">
            ${artHTML(product, 'wire', { figure: true })}
          </div>
          <span class="digital-strip__label">${product.name} — ${money(product.price)}</span>
        </a>`
      )
      .join('');
  }
}

/* ---------------- shop ---------------- */
function initShop() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const categories = ['All', ...new Set(PHYSICAL.map((p) => p.category))];
  const chips = document.getElementById('chips');
  const count = document.getElementById('result-count');
  const sort = document.getElementById('sort');
  const empty = document.getElementById('empty-state');

  const params = new URLSearchParams(window.location.search);
  const initial = params.get('c');
  let active = categories.includes(initial) ? initial : 'All';

  chips.innerHTML = categories
    .map(
      (cat) =>
        `<button class="chip" type="button" data-cat="${cat}" aria-pressed="${cat === active}">${cat}</button>`
    )
    .join('');

  function paint() {
    let list = PHYSICAL.filter((p) => active === 'All' || p.category === active);
    if (sort.value === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort.value === 'high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort.value === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    grid.innerHTML = list.map(cardHTML).join('');
    if (empty) empty.hidden = list.length > 0;
    if (count) count.textContent = `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}`;
    document.querySelectorAll('[data-cat]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.cat === active));
    });
    initReveal();
  }

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-cat]');
    if (!chip) return;
    active = chip.dataset.cat;
    paint();
  });

  if (sort) sort.addEventListener('change', paint);
  paint();
}

/* ---------------- product detail ---------------- */
function initProduct() {
  const root = document.getElementById('pdp-root');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const product = CATALOG_BY_SLUG[params.get('p')] || CATALOG_BY_SLUG['ridgeline-shell'];
  const isDigital = product.kind === 'digital';
  const soldOut = product.soldOut || [];

  document.title = `${product.name} — Aethel & Code`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', product.blurb);

  const shots = isDigital
    ? [
        { variant: 'wire', figure: true, plain: false, label: 'Avatar' },
        { variant: 'wire', figure: true, plain: true, label: 'Wireframe' },
        { variant: 'studio', figure: false, plain: false, label: 'Texture' },
        { variant: 'fog', figure: false, plain: false, label: 'Terrain' }
      ]
    : [
        { variant: product.plate, figure: false, plain: false, label: 'On body' },
        { variant: 'studio', figure: false, plain: false, label: 'Detail' },
        { variant: 'dune', figure: false, plain: false, label: 'Fabric' },
        { variant: 'fog', figure: false, plain: false, label: 'Terrain' }
      ];

  const state = {
    shot: 0,
    colorway: product.colorways[0].name,
    size: product.sizes.find((s) => !soldOut.includes(s)) || product.sizes[0],
    tab: 'images'
  };

  const digitalTwin = product.twin || null;
  const related = CATALOG.filter((p) => p.slug !== product.slug)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 3);

  const specList = `<ul>${product.specs.map((s) => `<li>${s}</li>`).join('')}</ul>`;

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="index.html">Home</a><span>/</span>
      <a href="shop.html">Shop</a><span>/</span>
      <span aria-current="page">${product.name}</span>
    </nav>

    <div class="pdp">
      <div class="pdp__media">
        <div class="tabs" role="tablist" aria-label="${product.name} media">
          <button class="tab" role="tab" id="tab-images" aria-controls="panel-images" aria-selected="true" type="button">
            ${isDigital ? 'Asset preview' : 'Images'}
          </button>
          <button class="tab" role="tab" id="tab-digital" aria-controls="panel-digital" aria-selected="false" type="button">
            ${isDigital ? 'What you receive' : 'Digital Look'}${isDigital ? '' : '<sup>&#9679;</sup>'}
          </button>
        </div>

        <div id="panel-images" role="tabpanel" aria-labelledby="tab-images">
          <div class="pdp__stage" id="stage"></div>
          <div class="thumbs" id="thumbs"></div>
        </div>

        <div id="panel-digital" role="tabpanel" aria-labelledby="tab-digital" hidden>
          ${
            isDigital
              ? `<div class="media media--wide">${artHTML(product, 'wire', { figure: true })}
                  <span class="media__tag">Asset preview</span></div>
                 <div class="digital-note">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
                   <p><strong>${product.format}</strong><br>Files: ${product.specs[0]} and ${product.specs[1]}. Licence details are included with the download.</p>
                 </div>`
              : `<div class="media media--wide">${artHTML(product, 'wire', { figure: true })}
                  <span class="media__tag">Digital look — avatar preview</span></div>
                 <div class="digital-note">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>
                   <p><strong>${digitalTwin ? digitalTwin.name : 'Digital twin'} is included with this garment.</strong><br>
                   A wearable 3D version of the ${product.name.toLowerCase()}: rig-ready, with fabric presets. £${digitalTwin ? digitalTwin.price : 0} on its own, free with the physical piece.</p>
                 </div>`
          }
        </div>
      </div>

      <div class="pdp__info">
        <p class="label">${product.category} &middot; ${isDigital ? 'Digital' : 'Physical'}</p>
        <h1>${product.name}</h1>
        <div class="pdp__price">
          ${money(product.price)}
          <span>${isDigital ? 'Instant download' : `Includes ${digitalTwin ? digitalTwin.name : 'digital look'}`}</span>
        </div>
        <p class="pdp__desc">${product.blurb}</p>

        ${
          isDigital
            ? ''
            : `<div class="option">
                <div class="option__head">
                  <span class="label">Colour</span>
                  <span class="option__value" data-colorway-value>${state.colorway}</span>
                </div>
                <div class="swatches" role="group" aria-label="Colour">
                  ${product.colorways
                    .map(
                      (c, i) =>
                        `<button class="swatch" type="button" data-colorway="${c.name}" aria-label="${c.name}" aria-pressed="${i === 0}" style="background:${c.hex}"></button>`
                    )
                    .join('')}
                </div>
              </div>`
        }

        <div class="option">
          <div class="option__head">
            <span class="label">${isDigital ? 'Format' : 'Size'}</span>
            <span class="option__value"><a href="policies.html#returns" style="text-decoration:underline;text-underline-offset:3px">${isDigital ? 'Licence' : 'Size guide'}</a></span>
          </div>
          <div class="${isDigital ? 'sizes' : 'sizes'}" role="group" aria-label="${isDigital ? 'Format' : 'Size'}">
            ${product.sizes
              .map(
                (size) =>
                  `<button class="size" type="button" data-size="${size}" aria-pressed="${size === state.size}"${soldOut.includes(size) ? ' disabled' : ''}>${size}${soldOut.includes(size) ? ' —' : ''}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="pdp__cta">
          <button class="btn btn--block" type="button" data-add-physical>
            ${isDigital ? `Add to cart — ${money(product.price)}` : `Add to cart — ${money(product.price)}`}
            <span class="btn__arrow" aria-hidden="true">&rarr;</span>
          </button>
          ${
            isDigital
              ? `<a class="btn btn--ghost btn--block" href="digital-wardrobe.html">View the digital wardrobe</a>`
              : `<button class="btn btn--ghost btn--block" type="button" data-add-digital>
                  Buy digital only — ${money(digitalTwin.price)}
                </button>`
          }
        </div>
        <p class="pdp__fineprint">${
          isDigital
            ? 'Files are emailed immediately after purchase. 14-day licence exchange.'
            : 'Free shipping over £250. The digital look is emailed with your order confirmation.'
        }</p>

        <div class="accordion">
          <div class="acc__item">
            <button class="acc__trigger" type="button" aria-expanded="true" aria-controls="acc-1">Materials &amp; construction <span class="acc__icon" aria-hidden="true"></span></button>
            <div class="acc__panel" id="acc-1">${specList}</div>
          </div>
          <div class="acc__item">
            <button class="acc__trigger" type="button" aria-expanded="false" aria-controls="acc-2">Fit <span class="acc__icon" aria-hidden="true"></span></button>
            <div class="acc__panel" id="acc-2" hidden><p>${product.fit}</p></div>
          </div>
          <div class="acc__item">
            <button class="acc__trigger" type="button" aria-expanded="false" aria-controls="acc-3">Care &amp; licence <span class="acc__icon" aria-hidden="true"></span></button>
            <div class="acc__panel" id="acc-3" hidden><p>${product.care}</p></div>
          </div>
          <div class="acc__item">
            <button class="acc__trigger" type="button" aria-expanded="false" aria-controls="acc-4">Delivery &amp; returns <span class="acc__icon" aria-hidden="true"></span></button>
            <div class="acc__panel" id="acc-4" hidden>
              <p>${isDigital ? product.format : 'Dispatched in 1–2 working days from the studio. Free tracked shipping over £250, £8 below. Returns within 30 days, unworn.'}</p>
              <p style="margin-top:.6rem"><a class="link-underline" href="policies.html">Read the full policy</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="section section--tight related">
      <div class="section-head">
        <h2 style="font-size:var(--step-2)">Continue</h2>
        <a class="link-underline" href="shop.html">All pieces</a>
      </div>
      <div class="grid-products">${related.map(cardHTML).join('')}</div>
    </section>`;

  /* ---- stage + thumbs ---- */
  const stage = document.getElementById('stage');
  const thumbs = document.getElementById('thumbs');

  function paintStage() {
    const shot = shots[state.shot];
    stage.innerHTML = `<div class="media">${artHTML(product, shot.variant, {
      figure: shot.figure,
      plain: shot.plain
    })}<span class="media__tag">${shot.label}</span></div>`;
  }

  function paintThumbs() {
    thumbs.innerHTML = shots
      .map(
        (shot, i) => `<button class="thumb" type="button" aria-pressed="${i === state.shot}" data-shot="${i}" aria-label="${shot.label}">
          <div class="media" style="aspect-ratio:1">
            ${artHTML(product, shot.variant, { figure: shot.figure, plain: shot.plain })}
            <span class="thumb__label">${shot.label}</span>
          </div>
        </button>`
      )
      .join('');
  }

  paintStage();
  paintThumbs();

  root.addEventListener('click', (event) => {
    const shotBtn = event.target.closest('[data-shot]');
    if (shotBtn) {
      state.shot = Number(shotBtn.dataset.shot);
      paintStage();
      paintThumbs();
      return;
    }

    const swatch = event.target.closest('[data-colorway]');
    if (swatch) {
      state.colorway = swatch.dataset.colorway;
      root.querySelectorAll('[data-colorway]').forEach((s) =>
        s.setAttribute('aria-pressed', String(s.dataset.colorway === state.colorway))
      );
      const label = root.querySelector('[data-colorway-value]');
      if (label) label.textContent = state.colorway;
      return;
    }

    const size = event.target.closest('[data-size]');
    if (size && !size.disabled) {
      state.size = size.dataset.size;
      root.querySelectorAll('[data-size]').forEach((s) =>
        s.setAttribute('aria-pressed', String(s.dataset.size === state.size))
      );
      return;
    }

    const tab = event.target.closest('[role="tab"]');
    if (tab) {
      root.querySelectorAll('[role="tab"]').forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
      });
      return;
    }

    const acc = event.target.closest('.acc__trigger');
    if (acc) {
      const panel = document.getElementById(acc.getAttribute('aria-controls'));
      const open = acc.getAttribute('aria-expanded') === 'true';
      acc.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
      return;
    }

    if (event.target.closest('[data-add-physical]')) {
      addToCart({
        slug: product.slug,
        kind: isDigital ? 'digital' : 'physical',
        size: state.size,
        colorway: isDigital ? 'Digital' : state.colorway,
        unitPrice: product.price
      });
      toast('Added — ' + (isDigital ? 'files delivered instantly' : 'digital look included'));
      openDrawer();
      return;
    }

    if (event.target.closest('[data-add-digital]')) {
      addToCart({
        slug: product.slug,
        kind: 'digital',
        size: product.sizes[0],
        colorway: 'Digital',
        unitPrice: digitalTwin.price
      });
      toast('Added — digital look only');
      openDrawer();
    }
  });

  initReveal();
}

/* ---------------- digital wardrobe ---------------- */
function initWardrobe() {
  const mount = document.getElementById('lookbook');
  if (!mount) return;
  mount.innerHTML = DIGITAL.map(
    (product, i) => `<a class="look reveal ${i % 3 === 0 ? 'look--half' : 'look--third'}" href="product.html?p=${product.slug}">
      <div class="media">
        ${artHTML(product, 'wire', { figure: true })}
        <span class="media__tag">${product.sizes[0]}</span>
      </div>
      <div class="look__meta">
        <h3>${product.name}</h3>
        <p>${product.material} &middot; ${money(product.price)}</p>
      </div>
    </a>`
  ).join('');
  initReveal();
}

/* ---------------- forms ---------------- */
function initForms() {
  const contact = document.querySelector('[data-form="contact"]');
  if (contact) {
    contact.addEventListener('submit', (event) => {
      event.preventDefault();
      let valid = true;
      contact.querySelectorAll('[required]').forEach((input) => {
        const field = input.closest('.field');
        const error = field.querySelector('.field__error');
        const empty = !input.value.trim();
        const badEmail = input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
        field.dataset.invalid = String(empty || badEmail);
        if (error) error.textContent = empty ? 'Required' : badEmail ? 'Enter a valid email' : '';
        if (empty || badEmail) valid = false;
      });
      if (!valid) return;
      contact.reset();
      const success = contact.querySelector('.form-success');
      if (success) success.hidden = false;
      if (success) success.focus();
    });
  }

  const news = document.querySelector('[data-form="newsletter"]');
  if (news) {
    news.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = news.querySelector('input');
      const msg = news.parentElement.querySelector('.newsletter__msg');
      if (!input.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
        if (msg) msg.textContent = 'Enter a valid email address.';
        input.focus();
        return;
      }
      if (msg) msg.textContent = 'Thank you — you are on the list.';
      news.reset();
    });
  }
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  mountChrome();
  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'shop') initShop();
  if (page === 'product') initProduct();
  if (page === 'digital-wardrobe') initWardrobe();
  initForms();
  initReveal();
});
