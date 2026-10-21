/* landing.js — the home page. It is built only after the server confirms a signed-in person.
   Layout follows the wireframe: header with logo, links and [Report]; four filter buttons and a
   search; a grid of cards. Clicking a card opens the item overlay. */
(function () {
  'use strict';
  var LF = window.LF, h = LF.h;

  var VIEWS = [['lost', 'Reported Lost'], ['found', 'Found'], ['pending', 'Pending'], ['claimed', 'Claimed']];
  var EMPTY = {
    lost: ['No lost reports right now', 'When someone reports a missing item, it shows up here.'],
    found: ['No found items to claim', 'Items handed in to the office appear here once staff record them.'],
    pending: ['Nothing is waiting for review', 'Items with a claim under review appear here.'],
    claimed: ['No items returned yet', 'Items released to their owners appear here.'],
    awaiting: ['Nothing is waiting to be received', 'Found reports stay here until the item is handed in to the office.'],
    mine: ['You have no reports or claims yet', 'Press Report to add a lost or found item. Items you claim will show up here too.']
  };

  /** user: the signed-in person. handlers: { onSignOut } */
  LF.screens.landing = function (user, handlers) {
    var state = { view: 'lost', q: '', seq: 0 };
    function tabList() { return user.role === 'staff' ? [VIEWS[0], VIEWS[1], ['awaiting', 'To receive'], VIEWS[2], VIEWS[3]] : VIEWS; }

    /* ----- header ----- */
    var navEls = {};
    var nav = h('nav', { class: 'nav', id: 'site-nav', 'aria-label': 'Main' });
    var menuBtn = h('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-label': 'Menu', 'aria-expanded': 'false', 'aria-controls': 'site-nav', onclick: function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    } }, LF.icon('menu', 20));
    function link(key, label, fn) {
      var b = h('button', { type: 'button', class: 'navlink', onclick: function () { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); fn(); } }, label);
      navEls[key] = b; nav.appendChild(b);
    }
    link('home', 'Home', function () { search.value = ''; state.q = ''; setView('lost'); });
    link('mine', 'My reports', function () { setView('mine'); });
    link('how', 'How it works', function () { LF.overlays.how(); });
    link('out', 'Sign out', function () { handlers.onSignOut(); });
    var reportBtn = h('button', { type: 'button', class: 'btn yellow report-btn', onclick: function () {
      LF.overlays.report({ user: user, onSubmitted: function (report, type) {
        LF.toast(type === 'lost' ? 'Lost report saved.' : 'Found report saved. Hand the item to the office so staff can record it.');
        if (state.view === (type === 'lost' ? 'lost' : 'mine')) load(); else setView(type === 'lost' ? 'lost' : 'mine');
      } });
    } }, 'Report');
    var header = h('header', { class: 'topbar' }, h('div', { class: 'topbar-inner' }, LF.logo(function () { navEls.home.click(); }), reportBtn, nav, menuBtn));

    /* ----- filters ----- */
    var tabs = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Show items' });
    function drawTabs() {
      tabs.replaceChildren.apply(tabs, tabList().map(function (v) {
        return h('button', { type: 'button', class: 'tab', 'aria-pressed': String(state.view === v[0]), onclick: function () { setView(v[0]); } }, v[1]);
      }));
      navEls.home.setAttribute('aria-current', state.view === 'mine' ? 'false' : 'page');
      if (state.view === 'mine') navEls.mine.setAttribute('aria-current', 'page'); else navEls.mine.removeAttribute('aria-current');
      if (state.view === 'mine') navEls.home.removeAttribute('aria-current');
    }
    var search = h('input', { type: 'search', id: 'search', name: 'search', placeholder: 'Search', 'aria-label': 'Search items', autocomplete: 'off',
      oninput: LF.debounce(function () { state.q = search.value; load(); }, 250) });
    var searchBox = h('form', { class: 'search', role: 'search', onsubmit: function (e) { e.preventDefault(); state.q = search.value; load(); } }, search, LF.icon('search', 20));
    var context = h('div', { class: 'context-bar' });
    var grid = h('div', { class: 'grid', 'aria-busy': 'false' });
    var count = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });

    function setView(v) { state.view = v; drawTabs(); drawContext(); load(); }
    function drawContext() {
      context.replaceChildren();
      if (state.view === 'mine') context.append(h('strong', null, 'My reports'), h('span', null, 'Items you reported or claimed.'),
        h('button', { type: 'button', class: 'linkbtn', onclick: function () { setView('lost'); } }, 'Show all items'));
    }

    /* ----- grid ----- */
    function skeleton() {
      grid.setAttribute('aria-busy', 'true');
      var n = []; for (var i = 0; i < 8; i++) n.push(h('div', { class: 'skel', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
      grid.replaceChildren.apply(grid, n);
    }
    function card(item) {
      return h('button', { type: 'button', class: 'card', onclick: function () { (user.role === 'staff' ? (item.type === 'found' ? LF.overlays.staffItem : LF.overlays.staffLostItem) : LF.overlays.item)(item, { user: user, onChanged: load }); } },
        h('span', { class: 'thumb' },
          item.photo ? h('img', { src: item.photo, alt: '', loading: 'lazy' }) : h('span', { class: 'ph' }, LF.categoryIcon(item.category, 22)),
          state.view === 'mine' ? h('span', { class: 'badge' }, LF.statusChip(item.status)) : null),
        h('span', { class: 'card-name' }, item.name),
        h('span', { class: 'card-desc' }, item.description || ''));
    }
    function showState(title, text, action) {
      grid.setAttribute('aria-busy', 'false');
      grid.replaceChildren(h('div', { class: 'state' }, h('h2', { style: { fontSize: '1.2rem' } }, title), text ? h('p', null, text) : null, action || null));
    }
    function load() {
      var mine = ++state.seq;
      skeleton();
      LF.api.listItems({ view: state.view, q: state.q.trim() }).then(function (r) {
        if (mine !== state.seq) return; // a newer request replaced this one
        if (!r.ok) { count.textContent = ''; return showState('The list could not load', r.error, h('button', { type: 'button', class: 'btn secondary', onclick: load }, 'Try again')); }
        var items = r.data.items || [];
        count.textContent = items.length + (items.length === 1 ? ' item' : ' items');
        if (!items.length) {
          var q = state.q.trim();
          return q ? showState('Nothing matches “' + q + '”', 'Check the spelling or try a different word.', h('button', { type: 'button', class: 'btn secondary', onclick: function () { search.value = ''; state.q = ''; load(); } }, 'Clear search'))
            : showState(EMPTY[state.view][0], EMPTY[state.view][1]);
        }
        grid.setAttribute('aria-busy', 'false');
        grid.replaceChildren.apply(grid, items.map(card));
      });
    }

    var root = h('div', null, h('a', { class: 'skip-link', href: '#main' }, 'Skip to items'), header,
      h('main', { id: 'main', class: 'page' }, h('h1', { class: 'sr-only' }, 'Items'), h('div', { class: 'filters' }, tabs, searchBox), context, count, grid));
    drawTabs(); drawContext(); load();
    return root;
  };
})();
