/* ui.js — shared building blocks: DOM helper, icons, logo, form fields, photo attach, overlay, toast.
   h() builds elements, so text a person types is never parsed as HTML. */
(function () {
  'use strict';
  var LF = (window.LF = window.LF || {});
  var cfg = window.LF_CONFIG;
  LF.screens = LF.screens || {};
  LF.overlays = LF.overlays || {};

  /* ---------- DOM helper ---------- */
  function appendKids(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === null || k === undefined || k === false) continue;
      if (Array.isArray(k)) appendKids(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }
  /** h('div', { class: 'x', style: { gap: '8px' }, onclick: fn }, child, child ...) */
  LF.h = function h(tag, attrs) {
    var kids = Array.prototype.slice.call(arguments, 2);
    var el = document.createElement(tag);
    var deferredValue;
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs) && !(attrs instanceof Node)) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'value') deferredValue = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    } else if (attrs !== null && attrs !== undefined) kids.unshift(attrs);
    appendKids(el, kids);
    if (deferredValue !== undefined) el.value = deferredValue;
    return el;
  };
  var h = LF.h;

  /* ---------- Icons ---------- */
  var ICONS = {
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-3.5-3.5',
    paperclip: 'M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9',
    x: 'M6 6l12 12M18 6L6 18',
    menu: 'M4 7h16M4 12h16M4 17h16',
    alert: 'M12 3l10 18H2L12 3zm0 7v5m0 3h.01',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 8v5m0-8.5h.01',
    phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 15h.01',
    wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm0 0V6a2 2 0 0 1 2-2h12M16 14h2',
    doc: 'M7 3h7l4 4v14H7zM14 3v4h4M9 12h6M9 16h6',
    shirt: 'M8 4l-5 3 2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0z',
    box: 'M3 8l9-5 9 5v8l-9 5-9-5V8zm0 0l9 5 9-5M12 13v8'
  };
  var CAT_ICON = { 'Electronics': 'phone', 'Personal Accessories': 'wallet', 'Documents': 'doc', 'Clothing': 'shirt', 'Others': 'box' };
  LF.icon = function (name, size) {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 18); s.setAttribute('height', size || 18);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONS[name] || ICONS.info); s.appendChild(p);
    return s;
  };
  LF.categoryIcon = function (category, size) { return LF.icon(CAT_ICON[category] || 'box', size); };

  /** Status wording shown to people, and the chip colour for each status the API can return. */
  LF.STATUS = {
    open: { label: 'Still missing', cls: 'blue-outline' },
    available: { label: 'Available to claim', cls: 'blue' },
    pending: { label: 'Claim under review', cls: 'yellow' },
    released: { label: 'Released to owner', cls: '' },
    awaiting: { label: 'Awaiting handover', cls: '' }
  };
  LF.statusChip = function (status) {
    var s = LF.STATUS[status] || { label: status, cls: '' };
    return h('span', { class: 'chip ' + s.cls }, s.label);
  };

  /* ---------- Dates ---------- */
  LF.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  LF.fmtDate = function (iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  LF.fmtDateTime = function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  LF.debounce = function (fn, ms) {
    var t;
    return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
  };

  /* ---------- Logo and illustration ---------- */
  LF.logo = function (onClick) {
    var NS = 'http://www.w3.org/2000/svg';
    var mark;
    if (cfg.logoUrl) mark = h('img', { src: cfg.logoUrl, alt: '' });
    else {
      mark = document.createElementNS(NS, 'svg');
      mark.setAttribute('viewBox', '0 0 32 32'); mark.setAttribute('width', '32'); mark.setAttribute('height', '32'); mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = '<path d="M4 6a3 3 0 0 1 3-3h9.5a3 3 0 0 1 2.1.9l8.5 8.5a3 3 0 0 1 0 4.2l-9.5 9.5a3 3 0 0 1-4.2 0L4.9 17.6A3 3 0 0 1 4 15.5V6z" fill="#ffc72c"/><circle cx="11" cy="10" r="2.4" fill="#1448c8"/>';
    }
    return h(onClick ? 'button' : 'div', { class: 'logo' + (onClick ? ' is-link' : ''), type: onClick ? 'button' : null, onclick: onClick }, mark, h('span', null, cfg.brandName));
  };
  /** Yellow claim tag and magnifying glass, drawn in shapes so no image file is needed. */
  LF.art = function () {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 400 400'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'A yellow claim tag and a magnifying glass');
    s.innerHTML =
      '<circle cx="330" cy="70" r="120" fill="#fff" fill-opacity=".07"/><circle cx="60" cy="360" r="140" fill="#fff" fill-opacity=".07"/>' +
      '<g transform="rotate(-10 200 176)"><path d="M90 120a24 24 0 0 1 24-24h128a24 24 0 0 1 17 7l56 56a24 24 0 0 1 0 34l-56 56a24 24 0 0 1-17 7H114a24 24 0 0 1-24-24z" fill="#ffc72c"/>' +
      '<circle cx="282" cy="176" r="14" fill="#1448c8"/><rect x="120" y="150" width="120" height="12" rx="6" fill="#0e1c44" fill-opacity=".85"/><rect x="120" y="180" width="84" height="12" rx="6" fill="#0e1c44" fill-opacity=".45"/></g>' +
      '<circle cx="285" cy="285" r="48" fill="none" stroke="#fff" stroke-width="12"/><path d="M320 320l45 45" stroke="#fff" stroke-width="14" stroke-linecap="round"/>';
    return s;
  };

  /* ---------- Form pieces ---------- */
  LF.field = function (o) {
    var err = h('div', { class: 'field-error', id: o.id + '-err', role: 'alert' });
    var target = o.control.tagName === 'DIV' ? o.control.querySelector('input') || o.control : o.control;
    target.setAttribute('aria-describedby', (o.hint ? o.id + '-hint ' : '') + o.id + '-err');
    return h('div', { class: 'field', 'data-field': o.name || o.id },
      o.label ? h('label', { for: o.id }, o.label, o.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null) : null,
      o.control, o.hint ? h('div', { class: 'hint', id: o.id + '-hint' }, o.hint) : null, err);
  };
  LF.input = function (id, o) {
    o = o || {};
    return h('input', { type: o.type || 'text', id: id, name: id, value: o.value, placeholder: o.placeholder, autocomplete: o.autocomplete || 'off', inputmode: o.inputmode, max: o.max, maxlength: o.maxlength });
  };
  LF.textarea = function (id, o) { o = o || {}; return h('textarea', { id: id, name: id, placeholder: o.placeholder, rows: o.rows || 4 }); };
  LF.select = function (id, options, placeholder) {
    return h('select', { id: id, name: id }, placeholder ? h('option', { value: '' }, placeholder) : null, options.map(function (o) { return h('option', { value: o }, o); }));
  };
  LF.passwordInput = function (id, autocomplete) {
    var input = LF.input(id, { type: 'password', autocomplete: autocomplete });
    var btn = h('button', { type: 'button', 'aria-controls': id, 'aria-pressed': 'false', 'aria-label': 'Show password', onclick: function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    } }, 'Show');
    return { el: h('div', { class: 'pw' }, input, btn), input: input };
  };
  LF.formError = function () { return h('div', { class: 'form-error', role: 'alert' }); };
  /** Puts { field: message } under each field and the summary at the top of the form. */
  LF.showErrors = function (form, result) {
    form.querySelectorAll('.field').forEach(function (f) {
      f.classList.remove('has-error');
      var e = f.querySelector('.field-error'); if (e) e.textContent = '';
    });
    var summary = form.querySelector('.form-error');
    if (summary) summary.textContent = result.ok ? '' : (result.error || '');
    var first = null;
    Object.keys(result.errors || {}).forEach(function (k) {
      var f = form.querySelector('[data-field="' + k + '"]');
      if (!f) return;
      f.classList.add('has-error');
      var e = f.querySelector('.field-error'); if (e) e.textContent = result.errors[k];
      if (!first) first = f;
    });
    var target = first && first.querySelector('input, select, textarea, button');
    if (target) target.focus();
  };
  /** Disables a button and shows a spinner while the server answers. */
  LF.busy = function (btn, on, idleLabel) {
    btn.disabled = on;
    btn.setAttribute('aria-busy', String(on));
    btn.replaceChildren.apply(btn, on ? [h('span', { class: 'spin', 'aria-hidden': 'true' }), ' Please wait'] : [idleLabel]);
  };

  /* ---------- Photo attach (the wireframe's [Attach] button) ---------- */
  LF.shrinkImage = function (file, maxDim) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error('Choose an image file (JPG or PNG).'));
      if (file.size > cfg.maxPhotoMB * 1024 * 1024) return reject(new Error('That photo is larger than ' + cfg.maxPhotoMB + ' MB. Choose a smaller one.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('That photo could not be prepared.')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That image could not be opened.')); };
      img.src = url;
    });
  };
  /** o: { id, onChange(previewUrl | null) }. Returns { el, getFile(), clear() }. */
  LF.photoField = function (o) {
    var blob = null, url = null;
    var input = h('input', { type: 'file', id: o.id, accept: 'image/*', hidden: true });
    var chip = h('div');
    var err = h('div', { class: 'field-error', role: 'alert' });
    var btn = h('button', { type: 'button', class: 'btn secondary', onclick: function () { input.click(); } }, LF.icon('paperclip', 16), 'Attach');
    function clear() {
      if (url) URL.revokeObjectURL(url);
      blob = null; url = null; input.value = ''; chip.replaceChildren();
      if (o.onChange) o.onChange(null);
    }
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      err.textContent = '';
      LF.shrinkImage(f, cfg.photoMaxDim).then(function (b) {
        if (url) URL.revokeObjectURL(url);
        blob = b; url = URL.createObjectURL(b);
        chip.replaceChildren(h('span', { class: 'file-chip' }, h('span', null, f.name),
          h('button', { type: 'button', 'aria-label': 'Remove photo', onclick: clear }, LF.icon('x', 12))));
        if (o.onChange) o.onChange(url);
      }).catch(function (e) { err.textContent = e.message; input.value = ''; });
    });
    var el = h('div', { class: 'field', 'data-field': 'photo' }, h('div', { class: 'attach-row' }, btn, chip, input), err);
    return { el: el, getFile: function () { return blob; }, clear: clear };
  };

  /* ---------- Overlay (modal dialog) ---------- */
  var active = null;
  LF.closeOverlay = function () { if (active) active.close(); };
  /** o: { title, className }. Returns { body, close, setTitle }. Esc, the X button and a click outside all close it. */
  LF.overlay = function (o) {
    LF.closeOverlay();
    var prev = document.activeElement;
    var titleId = 'dlg-title-' + Date.now();
    var titleEl = h('h2', { id: titleId }, o.title);
    var body = h('div', { class: 'dialog-body' });
    var dialog = h('div', { class: 'dialog ' + (o.className || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
      h('div', { class: 'dialog-head' }, titleEl, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: function () { close(); } }, LF.icon('x', 20))), body);
    var backdrop = h('div', { class: 'backdrop', onmousedown: function (e) { if (e.target === backdrop) close(); } }, dialog);
    function focusables() {
      return Array.prototype.slice.call(dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([hidden]),select,textarea')).filter(function (n) { return n.offsetParent !== null; });
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function close() {
      if (active !== api) return;
      active = null;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      document.body.classList.remove('modal-open');
      if (o.onClose) o.onClose();
      if (prev && prev.focus && document.contains(prev)) prev.focus();
    }
    var api = { body: body, close: close, setTitle: function (t) { titleEl.textContent = t; }, focusFirst: function () {
      var f = focusables().filter(function (n) { return !n.classList.contains('icon-btn'); });
      (f[0] || dialog).focus();
    } };
    active = api;
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');
    return api;
  };

  /* ---------- Toast ---------- */
  LF.toast = function (msg) {
    var host = document.getElementById('toasts');
    if (!host) { host = h('div', { id: 'toasts', class: 'toast-host', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(host); }
    var t = h('div', { class: 'toast' }, msg);
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  };
})();
