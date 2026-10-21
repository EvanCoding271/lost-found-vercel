/* staff.js — personnel tools, opened from a found item on the home page. Students never get this screen.
   1. Record intake (item received, private identifying details)
   2. Compare every claim and its evidence side by side
   3. Record Approved / Rejected for each claim, with a rationale
   4. Release the item — locked until at least one claim is Approved
   The server must enforce all of this too (see js/api.js). Hiding buttons is not security. */
(function () {
  'use strict';
  var LF = window.LF, h = LF.h;
  var CHIP = { pending: ['Not decided', 'yellow'], approved: ['Approved', 'blue'], rejected: ['Rejected', ''] };

  function kv(label, value, mono) { return h('div', { class: 'kv' }, h('span', null, label), h('span', { class: mono ? 'mono' : '' }, value || 'Not given')); }

  LF.overlays.staffLostItem = function (item, o) { return LF.overlays.staffItem(item, o); };

  LF.overlays.staffItem = function (item, o) {
    var changed = false;
    var m = LF.overlay({ title: 'Item information (personnel)', className: 'dlg-staff', onClose: function () { if (changed && o.onChanged) o.onChanged(); } });
    var body = h('div', { class: 'staff-body' });
    m.body.append(body);

    function head(it) {
      var sub = [it.type === 'lost' ? 'Lost' : 'Found', it.place, LF.fmtDate(it.date)].filter(Boolean).join(' · ');
      return h('div', { class: 'staff-head' },
        h('div', { class: 'staff-photo' }, it.photo ? h('img', { src: it.photo, alt: it.name }) : h('span', { class: 'ph' }, LF.categoryIcon(it.category, 32))),
        h('div', { class: 'info' }, LF.statusChip(it.status), h('h3', { class: 'heading' }, it.name), h('p', { class: 'subheading' }, sub),
          it.description ? h('p', { class: 'desc' }, it.description) : null,
          h('p', { class: 'muted mono', style: { fontSize: '0.8rem' } }, it.ref + ' · Reported ' + LF.fmtDateTime(it.createdAt))));
    }

    function load() {
      body.replaceChildren(head(item), h('p', { class: 'muted', role: 'status' }, 'Loading…'));
      LF.api.staffItem(item.id, item.type).then(function (r) {
        if (!r.ok) return body.replaceChildren(head(item), h('div', { class: 'form-error', role: 'alert' }, r.error));
        draw(r.data);
      });
    }

    function draw(d) {
      item = d.item;
      var out = [head(item)];
      if (item.type === 'lost' && item.status === 'open') out.push(verifyLostSection());
      if (item.type === 'found' && item.status === 'awaiting') out.push(intake());
      else if (item.type === 'found' || item.status !== 'open') {
        if (d.record) out.push(h('div', { class: 'staff-panel' }, h('h3', null, 'Recorded at intake (staff only)'),
          kv('Stored at', d.record.storage), kv('Identifying details', d.record.details), kv('Received', d.record.receivedBy + ', ' + LF.fmtDateTime(d.record.receivedAt))));
        out.push(claimsSection(d.claims));
      }
      body.replaceChildren.apply(body, out);
    }

    function verifyLostSection() {
      var btn = h('button', { type: 'button', class: 'btn yellow', onclick: function () {
        LF.busy(btn, true);
        LF.api.verifyLostItem(item.id).then(function (r) {
          LF.busy(btn, false, 'Verify report and allow ownership claims');
          if (!r.ok) return LF.toast(r.error);
          changed = true; LF.toast('Report verified. Students can now submit ownership claims.'); load();
        });
      } }, 'Verify report and allow ownership claims');
      return h('div', { class: 'staff-section' }, h('h3', null, 'Verify lost report'), h('p', { class: 'muted' }, 'After verification, students can submit an ownership claim with a description and photo proof. Their requests will appear below for review.'), btn);
    }

    /* ----- 1. intake ----- */
    function intake() {
      var storage = LF.input('i-storage', { placeholder: 'Shelf B, locker 4' });
      var details = LF.textarea('i-details', { rows: 3, placeholder: 'Serial number, marks, contents. Never shown to students.' });
      var submit = h('button', { type: 'submit', class: 'btn' }, 'Record as received');
      var f = h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var errs = {};
        if (storage.value.trim().length < 2) errs.storage = 'Say where the item is kept.';
        if (details.value.trim().length < 5) errs.details = 'Record at least one identifying detail.';
        if (Object.keys(errs).length) return LF.showErrors(f, { ok: false, error: 'Please fix the highlighted fields.', errors: errs });
        LF.showErrors(f, { ok: true }); LF.busy(submit, true);
        LF.api.receiveItem(item.id, { storage: storage.value.trim(), details: details.value.trim() }).then(function (r) {
          LF.busy(submit, false, 'Record as received');
          if (!r.ok) return LF.showErrors(f, r);
          changed = true; LF.toast('Item recorded. Students can now claim it.'); load();
        });
      } }, LF.formError(),
        LF.field({ id: 'i-storage', name: 'storage', label: 'Storage location', control: storage, required: true }),
        LF.field({ id: 'i-details', name: 'details', label: 'Private identifying details', control: details, required: true, hint: 'Claims are checked against this. Do not paste it anywhere public.' }),
        h('div', { class: 'form-actions' }, submit));
      return h('div', { class: 'staff-section' }, h('h3', null, 'Record intake'), h('p', { class: 'muted' }, 'This item was reported as found but is not recorded yet. Receive it, then record it so students can claim it.'), f);
    }

    /* ----- 2 + 3. compare and verify ----- */
    function claimCol(c) {
      var chip = CHIP[c.status] || [c.status, ''];
      var col = h('article', { class: 'claim-col ' + c.status },
        h('div', { class: 'claim-top' }, h('strong', null, c.claimant.fullName), h('span', { class: 'chip ' + chip[1] }, chip[0])),
        kv('Student ID', c.claimant.studentId), kv('Email', c.claimant.email), kv('Submitted', LF.fmtDateTime(c.createdAt)), kv('Reference', c.ref, true),
        h('div', { class: 'kv' }, h('span', null, 'Evidence'), h('p', { class: 'evidence' }, c.evidence)),
        c.photo ? h('img', { class: 'claim-photo', src: c.photo, alt: 'Evidence photo from ' + c.claimant.fullName }) : null);
      if (c.status === 'pending') col.append(verifyForm(c));
      else col.append(h('div', { class: 'kv' }, h('span', null, 'Rationale'), h('p', { class: 'evidence' }, c.rationale)), kv('Decided', (c.decidedBy || '') + ', ' + LF.fmtDateTime(c.decidedAt)));
      return col;
    }

    function verifyForm(c) {
      var outcome = null, rid = 'v-' + c.ref;
      var rationale = LF.textarea(rid, { rows: 3, placeholder: 'Why is this claim approved or rejected?' });
      function radio(v, label) { return h('label', null, h('input', { type: 'radio', name: 'o-' + c.ref, value: v, onchange: function () { outcome = v; } }), h('span', null, label)); }
      var submit = h('button', { type: 'submit', class: 'btn' }, 'Record outcome');
      var f = h('form', { novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var errs = {};
        if (!outcome) errs.outcome = 'Choose Approve or Reject.';
        if (rationale.value.trim().length < 10) errs.rationale = 'Write a rationale (at least 10 characters).';
        if (Object.keys(errs).length) return LF.showErrors(f, { ok: false, error: '', errors: errs });
        LF.showErrors(f, { ok: true }); LF.busy(submit, true);
        LF.api.verifyClaim(c.ref, { outcome: outcome, rationale: rationale.value.trim() }).then(function (r) {
          LF.busy(submit, false, 'Record outcome');
          if (!r.ok) return LF.showErrors(f, r);
          changed = true; LF.toast('Outcome recorded for ' + c.ref + '.'); load();
        });
      } }, LF.formError(),
        h('div', { class: 'field', 'data-field': 'outcome' }, h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Outcome for ' + c.ref }, radio('approved', 'Approve'), radio('rejected', 'Reject')), h('div', { class: 'field-error', role: 'alert' })),
        LF.field({ id: rid, name: 'rationale', label: 'Rationale', control: rationale, required: true }), submit);
      return f;
    }

    /* ----- 4. release ----- */
    function claimsSection(claims) {
      var approved = claims.filter(function (c) { return c.status === 'approved'; });
      var parts = [h('h3', null, 'Claims (' + claims.length + ')')];
      parts.push(claims.length ? h('div', { class: 'compare' }, claims.map(claimCol)) : h('p', { class: 'muted' }, 'No claims yet. Students can submit an ownership claim after this report is verified.'));
      if (item.status === 'released') parts.push(h('div', { class: 'callout' }, LF.icon('check', 18), h('div', null, 'Released to ' + (approved[0] ? approved[0].claimant.fullName : 'its owner') + '.')));
      else {
        var btn = h('button', { type: 'button', class: 'btn yellow', disabled: !approved.length, onclick: function () {
          LF.busy(btn, true);
          LF.api.releaseItem(item.id, { claimRef: approved[0].ref, itemType: item.type }).then(function (r) {
            LF.busy(btn, false, 'Release to owner');
            if (!r.ok) return LF.toast(r.error);
            changed = true; LF.toast('Item released to ' + approved[0].claimant.fullName + '.'); load();
          });
        } }, 'Release to owner');
        parts.push(h('div', { class: 'release-bar' }, btn, h('span', { class: 'muted', role: 'status' }, approved.length
          ? 'Check the school ID of ' + approved[0].claimant.fullName + ' before you hand the item over.'
          : 'Release is locked until at least one claim is approved.')));
      }
      return h('div', { class: 'staff-section' }, parts);
    }

    load();
    m.focusFirst();
  };
})();
