/* mock.js — DEMO MODE ONLY. Stands in for the server so the screens can be shown and tested.
   Everything lives in memory: nothing is saved, and a refresh starts over (and signs you out).
   It answers exactly like the real API described in js/api.js. Delete this file when the backend is live
   and set mock: false in js/config.js. */
(function () {
  'use strict';
  var LF = (window.LF = window.LF || {});
  var DELAY = 350;

  function wait(v, ms) { return new Promise(function (r) { setTimeout(function () { r(v); }, ms == null ? DELAY : ms); }); }
  function ok(data, status) { return { ok: true, status: status || 200, data: data }; }
  function bad(status, error, errors) { return { ok: false, status: status, error: error, errors: errors || {} }; }
  function iso(daysAgo) {
    var d = new Date(); d.setDate(d.getDate() - daysAgo);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* Sample photos drawn as shapes in the app colours */
  function sample(kind) {
    var shapes = {
      phone: '<rect x="135" y="40" width="70" height="120" rx="12" fill="#ffc72c"/><rect x="146" y="54" width="48" height="84" rx="4" fill="#1448c8"/>',
      laptop: '<rect x="95" y="52" width="150" height="90" rx="8" fill="#1448c8"/><rect x="107" y="64" width="126" height="66" rx="3" fill="#dfe8ff"/><rect x="70" y="146" width="200" height="12" rx="6" fill="#ffc72c"/>',
      umbrella: '<path d="M70 110a100 80 0 0 1 200 0z" fill="#1448c8"/><rect x="167" y="108" width="6" height="52" fill="#0e1c44"/><path d="M170 160a10 10 0 0 1-20 0" stroke="#ffc72c" stroke-width="6" fill="none" stroke-linecap="round"/>',
      bottle: '<rect x="150" y="30" width="40" height="22" rx="6" fill="#ffc72c"/><rect x="140" y="50" width="60" height="112" rx="16" fill="#1448c8"/>',
      bag: '<rect x="110" y="60" width="120" height="100" rx="22" fill="#1448c8"/><path d="M140 62v-8a30 30 0 0 1 60 0v8" stroke="#0e1c44" stroke-width="8" fill="none"/><rect x="132" y="104" width="76" height="30" rx="8" fill="#ffc72c"/>',
      generic: '<rect x="120" y="50" width="100" height="100" rx="20" fill="#ffc72c"/><circle cx="170" cy="100" r="22" fill="#1448c8"/>'
    };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 200"><rect width="340" height="200" fill="#dfe8ff"/>' + shapes[kind || 'generic'] +
      '<text x="170" y="190" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#4f5d80">SAMPLE PHOTO</text></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  var counters = { FND: 20, CLM: 10, LST: 20 };
  function ref(p) { counters[p] += 1; return p + '-' + new Date().getFullYear() + '-' + String(counters[p]).padStart(4, '0'); }
  var yr = new Date().getFullYear();

  var items = [
    { id: 'l1', ref: 'LST-' + yr + '-0001', type: 'lost', name: 'Gray scientific calculator', category: 'Electronics', description: 'Slide-on cover, name scratched on the back. Left after a quiz.', place: 'Room 204', date: iso(3), photo: null, status: 'open' },
    { id: 'l2', ref: 'LST-' + yr + '-0002', type: 'lost', name: 'Green spiral notebook', category: 'Others', description: 'Rubber band around it and doodles on the cover.', place: 'Room 101', date: iso(5), photo: sample('generic'), status: 'open', mine: true },
    { id: 'l3', ref: 'LST-' + yr + '-0003', type: 'lost', name: 'House keys on a red lanyard', category: 'Personal Accessories', description: 'Three keys and a small brass tag.', place: 'Canteen', date: iso(1), photo: sample('generic'), status: 'open' },
    { id: 'l4', ref: 'LST-' + yr + '-0004', type: 'lost', name: 'Navy blue backpack', category: 'Others', description: 'White zipper pull and a keychain with a small bear.', place: 'Gymnasium', date: iso(6), photo: sample('bag'), status: 'open' },
    { id: 'f1', ref: 'FND-' + yr + '-0001', type: 'found', name: 'Black smartphone', category: 'Electronics', description: 'Black phone in a clear case, screen off. Found on a study table.', place: 'Library, 2nd floor', date: iso(3), photo: sample('phone'), status: 'available' },
    { id: 'f2', ref: 'FND-' + yr + '-0002', type: 'found', name: 'Blue folding umbrella', category: 'Others', description: 'Dark blue umbrella with a wooden handle.', place: 'Main Building lobby', date: iso(9), photo: sample('umbrella'), status: 'available' },
    { id: 'f3', ref: 'FND-' + yr + '-0003', type: 'found', name: 'Gray zip-up hoodie', category: 'Clothing', description: 'Size M, slightly worn.', place: 'Gymnasium', date: iso(12), photo: null, status: 'available' },
    { id: 'f4', ref: 'FND-' + yr + '-0004', type: 'found', name: 'Wireless earbud case', category: 'Electronics', description: 'White charging case, found near the windows.', place: 'Cafeteria', date: iso(2), photo: sample('generic'), status: 'available', mine: true },
    { id: 'f5', ref: 'FND-' + yr + '-0005', type: 'found', name: 'ID or document', category: 'Documents', description: 'Details are withheld to protect the owner’s privacy. Describe it when you claim.', place: null, date: iso(5), photo: null, status: 'available' },
    { id: 'p1', ref: 'FND-' + yr + '-0006', type: 'found', name: 'Silver laptop', category: 'Electronics', description: 'Silver 14-inch laptop, closed, no bag.', place: 'Room 312', date: iso(12), photo: sample('laptop'), status: 'pending' },
    { id: 'p2', ref: 'FND-' + yr + '-0007', type: 'found', name: 'Black backpack', category: 'Others', description: 'Black backpack with a laptop sleeve.', place: 'Library entrance', date: iso(8), photo: sample('bag'), status: 'pending' },
    { id: 'c1', ref: 'FND-' + yr + '-0008', type: 'found', name: 'Steel water bottle', category: 'Others', description: 'Green cap and a sticker on the side.', place: 'Room 105', date: iso(20), photo: sample('bottle'), status: 'released' },
    { id: 'c2', ref: 'FND-' + yr + '-0009', type: 'found', name: 'Red umbrella', category: 'Others', description: 'Compact red umbrella.', place: 'Library', date: iso(25), photo: sample('umbrella'), status: 'released' }
  ];

  items.push({ id: 'f6', ref: 'FND-' + yr + '-0010', type: 'found', name: 'Blue wallet', category: 'Personal Accessories', description: 'Small blue wallet handed in by a student. Contents stay private.', place: 'Canteen', date: iso(0), photo: null, status: 'awaiting' });
  var NOW = Date.now();
  function ts(min) { return new Date(NOW - min * 60000).toISOString(); }
  items.forEach(function (i, k) {
    i.createdAt = ts(1440 * (k + 1)); i.claims = [];
    if (i.type === 'found' && i.status !== 'awaiting') i.record = { storage: 'Shelf ' + (k % 4 + 1), details: 'Marks and serial details noted at intake.', receivedBy: 'Front desk', receivedAt: i.createdAt };
  });
  function byId(id) { return items.filter(function (i) { return i.id === id; })[0]; }
  byId('f6').createdAt = ts(5);
  byId('p1').record.details = 'Serial ends 4F2K. Yellow sticker inside the lid. Scratch near the trackpad.';
  function person(n, e, sid) { return { fullName: n, email: e, studentId: sid }; }
  function seed(id, n, who, ev, min) { byId(id).claims.push({ ref: 'CLM-' + yr + '-000' + n, userId: 'u-' + who.email, createdAt: ts(min), status: 'pending', evidence: ev, photo: null, claimant: who, rationale: null, decidedBy: null, decidedAt: null }); }
  seed('p1', 1, person('Ana Reyes', 'ana.reyes@school.edu', '2024-0112'), 'Serial number ends in 4F2K. There is a yellow sticker inside the lid and a scratch near the trackpad.', 300);
  seed('p1', 2, person('Joel Mercado', 'joel.mercado@school.edu', '2023-0457'), 'Silver 14-inch laptop in a blue sleeve. The lock screen is a photo of a beach.', 120);
  seed('p2', 3, person('Mika Lim', 'mika.lim@school.edu', '2025-0033'), 'Red keychain on the zipper and my PE uniform inside.', 600);
  function myClaimOf(item) {
    if (!session) return null;
    var c = (item.claims || []).filter(function (x) { return x.userId === session.id; })[0];
    return c ? { ref: c.ref, status: c.status } : null;
  }

  var session = null;

  function view(item) {
    var claimable = session && session.role === 'student' && item.type === 'found' && (item.status === 'available' || item.status === 'pending') && !myClaimOf(item);
    return { id: item.id, ref: item.ref, type: item.type, name: item.name, category: item.category, description: item.description, place: item.place,
      date: item.date, photo: item.photo, status: item.status, canClaim: !!claimable, myClaim: myClaimOf(item), createdAt: item.createdAt };
  }
  var VIEWS = {
    lost: function (i) { return i.type === 'lost' && i.status === 'open'; },
    found: function (i) { return i.type === 'found' && i.status === 'available'; },
    pending: function (i) { return i.type === 'found' && i.status === 'pending'; },
    claimed: function (i) { return i.status === 'released'; },
    mine: function (i) { return !!(i.mine || myClaimOf(i)); }
  };

  function needSession() { return session ? null : bad(401, 'Your session ended. Sign in again.'); }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  LF.mock = {
    login: function (b) {
      if (!EMAIL.test(b.email || '') || !b.password) return wait(bad(422, 'Enter your email and password.'));
      if (b.password === 'wrong') return wait(bad(401, 'Email or password is incorrect.'));
      var isStaff = /^staff/i.test(b.email); // DEMO ONLY: emails starting with "staff" are personnel. The real server reads the role from the account.
      var name = b.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      session = { id: 'u-' + b.email.toLowerCase(), role: isStaff ? 'staff' : 'student', fullName: name, email: b.email };
      return wait(ok({ user: session }));
    },
    logout: function () { session = null; return wait(ok({}, 204), 150); },
    me: function () { return wait(session ? ok({ user: session }) : bad(401, ''), 150); },
    forgot: function () { return wait(ok({}, 202)); },
    listItems: function (q) {
      var s = needSession(); if (s) return wait(s, 100);
      if (!VIEWS[q.view]) return wait(bad(422, 'Unknown view.'));
      var term = (q.q || '').trim().toLowerCase();
      var list = items.filter(VIEWS[q.view]).filter(function (i) {
        return !term || (i.name + ' ' + i.description + ' ' + i.category + ' ' + (i.place || '') + ' ' + i.ref).toLowerCase().indexOf(term) >= 0;
      }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).map(view);
      return wait(ok({ items: list }));
    },
    createReport: function (f, photo) {
      var s = needSession(); if (s) return wait(s, 100);
      var e = {};
      if (f.type !== 'lost' && f.type !== 'found') e.type = 'Choose lost or found.';
      if (!f.name || f.name.trim().length < 3) e.name = 'Name the item, for example "Black umbrella".';
      if (LF_CONFIG.categories.indexOf(f.category) < 0) e.category = 'Choose a category.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '') || f.date > iso(0)) e.date = 'Enter a valid date that is not in the future.';
      if (!f.place || !f.place.trim()) e.place = 'Say where it was ' + (f.type === 'found' ? 'found.' : 'lost.');
      if (!f.description || f.description.trim().length < 10) e.description = 'Add a little more detail (at least 10 characters).';
      if (Object.keys(e).length) return wait(bad(422, 'Please fix the highlighted fields.', e));
      var item = { id: 'n' + Date.now(), ref: ref(f.type === 'lost' ? 'LST' : 'FND'), type: f.type, name: f.name.trim(), category: f.category, description: f.description.trim(),
        place: f.place.trim(), date: f.date, photo: photo ? URL.createObjectURL(photo) : null, status: f.type === 'lost' ? 'open' : 'awaiting', mine: true,
        createdAt: new Date().toISOString(), onBehalfOf: f.onBehalfOf || null, claims: [], record: null };
      items.push(item);
      return wait(ok({ report: view(item) }, 201), 500);
    },
    createClaim: function (id, f, photo) {
      var s = needSession(); if (s) return wait(s, 100);
      if (session.role !== 'student') return wait(bad(403, 'Only students can submit claims.'));
      var item = items.filter(function (i) { return i.id === id; })[0];
      if (!item || item.type !== 'found' || (item.status !== 'available' && item.status !== 'pending')) return wait(bad(409, 'This item can no longer be claimed.'));
      if (myClaimOf(item)) return wait(bad(409, 'You already submitted a claim for this item.'));
      var e = {};
      if (!f.evidence || f.evidence.trim().length < 10) e.evidence = 'Describe at least one detail only the owner would know (at least 10 characters).';
      if (f.confirm !== 'true') e.confirm = 'Confirm that the item is yours.';
      if (Object.keys(e).length) return wait(bad(422, 'Please fix the highlighted fields.', e));
      var claim = { ref: ref('CLM'), userId: session.id, createdAt: new Date().toISOString(), status: 'pending', evidence: f.evidence.trim(), photo: photo ? URL.createObjectURL(photo) : null,
        claimant: person(session.fullName, session.email, session.studentId || ''), rationale: null, decidedBy: null, decidedAt: null };
      item.claims.push(claim); item.status = 'pending';
      return wait(ok({ claim: { ref: claim.ref, status: 'pending' } }, 201), 500);
    }
  };

  /* ----- registration and personnel tools ----- */
  var registered = {};
  VIEWS.awaiting = function (i) { return i.type === 'found' && i.status === 'awaiting'; };
  function needStaff() { return needSession() || (session.role === 'staff' ? null : bad(403, 'Only personnel can do this.')); }
  function publicClaim(c) { var o = {}; Object.keys(c).forEach(function (k) { if (k !== 'userId') o[k] = c[k]; }); return o; }
  var baseList = LF.mock.listItems;
  LF.mock.listItems = function (q) {
    if (q.view === 'awaiting' && (!session || session.role !== 'staff')) return wait(bad(403, 'Only personnel can see this list.'));
    return baseList(q);
  };
  Object.assign(LF.mock, {
    register: function (b) {
      var e = {}, dom = LF_CONFIG.schoolEmailDomain, email = (b.email || '').trim().toLowerCase();
      if (!b.fullName || b.fullName.trim().length < 3) e.fullName = 'Enter your full name.';
      if (!EMAIL.test(email)) e.email = 'Enter your school email address.';
      else if (dom && email.slice(-(dom.length + 1)) !== '@' + dom.toLowerCase()) e.email = 'Use your school-issued email (ending in @' + dom + ').';
      if (!b.studentId || b.studentId.trim().length < 4) e.studentId = 'Enter your student ID number.';
      if (!b.password || b.password.length < 8) e.password = 'Use at least 8 characters.';
      if (Object.keys(e).length) return wait(bad(422, 'Please fix the highlighted fields.', e));
      if (registered[email] || /^staff/i.test(email)) return wait(bad(409, 'An account with this email already exists. Sign in instead.'));
      registered[email] = true;
      session = { id: 'u-' + email, role: 'student', fullName: b.fullName.trim(), email: email, studentId: b.studentId.trim() };
      return wait(ok({ user: session }, 201), 500);
    },
    staffItem: function (id) {
      var s = needStaff(); if (s) return wait(s, 100);
      var item = byId(id); if (!item) return wait(bad(404, 'Item not found.'));
      return wait(ok({ item: view(item), record: item.record || null, claims: item.claims.map(publicClaim) }));
    },
    receiveItem: function (id, f) {
      var s = needStaff(); if (s) return wait(s, 100);
      var item = byId(id); if (!item || item.status !== 'awaiting') return wait(bad(409, 'This item was already received.'));
      var e = {};
      if (!f.storage || f.storage.trim().length < 2) e.storage = 'Say where the item is kept.';
      if (!f.details || f.details.trim().length < 5) e.details = 'Record at least one identifying detail.';
      if (Object.keys(e).length) return wait(bad(422, 'Please fix the highlighted fields.', e));
      item.record = { storage: f.storage.trim(), details: f.details.trim(), receivedBy: session.fullName, receivedAt: new Date().toISOString() };
      item.status = 'available';
      return wait(ok({ item: view(item) }));
    },
    verifyClaim: function (claimRef, f) {
      var s = needStaff(); if (s) return wait(s, 100);
      var item = items.filter(function (i) { return (i.claims || []).some(function (c) { return c.ref === claimRef; }); })[0];
      if (!item) return wait(bad(404, 'Claim not found.'));
      var claim = item.claims.filter(function (c) { return c.ref === claimRef; })[0];
      if (claim.status !== 'pending') return wait(bad(409, 'This claim already has an outcome.'));
      var e = {};
      if (f.outcome !== 'approved' && f.outcome !== 'rejected') e.outcome = 'Choose Approve or Reject.';
      if (!f.rationale || f.rationale.trim().length < 10) e.rationale = 'Write a rationale (at least 10 characters).';
      if (Object.keys(e).length) return wait(bad(422, 'Please fix the highlighted fields.', e));
      claim.status = f.outcome; claim.rationale = f.rationale.trim(); claim.decidedBy = session.fullName; claim.decidedAt = new Date().toISOString();
      if (!item.claims.some(function (c) { return c.status === 'pending' || c.status === 'approved'; })) item.status = 'available';
      return wait(ok({ claim: publicClaim(claim) }));
    },
    releaseItem: function (id, f) {
      var s = needStaff(); if (s) return wait(s, 100);
      var item = byId(id); if (!item) return wait(bad(404, 'Item not found.'));
      if (!item.claims.some(function (c) { return c.status === 'approved'; })) return wait(bad(409, 'Cannot release: no claim on this item has been approved.'));
      item.status = 'released';
      return wait(ok({ item: view(item) }));
    }
  });
})();
