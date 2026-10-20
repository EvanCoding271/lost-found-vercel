/* login.js — the login screen, the first and only screen anyone sees before signing in.
   Layout follows the wireframe: logo header, large visual on the left, sign-in card on the right,
   There is one sign-in for everyone. The server decides whether the account is a student or personnel. */
(function () {
  'use strict';
  var LF = window.LF, h = LF.h;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** o: { onSignedIn(user), notice } */
  LF.screens.login = function (o) {
    var email = LF.input('email', { type: 'email', autocomplete: 'username', placeholder: 'name@example.com', inputmode: 'email' });
    var pw = LF.passwordInput('password', 'current-password');
    var submit = h('button', { class: 'btn block', type: 'submit' }, 'Sign in');

    var reg = h('button', { type: 'button', class: 'linkbtn', onclick: function () { LF.overlays.register({ onSignedIn: o.onSignedIn }); } }, 'Create a student account');
    var form = h('form', { class: 'login-card', novalidate: true, 'aria-label': 'Sign in', onsubmit: function (e) {
      e.preventDefault();
      var errs = {};
      if (!EMAIL.test(email.value.trim())) errs.email = 'Enter your email address, for example name@school.edu.';
      if (!pw.input.value) errs.password = 'Enter your password.';
      if (Object.keys(errs).length) return LF.showErrors(form, { ok: false, error: 'Please fix the highlighted fields.', errors: errs });
      LF.showErrors(form, { ok: true });
      LF.busy(submit, true);
      LF.api.login({ email: email.value.trim(), password: pw.input.value }).then(function (r) {
        LF.busy(submit, false, 'Sign in');
        if (!r.ok) return LF.showErrors(form, r);
        pw.input.value = '';
        o.onSignedIn(r.data.user);
      });
    } },
      o.notice ? h('div', { class: 'notice', role: 'status' }, o.notice) : null,
      LF.formError(),
      LF.field({ id: 'email', label: 'Email', control: email }),
      LF.field({ id: 'password', label: 'Password', control: pw.el }),
      submit,
      h('button', { type: 'button', class: 'linkbtn', onclick: function () { LF.overlays.forgot(); } }, 'Forgot password?'), reg);
    form.style.gap = '18px';

    return h('div', null,
      h('a', { class: 'skip-link', href: '#main' }, 'Skip to sign in'),
      h('header', { class: 'topbar' }, h('div', { class: 'topbar-inner' }, LF.logo())),
      h('main', { id: 'main', class: 'login-main' },
        h('section', { class: 'login-art', 'aria-label': 'About Lost and Found' }, h('h2', null, 'Lost something? Found something?'),
          h('p', null, 'Report it, search what has been handed in, and claim what is yours.'), LF.art()),
        h('section', { class: 'login-side', 'aria-label': 'Sign in' }, h('h1', { class: 'sr-only' }, 'Sign in to ' + window.LF_CONFIG.brandName), form)));
  };
})();
