/* ============================================================
   Aethel & Code — theme runtime
   No dependencies. Cart uses the Shopify Ajax API.
   ============================================================ */
(function () {
  'use strict';

  var config = window.AethelConfig || {};
  var strings = config.strings || {};
  var freeShipping = Number(config.freeShipping || 0);
  var cartType = config.cartType || 'drawer';

  /* ---------------- utilities ---------------- */
  function formatMoney(cents) {
    var format = config.moneyFormat || '£{{amount}}';
    var value = (Number(cents) / 100).toFixed(2);
    return format
      .replace(/\{\{\s*amount\s*\}\}/, value)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(Number(cents) / 100).toString())
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, value.replace('.', ','))
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/, Math.round(Number(cents) / 100).toString());
  }

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function plateFallback() {
    return '<div class="plate plate--studio" style="--p1:#3b3c35;--p2:#8b8575;--p3:#1a1b17" aria-hidden="true"><span class="plate__contour"></span><span class="plate__grain"></span></div>';
  }

  var toastTimer;
  function toast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.setAttribute('data-show', 'false');
    }, 2600);
  }

  /* ---------------- drawer + menu ---------------- */
  var lastFocused = null;

  function openDrawer() {
    var drawer = document.getElementById('drawer');
    var scrim = document.getElementById('scrim');
    if (!drawer || !scrim) return;
    lastFocused = document.activeElement;
    drawer.setAttribute('data-open', 'true');
    scrim.setAttribute('data-open', 'true');
    document.body.classList.add('is-locked');
    var close = drawer.querySelector('[data-close-cart]');
    if (close) close.focus();
  }

  function closeDrawer() {
    var drawer = document.getElementById('drawer');
    var scrim = document.getElementById('scrim');
    if (!drawer || !scrim) return;
    drawer.setAttribute('data-open', 'false');
    scrim.setAttribute('data-open', 'false');
    document.body.classList.remove('is-locked');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function openMenu() {
    var menu = document.getElementById('mobile-nav');
    if (!menu) return;
    menu.setAttribute('data-open', 'true');
    document.body.classList.add('is-locked');
    var toggle = $('[data-open-menu]');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    var close = menu.querySelector('[data-close-menu]');
    if (close) close.focus();
  }

  function closeMenu() {
    var menu = document.getElementById('mobile-nav');
    if (!menu) return;
    menu.setAttribute('data-open', 'false');
    document.body.classList.remove('is-locked');
    var toggle = $('[data-open-menu]');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  }

  /* ---------------- cart ---------------- */
  function updateBadge(count) {
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      if (el.classList.contains('cart-btn__count')) {
        el.setAttribute('data-empty', count === 0 ? 'true' : 'false');
      }
    });
  }

  function renderCart(cart) {
    var body = $('[data-cart-body]');
    updateBadge(cart.item_count);

    if (body) {
      if (!cart.items.length) {
        body.innerHTML =
          '<div class="drawer__empty">' +
          '<p class="label">' + (strings.empty || 'Nothing selected') + '</p>' +
          '<p class="muted" style="max-width:30ch">' + (strings.emptyBody || '') + '</p>' +
          '<p style="margin-top:1.5rem"><a class="link-underline" href="/collections/all">' +
          (strings.continueShopping || 'Continue shopping') +
          '</a></p></div>';
      } else {
        body.innerHTML = cart.items.map(renderLine).join('');
      }
    }

    var subtotal = $('[data-cart-subtotal]');
    if (subtotal) subtotal.textContent = formatMoney(cart.items_subtotal_price);

    var total = $('[data-cart-total]');
    if (total) total.textContent = formatMoney(cart.total_price);

    var shipLabel = $('[data-shipping-label]');
    if (shipLabel) {
      shipLabel.textContent = freeShipping > 0 && cart.total_price >= freeShipping
        ? (strings.shippingFree || 'Shipping (free)')
        : (strings.shipping || 'Shipping');
    }

    if (freeShipping > 0) {
      var remaining = freeShipping - cart.total_price;
      var label = $('[data-free-ship-label]');
      if (label) {
        label.textContent = remaining > 0
          ? (strings.freeShippingRemaining || '').replace('[[amount]]', formatMoney(remaining))
          : (strings.freeShippingEarned || '');
      }
      var fill = $('[data-free-ship-fill]');
      if (fill) fill.style.width = Math.min(100, (cart.total_price / freeShipping) * 100) + '%';
    }

    var checkout = $('#cart-drawer-form button[type="submit"]');
    if (checkout) checkout.disabled = cart.items.length === 0;
  }

  function renderLine(item) {
    var hasDigital = item.properties && item.properties.Delivery;
    var variant = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';
    var meta = hasDigital
      ? item.properties.Delivery
      : [variant, hasDigital].filter(Boolean).join(' · ');

    var media = item.image
      ? '<div class="media--image" style="position:absolute;inset:0"><img src="' +
        item.image.replace(/\.(png|jpe?g|webp)/i, '_200x.$1') +
        '" alt="" loading="lazy"></div>'
      : plateFallback();

    return (
      '<div class="line-item">' +
      '<div class="line-item__media media">' + media + '</div>' +
      '<div>' +
      '<div class="line-item__name"><a href="' + item.url + '">' + item.product_title + '</a></div>' +
      '<div class="line-item__meta">' + (meta || '') + '</div>' +
      '<div class="line-item__row">' +
      '<div class="qty">' +
      '<button type="button" data-cart-qty="' + item.key + '" data-delta="-1" aria-label="Decrease quantity">&minus;</button>' +
      '<span data-cart-qty-value>' + item.quantity + '</span>' +
      '<button type="button" data-cart-qty="' + item.key + '" data-delta="1" aria-label="Increase quantity">+</button>' +
      '</div>' +
      '<span class="line-item__price">' + formatMoney(item.final_line_price) + '</span>' +
      '</div>' +
      '<button class="line-item__remove" type="button" data-cart-remove="' + item.key + '">' +
      (strings.remove || 'Remove') +
      '</button>' +
      '</div></div>'
    );
  }

  function refreshCart() {
    return fetch('/cart.js', { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        renderCart(cart);
        return cart;
      })
      .catch(function () { /* keep server-rendered cart */ });
  }

  function changeLine(key, quantity) {
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        renderCart(cart);
        return cart;
      });
  }

  function addToCart(payload) {
    if (cartType === 'page') {
      var form = document.createElement('form');
      form.method = 'post';
      form.action = '/cart/add';
      Object.keys(payload).forEach(function (key) {
        if (key === 'properties') return;
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payload[key];
        form.appendChild(input);
      });
      if (payload.properties) {
        Object.keys(payload.properties).forEach(function (name) {
          var prop = document.createElement('input');
          prop.type = 'hidden';
          prop.name = 'properties[' + name + ']';
          prop.value = payload.properties[name];
          form.appendChild(prop);
        });
      }
      document.body.appendChild(form);
      form.submit();
      return Promise.resolve();
    }

    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [payload] })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.description || 'Could not add to cart');
        return data;
      });
    });
  }

  /* ---------------- product page ---------------- */
  function initProduct() {
    var root = $('[data-product-root]');
    if (!root) return;

    var form = $('[data-product-form]', root);
    var variantInput = $('[data-variant-id]', root);
    var priceEl = $('[data-price]', root);
    var compareEl = $('[data-compare]', root);
    var cta = $('[data-add-to-cart]', root);
    var ctaLabel = $('[data-cta-label]', root);
    var errorEl = $('[data-form-error]', root);

    var dataScript = $('script[data-variants]');
    var variants = [];
    try {
      variants = JSON.parse(dataScript.textContent);
    } catch (e) {
      variants = [];
    }

    var selected = [];
    var current = variants.filter(function (v) {
      return String(v.id) === String(variantInput && variantInput.value);
    })[0] || variants[0];

    if (current) selected = current.options.slice();

    function findVariant(options) {
      return variants.filter(function (v) {
        return v.options.every(function (option, index) {
          return option === options[index];
        });
      })[0];
    }

    function hasAvailable(index, value) {
      var test = selected.slice();
      test[index] = value;
      return variants.some(function (v) {
        return v.available && v.options.every(function (option, i) {
          return option === test[i];
        });
      });
    }

    function paint() {
      var variant = findVariant(selected);
      if (!variant) return;

      if (variantInput) variantInput.value = variant.id;

      if (priceEl) priceEl.textContent = variant.price;

      if (compareEl) {
        if (variant.compare) {
          compareEl.textContent = variant.compare;
          compareEl.hidden = false;
        } else {
          compareEl.hidden = true;
        }
      }

      if (cta) {
        cta.disabled = !variant.available;
        if (ctaLabel) {
          ctaLabel.textContent = variant.available ? (strings.addToCart || 'Add to cart') : (strings.soldOut || 'Sold out');
        }
      }

      if (window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }

      $$('[data-option-index]', root).forEach(function (button) {
        var index = Number(button.dataset.optionIndex);
        var value = button.dataset.value;
        var pressed = selected[index] === value;
        button.setAttribute('aria-pressed', String(pressed));
        button.disabled = !pressed && !hasAvailable(index, value);

        if (pressed) {
          var valueLabel = $('[data-option-value="' + index + '"]', root);
          if (valueLabel) valueLabel.textContent = value;
        }
      });
    }

    root.addEventListener('click', function (event) {
      var option = event.target.closest('[data-option-index]');
      if (option && !option.disabled) {
        selected[Number(option.dataset.optionIndex)] = option.dataset.value;
        paint();
        return;
      }

      var tab = event.target.closest('[data-tab]');
      if (tab) {
        var id = tab.getAttribute('aria-controls');
        $$('[data-tab]', root).forEach(function (t) {
          var selectedTab = t === tab;
          t.setAttribute('aria-selected', String(selectedTab));
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !selectedTab;
        });
        return;
      }

      var thumb = event.target.closest('[data-media-thumb]');
      if (thumb) {
        var index = thumb.dataset.mediaThumb;
        $$('[data-media-item]', root).forEach(function (item) {
          item.hidden = item.dataset.mediaItem !== index;
        });
        $$('[data-media-thumb]', root).forEach(function (t) {
          t.setAttribute('aria-pressed', String(t === thumb));
        });
      }
    });

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (errorEl) errorEl.textContent = '';
        if (!variantInput) return;

        var submitButton = $('[data-add-to-cart]', form);
        if (submitButton) submitButton.disabled = true;

        var payload = { id: Number(variantInput.value), quantity: 1 };
        if (root.getAttribute('data-is-digital') === 'true') {
          payload.properties = { Delivery: 'Instant download' };
        }

        addToCart(payload)
          .then(function () {
            if (cartType === 'page') return;
            return refreshCart().then(function () {
              openDrawer();
              toast(strings.added || 'Added to cart');
            });
          })
          .catch(function (error) {
            if (errorEl) errorEl.textContent = error.message;
            if (submitButton) submitButton.disabled = false;
          })
          .then(function () {
            if (submitButton) submitButton.disabled = false;
          });
      });
    }

    var twinButton = $('[data-add-twin]', root);
    if (twinButton) {
      twinButton.addEventListener('click', function () {
        twinButton.disabled = true;

        addToCart({
          id: Number(twinButton.dataset.addTwin),
          quantity: 1,
          properties: { Delivery: 'Instant download' }
        })
          .then(function () {
            if (cartType === 'page') return;
            return refreshCart().then(function () {
              openDrawer();
              toast(strings.addedDigital || 'Digital asset added');
            });
          })
          .catch(function (error) {
            if (errorEl) errorEl.textContent = error.message;
          })
          .then(function () {
            twinButton.disabled = false;
          });
      });
    }

    paint();
  }

  /* ---------------- collection ---------------- */
  function initCollection() {
    var root = $('[data-collection-root]');
    var grid = $('[data-product-grid]');
    if (!root || !grid) return;

    var cards = $$('.card', grid);
    var countEl = $('[data-result-count]', root);
    var emptyEl = $('[data-empty-state]');
    var sort = $('[data-sort]', root);

    function updateCount(visible) {
      if (!countEl) return;
      var label = visible === 1 ? 'piece' : 'pieces';
      countEl.textContent = visible + ' ' + label;
    }

    root.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-filter-type]');
      if (!chip) return;

      var type = chip.dataset.filterType;
      $$('[data-filter-type]', root).forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === chip));
      });

      var visible = 0;
      cards.forEach(function (card) {
        var match = type === 'all' || card.dataset.productType === type;
        card.hidden = !match;
        if (match) visible += 1;
      });

      updateCount(visible);
      if (emptyEl) emptyEl.hidden = visible > 0;
    });

    if (sort) {
      sort.addEventListener('change', function () {
        var form = sort.form;
        if (form) form.submit();
      });
    }
  }

  /* ---------------- cart page ---------------- */
  function initCartPage() {
    var page = $('.cart-page');
    if (!page) return;

    page.addEventListener('click', function (event) {
      var qtyBtn = event.target.closest('[data-cart-page-qty]');
      if (qtyBtn) {
        var quantity = Number(qtyBtn.dataset.quantity);
        qtyBtn.disabled = true;
        changeLine(qtyBtn.dataset.cartPageQty, Math.max(0, quantity)).then(function () {
          window.location.reload();
        });
        return;
      }

      var removeBtn = event.target.closest('[data-cart-page-remove]');
      if (removeBtn) {
        removeBtn.disabled = true;
        changeLine(removeBtn.dataset.cartPageRemove, 0).then(function () {
          window.location.reload();
        });
      }
    });
  }

  /* ---------------- drawer events ---------------- */
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-open-cart]')) {
      if (cartType === 'page') {
        window.location.href = '/cart';
        return;
      }
      openDrawer();
      refreshCart();
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
      return;
    }

    var qty = event.target.closest('[data-cart-qty]');
    if (qty) {
      var line = qty.closest('.line-item');
      var currentQty = line ? Number(line.querySelector('[data-cart-qty-value]').textContent) : 1;
      var next = Math.max(0, currentQty + Number(qty.dataset.delta));
      qty.disabled = true;
      changeLine(qty.dataset.cartQty, next);
      return;
    }

    var remove = event.target.closest('[data-cart-remove]');
    if (remove) {
      remove.disabled = true;
      changeLine(remove.dataset.cartRemove, 0);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var drawer = document.getElementById('drawer');
    if (drawer && drawer.getAttribute('data-open') === 'true') closeDrawer();
    var menu = document.getElementById('mobile-nav');
    if (menu && menu.getAttribute('data-open') === 'true') closeMenu();
  });

  /* ---------------- boot ---------------- */
  function boot() {
    initProduct();
    initCollection();
    initCartPage();
    updateBadge(Number(config.itemCount || 0));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
