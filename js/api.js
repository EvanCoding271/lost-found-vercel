/* api.js — every call the app makes to the server. This file is the contract with the backend.

   The session is an httpOnly cookie that the SERVER sets. The browser never stores a password,
   token or any data. All requests send cookies (credentials: 'include').

   Responses are JSON. Errors are { error: 'message for the person', errors: { fieldName: 'message' } }.
   A 401 on any call except login or "who am I" sends the person back to the login screen.

   AUTH
     POST /api/auth/login    { email, password }
          200 { user }       401 { error }       429 { error }
     POST /api/auth/logout   -> 204
     GET  /api/auth/me       -> 200 { user } | 401
     POST /api/auth/forgot   { email } -> 202 (always, so nobody can test which emails exist)
     POST /api/auth/register { fullName, email, studentId, password }   (students only)
          201 { user } and signs the student in | 409 { error } email taken | 422 { error, errors }
          Accept school-issued emails only (see schoolEmailDomain in config.js) and re-check on the server.
     user = { id, role: 'student' | 'staff', fullName, email, studentId? }
     One sign-in for everyone. The server decides the role from the account and returns it in user.role.

   ITEMS (the landing page)
     GET  /api/items?view=lost|found|pending|claimed|mine&q=search text
          200 { items: [item] }
          lost     open lost reports
          found    found items that staff have recorded and that can be claimed
          pending  found items with at least one claim under review
          claimed  items already released to their owner (item status 'released')
          awaiting (personnel only) found reports not yet received at the office
          mine     everything the signed-in person reported or claimed, in any status
     item = {
       id, ref,                       // ref is the reference number, e.g. 'FND-2026-0004'
       type: 'lost' | 'found',
       name, category,                // category is one of LF_CONFIG.categories
       description,
       place,                         // null when withheld
       date,                          // 'YYYY-MM-DD', the day it was lost or found
       createdAt,                     // ISO timestamp the SERVER stamps on submission
       photo,                         // image URL or null
       status: 'open' | 'available' | 'pending' | 'released' | 'awaiting',
       canClaim,                      // true only if this person may claim it right now
       myClaim: { ref, status } | null
     }
     PRIVACY: the server must apply the masking. For sensitive items (IDs, cards, wallets) return a
     generic name, no place, no photo and a general description. Never send serial numbers, marks or
     contents to students. The page shows exactly what it receives.

   REPORTS (the [Report] overlay), multipart/form-data
     POST /api/reports   fields: type ('lost' | 'found'), name, category, date, place, description,
                         photo (optional image file)
          201 { report: item }
          422 { error, errors: { type?, name?, category?, date?, place?, description?, photo? } }
     A found report starts as status 'awaiting' until staff receive the item.

   CLAIMS (the [Claim] button), multipart/form-data
     POST /api/items/:id/claims   fields: evidence, confirm ('true'), photo (optional image file)
          201 { claim: { ref, status: 'pending' } }
          409 { error }                you already claimed this item, or it can no longer be claimed
          422 { error, errors: { evidence?, confirm?, photo? } }
     Students only. A second pending claim puts the item under dispute for staff to compare.

   PERSONNEL ONLY (server must return 403 to students on all of these)
     GET  /api/items/:id/staff   -> 200 { item, record, claims }
          record = { storage, details, receivedBy, receivedAt } | null   (private identifying details)
          claims = [{ ref, createdAt, status: 'pending'|'approved'|'rejected', evidence, photo,
                      claimant: { fullName, email, studentId }, rationale, decidedBy, decidedAt }]
     POST /api/items/:id/receive { storage, details }  -> 200 { item }  (awaiting -> available)
          422 { errors: { storage?, details? } } | 409 if it was already received
     POST /api/claims/:ref/verification { outcome: 'approved'|'rejected', rationale }  -> 200 { claim }
          rationale is required (422). One decision per claim (409 if already decided). Store who and when.
          If every claim on an item ends up rejected, move the item back to 'available'.
     POST /api/items/:id/release { claimRef }  -> 200 { item }  (status becomes 'released')
          409 { error } unless at least one claim on the item is 'approved'. This rule lives on the server.
   Found reports from personnel may include an optional field onBehalfOf (the finder's name and contact).

   Every function resolves to { ok: true, status, data } or { ok: false, status, error, errors }.
   Network problems resolve to { ok: false, status: 0, error: 'Cannot reach the server...' }. */
