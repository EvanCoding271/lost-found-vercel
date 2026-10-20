/* app.js — start-up and the sign-in gate.

   The page opens on a plain loading screen. The server is asked who is signed in:
     no session -> the login screen (the only screen a signed-out person can ever see)
     session    -> the home page
   The home page is not built at all until the server has confirmed a student or personnel account.
   Signing out, or a session that ends, goes straight back to login. */
(function () {
  'use strict';
  var LF = window.LF;
  var brand = window.LF_CONFIG.brandName;
  var root = document.getElementById('app');
  var user = null;

  function show(node, title) { LF.closeOverlay(); root.replaceChildren(node); document.title = title + ' · ' + brand; window.scrollTo(0, 0); }

  function toLogin(notice) {
    user = null;
    show(LF.screens.login({ notice: notice, onSignedIn: toHome }), 'Sign in');
  }
  function toHome(signedIn) {
    user = signedIn;
    show(LF.screens.landing(user, { onSignOut: function () { LF.api.logout().then(function () { toLogin(); }); } }), 'Items');
  }

  LF.onSessionExpired = function () { if (user) toLogin('Your session ended. Sign in again.'); };

  function start() {
    LF.api.me().then(function (r) {
      if (r.ok && r.data && r.data.user) toHome(r.data.user); else toLogin();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
