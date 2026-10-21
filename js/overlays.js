/* overlays.js — the pop-ups: report an item, item information (with the claim step),
   forgot password, and how it works. */
(function () {
  'use strict';
  var LF = window.LF, h = LF.h, cfg = window.LF_CONFIG;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------- Report an item (wireframe: Submission Requests overlay) ---------- */
  /** o: { user, onSubmitted(report, type) } */
  LF.overlays.report = function (o) {
    var submitted = null;
    var m = LF.overlay({ title: 'Report an item', className: 'dlg-report', onClose: function () { if (submitted) o.onSubmitted(submitted.report, submitted.type); } });
    var type = 'lost';

    function radio(value, label, checked) {
      var input = h('input', { type: 'radio', name: 'type', value: value, onchange: function () { type = value; refreshHints(); } });
      if (checked) input.checked = true;
      return h('label', null, input, h('span', null, label));
    }
    var typeField = h('fieldset', { class: 'field seg', 'data-field': 'type' }, h('legend', { class: 'sr-only' }, 'What are you reporting?'),
      radio('lost', 'I lost something', true), radio('found', 'I found something', false));

    var name = LF.input('r-name', { placeholder: 'For example: Black umbrella' });
    var category = LF.select('r-category', cfg.categories, 'Choose a category');
    var date = LF.input('r-date', { type: 'date', max: LF.todayISO() }); date.value = LF.todayISO();
    var place = LF.input('r-place', { placeholder: 'Library, 2nd floor' });
    var desc = LF.textarea('r-description', { placeholder: 'Colour, brand, size, marks' });
    var dateLabel = h('span', null, 'Date lost'), placeLabel = h('span', null, 'Where did you lose it?');
    var descHint = h('div', { class: 'hint', id: 'r-description-hint' });
    var behalf = LF.input('r-behalf', { placeholder: 'Name and contact of the finder' });
    var behalfField = LF.field({ id: 'r-behalf', name: 'onBehalfOf', label: 'Finder (name and contact)', control: behalf, hint: 'Optional. Use this when someone hands the item in to you at the office.' });
    behalfField.style.display = 'none';

    var visual = h('div', { class: 'visual art' }, h('p', null, 'A clear photo and the exact place help the owner.'), LF.art());
    var photo = LF.photoField({ id: 'r-photo', onChange: function (url) {
      visual.className = url ? 'visual has-photo' : 'visual art';
      visual.replaceChildren.apply(visual, url ? [h('img', { src: url, alt: 'Preview of your attached photo' })] : [h('p', null, 'A clear photo and the exact place help the owner.'), LF.art()]);
    } });

    function refreshHints() {
      var found = type === 'found';
      behalfField.style.display = (o.user.role === 'staff' && found) ? '' : 'none';
      dateLabel.textContent = found ? 'Date found' : 'Date lost';
      placeLabel.textContent = found ? 'Where did you find it?' : 'Where did you lose it?';
      descHint.textContent = found ? 'Keep serial numbers and personal details off this form. Staff record them when the item is handed in.' : 'Mention anything that would help staff recognise it.';
    }
    refreshHints();

    var submit = h('button', { type: 'submit', class: 'btn' }, 'Submit');
    function fields() {
      var f = { type: type, name: name.value.trim(), category: category.value, date: date.value, place: place.value.trim(), description: desc.value.trim() };
      if (o.user.role === 'staff' && type === 'found' && behalf.value.trim()) f.onBehalfOf = behalf.value.trim();
      return f;
    }
    var form = h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var errs = {};
      if (name.value.trim().length < 3) errs.name = 'Name the item, for example "Black umbrella".';
      if (!category.value) errs.category = 'Choose a category.';
      if (!date.value || date.value > LF.todayISO()) errs.date = 'Enter a valid date that is not in the future.';
      if (!place.value.trim()) errs.place = type === 'found' ? 'Say where you found it.' : 'Say where you think you lost it.';
      if (desc.value.trim().length < 10) errs.description = 'Add a little more detail (at least 10 characters).';
      if (Object.keys(errs).length) return LF.showErrors(form, { ok: false, error: 'Please fix the highlighted fields.', errors: errs });
      LF.showErrors(form, { ok: true });
      LF.busy(submit, true);
      LF.api.createReport(fields(), photo.getFile()).then(function (r) {
        LF.busy(submit, false, 'Submit');
        if (!r.ok) return LF.showErrors(form, r);
        submitted = { report: r.data.report, type: type };
        m.body.replaceChildren(h('div', { class: 'done', role: 'status' }, h('div', { class: 'tick' }, LF.icon('check', 24)), h('h3', { class: 'heading' }, 'Report submitted'),
          h('p', null, 'Your reference number is'), h('div', { class: 'ref' }, r.data.report.ref),
          h('p', { class: 'muted' }, 'Recorded on ' + LF.fmtDateTime(r.data.report.createdAt) + '.' + (type === 'found' ? ' Hand the item to the Lost & Found office so staff can record it.' : '')),
          h('button', { type: 'button', class: 'btn', onclick: function () { m.close(); } }, 'Done')));
      });
    } },
      LF.formError(), typeField,
      LF.field({ id: 'r-name', name: 'name', label: 'Item name', control: name, required: true }),
      LF.field({ id: 'r-category', name: 'category', label: 'Category', control: category, required: true }),
      h('div', { class: 'row2' },
        LF.field({ id: 'r-date', name: 'date', control: date, required: true, label: null }),
        LF.field({ id: 'r-place', name: 'place', control: place, required: true, label: null })),
      behalfField,
      h('div', { class: 'field', 'data-field': 'description' }, h('label', { for: 'r-description' }, 'Description', h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), desc, descHint, h('div', { class: 'field-error', id: 'r-description-err', role: 'alert' })),
      photo.el, h('div', { class: 'form-actions' }, submit));
    // the two small fields need visible labels that change with lost / found
    form.querySelector('[data-field="date"]').prepend(h('label', { for: 'r-date' }, dateLabel, h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')));
    form.querySelector('[data-field="place"]').prepend(h('label', { for: 'r-place' }, placeLabel, h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')));
    desc.setAttribute('aria-describedby', 'r-description-hint r-description-err');

    m.body.append(h('div', { class: 'split' }, form, visual));
    m.focusFirst();
  };

  /* ---------- Item information (wireframe: Item Information overlay) ---------- */
  /** item: an item from the API. o: { user, onChanged() } */
  LF.overlays.item = function (item, o) {
    var m = LF.overlay({ title: 'Item information', className: 'dlg-item' });
    var visual = h('div', { class: 'visual' }, item.photo ? h('img', { src: item.photo, alt: item.name }) : h('span', { class: 'ph' }, LF.categoryIcon(item.category, 40)));
    var info = h('div', { class: 'info' });
    m.body.append(h('div', { class: 'split' }, visual, info));

    var sub = [item.type === 'lost' ? 'Lost' : 'Found', item.place, LF.fmtDate(item.date)].filter(Boolean).join(' · ');

    function action() {
      if (item.myClaim) return h('div', { class: 'callout' }, LF.icon('check', 18), h('div', null, item.myClaim.status === 'approved' ? 'Your claim is approved and is awaiting release. Reference ' : 'Your claim was submitted and is awaiting staff review. Reference ', h('span', { class: 'mono' }, item.myClaim.ref), '.'));
      if (item.canClaim) return h('button', { type: 'button', class: 'btn', onclick: showClaim }, 'Claim');
      if (item.type === 'lost' && item.status === 'open') return h('div', { class: 'callout' }, LF.icon('info', 18), h('div', null, 'Staff must verify this lost report before students can submit ownership claims.'));
      if (item.type === 'lost' && item.status === 'released') return h('div', { class: 'callout' }, LF.icon('check', 18), h('div', null, 'This report has been marked as claimed and released to its owner.'));
      if (item.type === 'lost' && item.status === 'pending') return h('div', { class: 'callout' }, LF.icon('info', 18), h('div', null, 'This report has been verified. If this is your item, press Claim and provide evidence of ownership.'));
      if (item.type === 'lost') return null;
      if (item.status === 'released') return h('div', { class: 'callout' }, LF.icon('info', 18), h('div', null, 'This item was returned to its owner.'));
      if (item.status === 'awaiting') return h('div', { class: 'callout yellow' }, LF.icon('info', 18), h('div', null, 'Waiting for the item to be handed in to the office.'));
      if (o.user.role === 'staff') return h('div', { class: 'callout' }, LF.icon('info', 18), h('div', null, 'Students submit claims here. Personnel review them.'));
      return null;
    }
    function showInfo() {
      info.replaceChildren(LF.statusChip(item.status), h('h3', { class: 'heading' }, item.name), h('p', { class: 'subheading' }, sub),
        item.description ? h('p', { class: 'desc' }, item.description) : null,
        h('p', { class: 'muted mono', style: { fontSize: '0.8rem' } }, item.ref + (item.createdAt ? ' · Reported ' + LF.fmtDateTime(item.createdAt) : '')),
        h('div', { class: 'cta' }, action()));
    }

    function showClaim() {
      var evidence = LF.textarea('c-evidence', { rows: 4, placeholder: item.type === 'lost' ? 'Describe the item and identifying details only the owner would know.' : 'Serial number, marks, lock screen, what is inside' });
      var lostWhen = item.type === 'lost' ? LF.input('c-lost-when', { placeholder: 'e.g. Monday after class' }) : null;
      var lostWhere = item.type === 'lost' ? LF.input('c-lost-where', { placeholder: 'e.g. Library, second floor' }) : null;
      var chk = h('input', { type: 'checkbox', id: 'c-confirm' });
      var photo = LF.photoField({ id: 'c-photo' });
      var submit = h('button', { type: 'submit', class: 'btn' }, 'Submit claim');
      var form = h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var errs = {};
        if (evidence.value.trim().length < 10) errs.evidence = 'Describe at least one detail only the owner would know (at least 10 characters).';
        if (item.type === 'lost' && lostWhen.value.trim().length < 2) errs.lostWhen = 'Tell us when you last had the item.';
        if (item.type === 'lost' && lostWhere.value.trim().length < 2) errs.lostWhere = 'Tell us where you lost the item.';
        if (item.type === 'lost' && !photo.getFile()) errs.photo = 'Attach a photo to help prove the item is yours.';
        if (!chk.checked) errs.confirm = 'Confirm that the item is yours.';
        if (Object.keys(errs).length) return LF.showErrors(form, { ok: false, error: 'Please fix the highlighted fields.', errors: errs });
        LF.showErrors(form, { ok: true });
        LF.busy(submit, true);
        LF.api.createClaim(item.id, { evidence: evidence.value.trim(), lostWhen: lostWhen ? lostWhen.value.trim() : '', lostWhere: lostWhere ? lostWhere.value.trim() : '', confirm: 'true' }, photo.getFile(), item.type).then(function (r) {
          LF.busy(submit, false, 'Submit claim');
          if (!r.ok) return LF.showErrors(form, r);
          showDone(r.data.claim);
          o.onChanged();
        });
      } },
        LF.formError(),
        LF.field({ id: 'c-evidence', name: 'evidence', label: item.type === 'lost' ? 'Describe the item and proof it is yours' : 'What only the owner would know', control: evidence, required: true,
          hint: item.type === 'lost' ? 'Staff will review this description along with when/where you lost it and your photo.' : 'Staff compare this with what they recorded when the item arrived. Do not guess.' }),
        item.type === 'lost' ? LF.field({ id: 'c-lost-when', name: 'lostWhen', label: 'When did you last have or lose it?', control: lostWhen, required: true }) : null,
        item.type === 'lost' ? LF.field({ id: 'c-lost-where', name: 'lostWhere', label: 'Where did you lose it?', control: lostWhere, required: true }) : null,
        h('label', { for: 'c-photo' }, item.type === 'lost' ? 'Photo proof (required)' : 'Photo proof (optional)'), photo.el,
        h('div', { class: 'field', 'data-field': 'confirm' }, h('label', { class: 'check', for: 'c-confirm' }, chk, h('span', null, 'I confirm this item belongs to me.')), h('div', { class: 'field-error', role: 'alert' })),
        h('div', { class: 'form-actions' }, submit, h('button', { type: 'button', class: 'btn secondary', onclick: showInfo }, 'Back')));
      info.replaceChildren(h('h3', { class: 'heading' }, 'Claim ' + item.name), form);
      evidence.focus();
    }

    function showDone(claim) {
      info.replaceChildren(h('div', { class: 'done', role: 'status' }, h('div', { class: 'tick' }, LF.icon('check', 24)), h('h3', { class: 'heading' }, 'Claim submitted'),
        h('p', null, 'Your reference number is'), h('div', { class: 'ref' }, claim.ref),
        h('p', { class: 'muted' }, 'Staff will review your claim. If it is approved, bring your school ID to the Lost & Found office to collect the item. You can follow it under My reports.'),
        h('button', { type: 'button', class: 'btn', onclick: function () { m.close(); } }, 'Done')));
    }

    showInfo();
    m.focusFirst();
  };

  /* ---------- Create a student account ---------- */
  /** o: { onSignedIn(user) } */
  LF.overlays.register = function (o) {
    var m = LF.overlay({ title: 'Create a student account', className: 'narrow' });
    var dom = cfg.schoolEmailDomain;
    var fn = LF.input('g-name', { autocomplete: 'name' });
    var em = LF.input('g-email', { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'name@' + (dom || 'school.edu') });
    var sid = LF.input('g-sid', { placeholder: 'Your student ID number' });
    var pw = LF.passwordInput('g-pw', 'new-password'), pw2 = LF.passwordInput('g-pw2', 'new-password');
    var submit = h('button', { type: 'submit', class: 'btn' }, 'Create account');
    var form = h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var errs = {}, email = em.value.trim().toLowerCase();
      if (fn.value.trim().length < 3) errs.fullName = 'Enter your full name.';
      if (!EMAIL.test(email)) errs.email = 'Enter your school email address.';
      else if (dom && email.slice(-(dom.length + 1)) !== '@' + dom.toLowerCase()) errs.email = 'Use your school-issued email (ending in @' + dom + ').';
      if (sid.value.trim().length < 4) errs.studentId = 'Enter your student ID number.';
      if (pw.input.value.length < 8) errs.password = 'Use at least 8 characters.';
      if (pw2.input.value !== pw.input.value) errs.confirm = 'The passwords do not match.';
      if (Object.keys(errs).length) return LF.showErrors(form, { ok: false, error: 'Please fix the highlighted fields.', errors: errs });
      LF.showErrors(form, { ok: true }); LF.busy(submit, true);
      LF.api.register({ fullName: fn.value.trim(), email: email, studentId: sid.value.trim(), password: pw.input.value }).then(function (r) {
        LF.busy(submit, false, 'Create account');
        if (!r.ok) return LF.showErrors(form, r);
        // Registration uses email confirmation and returns a message, not a
        // signed-in user/session. Do not dereference r.data.user or attempt to
        // sign the new account in until the person confirms their email.
        if (!r.data || !r.data.user) {
          m.close();
          LF.toast((r.data && r.data.message) || 'Registration submitted. Check your school email for a confirmation link.');
          return;
        }
        m.close(); LF.toast('Account created. Welcome, ' + r.data.user.fullName + '.'); o.onSignedIn(r.data.user);
      });
    } }, LF.formError(),
      LF.field({ id: 'g-name', name: 'fullName', label: 'Full name', control: fn, required: true }),
      LF.field({ id: 'g-email', name: 'email', label: 'School email', control: em, required: true }),
      LF.field({ id: 'g-sid', name: 'studentId', label: 'Student ID', control: sid, required: true }),
      LF.field({ id: 'g-pw', name: 'password', label: 'Password', control: pw.el, required: true, hint: 'At least 8 characters.' }),
      LF.field({ id: 'g-pw2', name: 'confirm', label: 'Confirm password', control: pw2.el, required: true }),
      h('div', { class: 'form-actions' }, submit));
    m.body.append(form); fn.focus();
  };

  /* ---------- Forgot password ---------- */
  LF.overlays.forgot = function () {
    var m = LF.overlay({ title: 'Reset your password', className: 'narrow' });
    var email = LF.input('f-email', { type: 'email', autocomplete: 'email', placeholder: 'name@example.com', inputmode: 'email' });
    var submit = h('button', { type: 'submit', class: 'btn' }, 'Send reset link');
    var form = h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      if (!EMAIL.test(email.value.trim())) return LF.showErrors(form, { ok: false, error: '', errors: { email: 'Enter your email address, for example name@school.edu.' } });
      LF.showErrors(form, { ok: true });
      LF.busy(submit, true);
      LF.api.forgot({ email: email.value.trim() }).then(function (r) {
        LF.busy(submit, false, 'Send reset link');
        if (!r.ok) return LF.showErrors(form, r);
        m.body.replaceChildren(h('div', { class: 'done', role: 'status' }, h('div', { class: 'tick' }, LF.icon('check', 24)),
          h('p', null, 'If an account exists for ', h('strong', null, email.value.trim()), ', we sent a link to reset the password. Check your inbox and spam folder.'),
          h('button', { type: 'button', class: 'btn', onclick: function () { m.close(); } }, 'Back to sign in')));
      });
    } }, LF.formError(), h('p', { class: 'muted' }, 'Enter the email you sign in with. We will send you a link to choose a new password.'),
      LF.field({ id: 'f-email', name: 'email', label: 'Email', control: email, required: true }), h('div', { class: 'form-actions' }, submit));
    m.body.append(form);
    email.focus();
  };

  /* ---------- How it works (from the Midterm process and business rules) ---------- */
  LF.overlays.how = function () {
    var m = LF.overlay({ title: 'How it works', className: 'narrow' });
    m.body.append(h('div', { class: 'stack', style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
      h('ol', { class: 'steps' },
        h('li', null, h('div', null, h('strong', null, 'Report it'), h('span', { class: 'muted' }, 'Lost something or found something? Press Report and describe it. Add a photo if you have one.'))),
        h('li', null, h('div', null, h('strong', null, 'Claim it'), h('span', { class: 'muted' }, 'Once staff verifies a lost report, press Claim on it and provide the description, when/where you lost it, and photo proof. Staff review claims privately before release.'))),
        h('li', null, h('div', null, h('strong', null, 'Collect it'), h('span', { class: 'muted' }, 'Staff compare every claim with their records. When yours is approved, bring your school ID to the office.')))),
      h('div', { class: 'callout yellow' }, LF.icon('info', 18), h('div', null, 'Items are kept for 30 days. High-value items such as phones, laptops and wallets are kept for 90 days.'))));
    m.focusFirst();
  };
})();