(function () {
  'use strict';
  var LF = (window.LF = window.LF || {});
  var cfg = window.LF_CONFIG;
  var NETWORK_ERROR = 'Cannot reach the server. Check your connection and try again.';

  /** Called when the server says the session is over. app.js sets this. */
  LF.onSessionExpired = function () {};

  function fallback(status) {
    if (status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (status >= 500) return 'The server had a problem. Try again in a moment.';
    return 'Something went wrong (' + status + ').';
  }

  function request(method, path, opts) {
    opts = opts || {};
    var url = cfg.apiBase + path;
    if (opts.query) {
      var qs = Object.keys(opts.query).filter(function (k) { return opts.query[k] !== '' && opts.query[k] != null; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(opts.query[k]); }).join('&');
      if (qs) url += '?' + qs;
    }
    var init = { method: method, credentials: 'include', headers: { Accept: 'application/json' } };
    if (opts.json !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.json); }
    if (opts.form) init.body = opts.form; // the browser adds the multipart boundary itself
    return fetch(url, init).then(function (res) {
      if (res.status === 204) return { ok: true, status: 204, data: {} };
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return { ok: true, status: res.status, data: data };
        if (res.status === 401 && !opts.noExpire) LF.onSessionExpired();
        return { ok: false, status: res.status, error: data.error || fallback(res.status), errors: data.errors || {} };
      });
    }).catch(function () { return { ok: false, status: 0, error: NETWORK_ERROR, errors: {} }; });
  }

  function formOf(fields, photo) {
    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    if (photo) fd.append('photo', photo, 'photo.jpg');
    return fd;
  }

  var real = {
    login: function (b) { return request('POST', '/api/auth/login', { json: b, noExpire: true }); },
    logout: function () { return request('POST', '/api/auth/logout', { noExpire: true }); },
    me: function () { return request('GET', '/api/auth/me', { noExpire: true }); },
    forgot: function (b) { return request('POST', '/api/auth/forgot', { json: b, noExpire: true }); },
    listItems: function (q) { return request('GET', '/api/items', { query: { view: q.view, q: q.q } }); },
    createReport: function (fields, photo) { return request('POST', '/api/reports', { form: formOf(fields, photo) }); },
    createClaim: function (itemId, fields, photo) { return request('POST', '/api/items/' + encodeURIComponent(itemId) + '/claims', { form: formOf(fields, photo) }); },
    register: function (b) { return request('POST', '/api/auth/register', { json: b, noExpire: true }); },
    staffItem: function (id) { return request('GET', '/api/items/' + encodeURIComponent(id) + '/staff'); },
    verifyLostItem: function (id) { return request('POST', '/api/lost-items/' + encodeURIComponent(id) + '/verification'); },
    receiveItem: function (id, b) { return request('POST', '/api/items/' + encodeURIComponent(id) + '/receive', { json: b }); },
    verifyClaim: function (claimRef, b) { return request('POST', '/api/claims/' + encodeURIComponent(claimRef) + '/verification', { json: b }); },
    releaseItem: function (id, b) { return request('POST', '/api/items/' + encodeURIComponent(id) + '/release', { json: b }); }
  };

  if (cfg.mock && !LF.mock) { if (window.console) console.error('LF_CONFIG.mock is true but js/mock.js is not loaded. Using the real API.'); }
  LF.api = cfg.mock && LF.mock ? LF.mock : real;
})();
