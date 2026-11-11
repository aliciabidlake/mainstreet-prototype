/* Mainstreet prototype — behaviour. No dependencies. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* =====================================================================
   Routing  (#/consignment, #/dispatch, #/not-built?what=…)
   ===================================================================== */
const screens = { consignment: '#screen-consignment', dispatch: '#screen-dispatch', 'not-built': '#screen-notbuilt' };
let lastRealScreen = 'dispatch';

function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dispatch';
  const [name, query] = raw.split('?');
  const key = screens[name] ? name : 'dispatch';
  Object.entries(screens).forEach(([k, sel]) => { $(sel).hidden = k !== key; });
  closeMenu();
  if (key === 'not-built') {
    const p = new URLSearchParams(query || '');
    $('#nb-what').textContent = p.get('what') || 'This screen';
    document.title = 'Not built · Mainstreet Prototype';
  } else {
    lastRealScreen = key;
    document.title = (key === 'consignment' ? 'Consignment Edit' : 'Transport Dispatch') + ' · Mainstreet Prototype';
  }
  $$('.nav-btn').forEach(b => b.classList.toggle('current', false));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

function notBuilt(what) {
  location.hash = '#/not-built?what=' + encodeURIComponent(what);
}
function go(screen) { location.hash = '#/' + screen; }

$('#nb-back').addEventListener('click', () => {
  // Go back to wherever we came from; fall back to the last real screen.
  if (history.length > 1) history.back();
  else go(lastRealScreen);
});

/* =====================================================================
   Snackbar (ONE DS Snackbar: one at a time, auto-dismiss, optional UNDO)
   ===================================================================== */
let snackTimer;
function snack(msg, { action, onAction, duration = 4500 } = {}) {
  const el = $('#snackbar'), btn = $('#snackbar-action');
  $('#snackbar-msg').textContent = msg;
  btn.hidden = !action;
  btn.textContent = action || '';
  btn.onclick = () => { hideSnack(); onAction && onAction(); };
  el.classList.add('show');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(hideSnack, action ? 7000 : duration);
}
function hideSnack() { $('#snackbar').classList.remove('show'); }
$('#snackbar-close').addEventListener('click', hideSnack);

/* =====================================================================
   Dialog (ONE DS Dialog: xs 444, radius 16, Ghost left / Primary right)
   ===================================================================== */
// ONE DS Content Guidelines: headings use Title Case; a/an/the, and/but/or/nor, of/in/on/at/to/for/with/by stay lowercase
// (unless first). Words that already contain capitals (codes, acronyms) are left alone; after a hyphen stays lowercase.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);
function titleCase(str) {
  return str.split(' ').map((w, i) => {
    if (/[A-Z]/.test(w.slice(1)) || /^[^a-z]*$/.test(w)) return w;
    if (i > 0 && SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
function dialog({ title, body, confirm, destructive, cancel = 'Cancel', onConfirm, size = '', extra = '' }) {
  const bd = document.createElement('div');
  bd.className = 'backdrop';
  bd.innerHTML = `
    <div class="dialog ${size}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 class="dialog-title" id="dlg-t">${esc(titleCase(title))}<button class="icon-btn sm" data-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></h2>
      <div class="dialog-body">${body}</div>
      ${cancel || confirm || extra ? `<div class="dialog-actions">
        ${cancel ? `<button class="btn btn-text" data-x>${esc(cancel)}</button>` : ''}
        <span class="spacer" style="flex:1"></span>${extra}
        ${confirm ? `<button class="btn btn-contained ${destructive ? 'btn-destructive' : ''}" data-ok>${esc(confirm)}</button>` : ''}
      </div>` : ''}
    </div>`;
  const prevFocus = document.activeElement;
  const close = () => { bd.remove(); document.removeEventListener('keydown', onKey); prevFocus && prevFocus.focus(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  bd.addEventListener('click', e => {
    if (e.target === bd || e.target.closest('[data-x]')) close();
    if (e.target.closest('[data-ok]')) { const keep = onConfirm && onConfirm(bd) === false; if (!keep) close(); }
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bd);
  ($('.dialog-body .ctl', bd) || $('[data-ok]', bd) || $('[data-x]', bd)).focus();
  bd.close = close;
  return bd;
}

/* =====================================================================
   Tooltip (ONE DS Tooltip: hover + focus, radius 12)
   ===================================================================== */
const tip = $('#tooltip');
let tipTarget = null;
function showTip(el) {
  const text = el.getAttribute('data-tip');
  if (!text) return;
  tipTarget = el;
  tip.textContent = text;
  tip.classList.add('show');
  const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
  let top = r.bottom + 8, left = r.left + r.width / 2 - t.width / 2;
  if (top + t.height > innerHeight - 8) top = r.top - t.height - 8;
  left = Math.max(8, Math.min(left, innerWidth - t.width - 8));
  tip.style.top = top + 'px'; tip.style.left = left + 'px';
}
function hideTip() { tip.classList.remove('show'); tipTarget = null; }
document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el && el !== tipTarget) showTip(el); else if (!el && tipTarget) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
document.addEventListener('focusout', hideTip);
document.addEventListener('scroll', hideTip, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });

/* =====================================================================
   Menus (nav dropdowns, split buttons, overflow, refresh interval…)
   ===================================================================== */
const NB = what => ({ notbuilt: what });
const MENUS = {
  'nav-new': [{ label: 'Consignment', ...NB('New consignment') }, { label: 'Quote', ...NB('New quote') }, { label: 'Booking', ...NB('New booking') }, { label: 'Pickup request', ...NB('New pickup request') }],
  'nav-enquiry': [{ label: 'Consignment enquiry', ...NB('Consignment enquiry') }, { label: 'Track & trace', ...NB('Track & trace') }, { label: 'Customer enquiry', ...NB('Customer enquiry') }],
  'nav-todo': [{ label: 'My tasks', ...NB('My tasks') }, { label: 'Exceptions', ...NB('Exceptions queue') }, { label: 'Approvals', ...NB('Approvals') }],
  'nav-update': [
    { header: 'In this prototype' },
    { label: 'Consignment edit', nav: 'consignment', icon: 'edit_note' },
    { label: 'Transport dispatch', nav: 'dispatch', icon: 'local_shipping' },
    { divider: true },
    { label: 'Manifest update', ...NB('Manifest update') }, { label: 'POD entry', ...NB('POD entry') }, { label: 'Outturn', ...NB('Outturn') }],
  'nav-reports': [{ label: 'Daily dispatch report', ...NB('Daily dispatch report') }, { label: 'Revenue report', ...NB('Revenue report') }, { label: 'KPI dashboard', ...NB('KPI dashboard') }],
  'nav-pulse': [{ label: 'Pulse overview', ...NB('Pulse overview') }, { label: 'Fleet tracking', ...NB('Fleet tracking') }],
  'nav-maintain': [{ label: 'Customers', ...NB('Maintain customers') }, { label: 'Addresses', ...NB('Maintain addresses') }, { label: 'Drivers', ...NB('Maintain drivers') }, { label: 'Zones', ...NB('Maintain zones') }],
  'nav-account': [{ label: 'Account customers', ...NB('Account customers') }, { label: 'Credit holds', ...NB('Credit holds') }],
  'nav-claims': [{ label: 'New claim', ...NB('New claim') }, { label: 'Claims register', ...NB('Claims register') }],
  'profile': [{ label: 'Alicia Bidlake', sub: 'Dunedin branch', disabled: true }, { divider: true }, { label: 'My settings', ...NB('My settings') }, { label: 'Sign out', ...NB('Sign out') }],
  'split-label': [{ label: 'Print labels', ...NB('Label – print labels') }, { label: 'Reprint label', ...NB('Label – reprint label') }, { label: 'Label preview', ...NB('Label – preview') }],
  'split-print': [{ label: 'Consignment note', ...NB('Print – consignment note') }, { label: 'Delivery docket', ...NB('Print – delivery docket') }, { label: 'Manifest', ...NB('Print – manifest') }, { label: 'POD copy', ...NB('Print – POD copy') }],
  'split-copy': [{ label: 'Copy consignment', ...NB('Copy – copy consignment') }, { label: 'Copy as return', ...NB('Copy – copy as return') }, { label: 'Save as template', ...NB('Copy – save as template') }],
  'ce-more': [{ label: 'Save & close', action: () => saveConsignment(true) }, { label: 'View audit trail', ...NB('Audit trail') }, { label: 'Send tracking link', ...NB('Send tracking link') }],
};
// split-button main actions use their first option as the default
const SPLIT_DEFAULT = { label: 'Label – print labels', print: 'Print – consignment note', copy: 'Copy – copy consignment' };

let openMenuEl = null, openMenuAnchor = null;
function closeMenu() {
  if (!openMenuEl) return;
  openMenuEl.remove();
  if (openMenuAnchor) openMenuAnchor.setAttribute('aria-expanded', 'false');
  openMenuEl = openMenuAnchor = null;
}
function openMenu(anchor, items, { className = '', keepOpen = false, minWidth } = {}) {
  closeMenu();
  const ul = document.createElement('div');
  ul.className = 'menu ' + className;
  ul.setAttribute('role', 'menu');
  items.forEach((it, i) => {
    if (it.divider) { ul.insertAdjacentHTML('beforeend', '<div class="menu-divider" role="separator"></div>'); return; }
    if (it.header) { ul.insertAdjacentHTML('beforeend', `<div class="menu-header">${esc(it.header)}</div>`); return; }
    const b = document.createElement('button');
    b.className = 'menu-item';
    b.setAttribute('role', it.checkbox ? 'menuitemcheckbox' : 'menuitem');
    if (it.selected) b.setAttribute('aria-selected', 'true');
    if (it.disabled) { b.disabled = true; b.style.cursor = 'default'; }
    b.innerHTML = (it.checkbox ? `<label class="check" style="pointer-events:none;margin:-8px 0 -8px -10px"><input type="checkbox" ${it.checked ? 'checked' : ''} tabindex="-1"><span class="box"></span></label>` : '')
      + (it.icon ? `<span class="i mi">${it.icon}</span>` : '')
      + `<span>${esc(it.label)}${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}</span>`;
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (it.disabled) return;
      if (it.checkbox) { it.checked = !it.checked; $('input', b).checked = it.checked; it.onToggle && it.onToggle(it.checked); return; }
      closeMenu();
      if (it.nav) go(it.nav);
      else if (it.notbuilt) notBuilt(it.notbuilt);
      else if (it.action) it.action();
    });
    ul.appendChild(b);
  });
  document.body.appendChild(ul);
  const r = anchor.getBoundingClientRect();
  ul.style.minWidth = (minWidth || Math.max(200, r.width)) + 'px';
  const m = ul.getBoundingClientRect();
  let left = r.left; if (left + m.width > innerWidth - 8) left = r.right - m.width;
  let top = r.bottom + 4; if (top + m.height > innerHeight - 8) top = Math.max(8, r.top - m.height - 4);
  ul.style.left = Math.max(8, left) + 'px'; ul.style.top = top + 'px';
  anchor.setAttribute('aria-expanded', 'true');
  openMenuEl = ul; openMenuAnchor = anchor;
  const first = $('.menu-item:not(:disabled)', ul); first && first.focus();
  ul.addEventListener('keydown', e => {
    const list = $$('.menu-item:not(:disabled)', ul), idx = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(idx + 1) % list.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); list[(idx - 1 + list.length) % list.length].focus(); }
    if (e.key === 'Escape' || e.key === 'Tab') { const a = anchor; closeMenu(); a.focus(); }
  });
  if (keepOpen) ul.dataset.keepOpen = '1';
}
document.addEventListener('click', e => {
  if (openMenuEl && !openMenuEl.contains(e.target) && !(openMenuAnchor && openMenuAnchor.contains(e.target))) closeMenu();
});
window.addEventListener('resize', closeMenu);

/* Generic click delegation: data-menu, data-notbuilt, data-split-main */
document.addEventListener('click', e => {
  const menuBtn = e.target.closest('[data-menu]');
  if (menuBtn) {
    const key = menuBtn.getAttribute('data-menu');
    if (openMenuAnchor === menuBtn) { closeMenu(); return; }
    if (key === 'refresh-interval') return openMenu(menuBtn, refreshMenuItems(), { minWidth: 140 });
    if (key === 'hide-menu') return openMenu(menuBtn, hideMenuItems(), { keepOpen: true });
    const isAction = key.startsWith('split-') || key === 'ce-more';
    openMenu(menuBtn, (typeof MENUS[key] === 'function' ? MENUS[key]() : MENUS[key]) || [], { className: isAction ? 'action' : '' });
    return;
  }
  const nb = e.target.closest('[data-notbuilt]');
  if (nb) { e.preventDefault(); notBuilt(nb.getAttribute('data-notbuilt')); return; }
  const sm = e.target.closest('[data-split-main]');
  if (sm) { notBuilt(SPLIT_DEFAULT[sm.getAttribute('data-split-main')]); }
});

$('#global-search').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#global-search-input').value.trim();
  notBuilt(q ? `Global search results for “${q}”` : 'Global search');
});

/* =====================================================================
   Fields: floating labels, required validation (on blur), override toggles
   ===================================================================== */
function syncFilled(field) {
  const ctl = $('.ctl', field);
  if (!ctl) return;
  const v = ctl.tagName === 'BUTTON' ? ctl.textContent.trim() : ctl.value;
  field.classList.toggle('filled', !!v);
  if (ctl.type === 'datetime-local') ctl.classList.toggle('has-value', !!v);
}
document.addEventListener('input', e => { const f = e.target.closest('.field'); if (f) { syncFilled(f); if (f.classList.contains('error')) validateField(f); } markDirty(e); });
document.addEventListener('change', e => { const f = e.target.closest('.field'); if (f) syncFilled(f); markDirty(e); });
$$('.field').forEach(syncFilled);

function validateField(field) {
  if (!field.classList.contains('required') || field.classList.contains('disabled')) return true;
  const ctl = $('.ctl', field);
  const ok = !!ctl.value.trim();
  field.classList.toggle('error', !ok);
  let h = $('.helper', field);
  if (!ok && !h) { h = document.createElement('div'); h.className = 'helper'; h.id = ctl.id + '-help'; field.appendChild(h); ctl.setAttribute('aria-describedby', h.id); }
  if (h) h.textContent = ok ? '' : 'This field is required';
  if (ok && h) { h.remove(); ctl.removeAttribute('aria-describedby'); }
  ctl.setAttribute('aria-invalid', String(!ok));
  return ok;
}
document.addEventListener('focusout', e => { const f = e.target.closest && e.target.closest('.field.required'); if (f) validateField(f); });

// Override checkbox unlocks the address fields for that card
$$('.addr-card').forEach(card => {
  $('.override', card).addEventListener('change', e => {
    const on = e.target.checked;
    $$('.o-lock', card).forEach(f => {
      f.classList.toggle('disabled', !on);
      $$('input, select', f).forEach(c => { c.disabled = !on; });
    });
    if (on) $('.o-lock .ctl', card).focus();
  });
});

/* =====================================================================
   Lookups (Autocomplete): filter-as-you-type, keyboard, clear
   ===================================================================== */
const LOOKUPS = {
  customers: [
    { label: 'MCRMIMME', sub: 'Oceana Gold - Mobile Maintance Equipment (MFT)', name: 'Oceana Gold - Mobile Maintance Equipment (MFT)', addr: 'Open Pit Workshop, Macraes Flat, South Island, New Zealand' },
    { label: 'FONTDUN', sub: 'Fonterra Co-operative - Mosgiel Plant', name: 'Fonterra Co-operative - Mosgiel Plant', addr: '1 Factory Road, Mosgiel, Dunedin 9024, New Zealand' },
    { label: 'PACHELM', sub: 'Pacific Helmets Limited', name: 'Pacific Helmets Limited', addr: '315 Heads Road, Castlecliff, Whanganui 4501, New Zealand' },
    { label: 'SILVFERN', sub: 'Silver Fern Farms - Finegand', name: 'Silver Fern Farms - Finegand', addr: 'Finegand Road, Balclutha 9271, New Zealand' },
    { label: 'MITRE10D', sub: 'Mitre 10 Mega Dunedin', name: 'Mitre 10 Mega Dunedin', addr: '50 Andersons Bay Road, Dunedin 9016, New Zealand' },
    { label: 'CAROTRAN', sub: 'Carotrans International', name: 'Carotrans International', addr: '10 Alderman Place, Favona, Auckland 2024, New Zealand' },
    { label: 'HANCOCKF', sub: 'Hancock Forest Management', name: 'Hancock Forest Management', addr: '18 Hugo Johnston Drive, Penrose, Auckland 1061, New Zealand' },
  ],
  addresses: [
    { label: 'MAINDC - COURIER', sub: 'South Dunedin, Dunedin', address: 'C/- MAINFREIGHT TRANSPORT SOUTH DUNEDIN DUNEDIN NEW ZEALAND', address2: '', suburb: 'SOUTH DUNEDIN', city: 'DUNEDIN', phone: '034551009', site: 'DUN03', zone: '1' },
    { label: 'MCRIMME - OCEANA GOLD OPEN', sub: 'Macraes Flat', address: 'OPEN PIT WORKSHOP GOLDEN POINT ROAD MACRAES FLAT', address2: 'GOLDEN POINT ROAD', suburb: 'SOUTH DUNEDIN', city: 'MACRAES FLAT', phone: '034551009', site: 'MCF03', zone: '9' },
    { label: 'FONTDUN - FONTERRA MOSGIEL', sub: 'Mosgiel, Dunedin', address: '1 FACTORY ROAD', address2: '', suburb: 'MOSGIEL', city: 'DUNEDIN', phone: '034890200', site: 'DUN01', zone: '2' },
    { label: 'PACHELM - PACIFIC HELMETS', sub: 'Castlecliff, Whanganui', address: '315 HEADS ROAD', address2: '', suburb: 'CASTLECLIFF', city: 'WHANGANUI', phone: '063445566', site: 'AKL01', zone: '3' },
    { label: 'CAROTRAN - CAROTRANS AKL', sub: 'Favona, Auckland', address: '10 ALDERMAN PLACE', address2: '', suburb: 'FAVONA', city: 'AUCKLAND', phone: '092556700', site: 'AKL01', zone: '1' },
    { label: 'MITRE10D - MITRE 10 MEGA', sub: 'Andersons Bay, Dunedin', address: '50 ANDERSONS BAY ROAD', address2: '', suburb: 'SOUTH DUNEDIN', city: 'DUNEDIN', phone: '034661900', site: 'DUN03', zone: '1' },
  ],
  reps: ['Robert Snout', 'Aroha Thompson', 'Mere Tipene', 'Daniel Lee', 'Priya Singh', 'Grace Kim'].map(n => ({ label: n })),
};

$$('.field.auto').forEach(field => {
  const input = $('input.ctl', field);
  const data = LOOKUPS[field.dataset.lookup] || [];
  let active = -1, list = [];

  const render = () => {
    const q = input.value.trim().toLowerCase();
    list = data.filter(o => !q || o.label.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q)).slice(0, 8);
    active = list.length ? 0 : -1;
    closeMenu();
    const items = list.length ? list.map((o, i) => ({ label: o.label, sub: o.sub, action: () => pick(o) })) : [{ label: 'No matches', disabled: true }];
    openMenu(field, items, { minWidth: field.getBoundingClientRect().width });
    input.focus(); // keep typing in the field
    input.setAttribute('aria-expanded', 'true');
  };
  const pick = o => {
    input.value = o.label;
    syncFilled(field);
    validateField(field);
    input.setAttribute('aria-expanded', 'false');
    const kind = field.dataset.onPick;
    if (kind === 'customer') {
      $('#cust-name').textContent = o.name; $('#cust-addr').textContent = o.addr;
    }
    if (kind === 'address') {
      const card = field.closest('.addr-card');
      $$('[data-k]', card).forEach(c => {
        const k = c.dataset.k;
        if (o[k] === undefined) return;
        if (c.tagName === 'SELECT') { if (![...c.options].some(op => op.value === o[k])) c.add(new Option(o[k])); }
        c.value = o[k];
        syncFilled(c.closest('.field'));
      });
      snack(`${card.dataset.addr === 'pickup' ? 'Pickup' : 'Delivery'} address updated from ${o.label}`);
    }
    dirty = true;
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', () => { if (!input.disabled) render(); });
  input.addEventListener('click', () => { if (!openMenuEl && !input.disabled) render(); });
  input.addEventListener('keydown', e => {
    if (!openMenuEl) { if (e.key === 'ArrowDown') render(); return; }
    const btns = $$('.menu-item:not(:disabled)', openMenuEl);
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, btns.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[active]) { closeMenu(); pick(list[active]); } return; }
    else if (e.key === 'Escape') { closeMenu(); input.setAttribute('aria-expanded', 'false'); return; }
    else if (e.key === 'Tab') { closeMenu(); return; }
    btns.forEach((b, i) => b.classList.toggle('active', i === active));
    btns[active] && btns[active].scrollIntoView({ block: 'nearest' });
  });
  $('.clear-btn', field).addEventListener('click', () => { input.value = ''; syncFilled(field); input.focus(); });
});

/* =====================================================================
   CONSIGNMENT EDIT
   ===================================================================== */
let dirty = false;
function markDirty(e) { if (e && e.target.closest && e.target.closest('#screen-consignment')) dirty = true; }

// Tabs
function wireTabs(tablistSel, homeTab, homePanelSel, placeholderSel) {
  const tabs = $$('.tab', $(tablistSel));
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
    const home = t.dataset.tab === homeTab;
    $(homePanelSel).hidden = !home;
    const ph = $(placeholderSel);
    ph.hidden = home;
    if (!home) {
      ph.innerHTML = `<i class="i fa-solid fa-compass-drafting" aria-hidden="true"></i>
        <div style="font: var(--typography-h6); color: var(--text-primary)">${esc(t.dataset.tab)}</div>
        <div>This tab isn't built in the prototype.</div>
        <button class="btn btn-outlined sm" style="border-radius:9999px;margin-top:8px" data-back-tab>Back to ${esc($(`[data-tab="${homeTab}"]`, $(tablistSel)).textContent.trim())}</button>`;
      $('[data-back-tab]', ph).onclick = () => $(`[data-tab="${homeTab}"]`, $(tablistSel)).click();
    }
  }));
  // Arrow-key navigation (WAI-ARIA tabs)
  $(tablistSel).addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'ArrowRight') tabs[(i + 1) % tabs.length].focus();
    if (e.key === 'ArrowLeft') tabs[(i - 1 + tabs.length) % tabs.length].focus();
  });
}
wireTabs('#ce-tabs', 'edit', '#ce-edit-panel', '#ce-tab-placeholder');
wireTabs('#dp-tabs', 'unallocated', '#dp-unallocated', '#dp-tab-placeholder');

// Items grid ------------------------------------------------------------
const ITEM_TYPES = ['ITEM-Item', 'PLT-Pallet', 'CTN-Carton', 'ROLL-Roll', 'CRT-Crate'];
let items = [1, 2, 3].map(() => ({ pieces: 1, type: 'ITEM-Item', desc: '554311 TC', kg: 12, l: 12, w: 12, h: 12, vol: 12, charge: 123, stack: false, un: 123, dg: 'Text', sub: 123 }));
const fmt = n => (Math.round(n * 1000) / 1000).toLocaleString('en-NZ', { maximumFractionDigits: 3 });

function renderItems() {
  $('#items-body').innerHTML = items.map((it, i) => `
    <tr data-i="${i}">
      <td class="td-edit"><input class="cell-input num" data-f="pieces" value="${it.pieces}" inputmode="numeric" aria-label="Pieces, row ${i + 1}"></td>
      <td class="td-edit"><select class="cell-input cell-select" data-f="type" aria-label="Type, row ${i + 1}">${ITEM_TYPES.map(t => `<option ${t === it.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td class="td-edit"><input class="cell-input" data-f="desc" value="${esc(it.desc)}" aria-label="Description, row ${i + 1}"></td>
      ${['kg', 'l', 'w', 'h', 'vol'].map(f => `<td class="td-edit"><input class="cell-input num" data-f="${f}" value="${it[f]}" inputmode="decimal" aria-label="${{ kg: 'W-KG', l: 'Length-M', w: 'Width-M', h: 'Height-M', vol: 'VOL-M3' }[f]}, row ${i + 1}"></td>`).join('')}
      <td class="num" data-out="charge">${fmt(it.charge)}</td>
      <td class="center"><label class="check"><input type="checkbox" data-f="stack" ${it.stack ? 'checked' : ''} aria-label="Stackable, row ${i + 1}"><span class="box"></span></label></td>
      <td class="td-edit"><input class="cell-input num" data-f="un" value="${esc(it.un)}" aria-label="UN number, row ${i + 1}"></td>
      <td class="td-edit"><input class="cell-input" data-f="dg" value="${esc(it.dg)}" aria-label="DG class, row ${i + 1}"></td>
      <td class="td-edit"><input class="cell-input num" data-f="sub" value="${esc(it.sub)}" aria-label="Sub risk, row ${i + 1}"></td>
      <td class="col-actions"><button class="icon-btn sm" data-del-item="${i}" data-tip="Delete item" aria-label="Delete item ${i + 1}"><span class="i mi">delete</span></button></td>
    </tr>`).join('') || `<tr class="empty"><td colspan="14">No items. Use ADD to add one.</td></tr>`;
  renderTotals();
}
function renderTotals() {
  const sum = f => items.reduce((a, it) => a + (parseFloat(it[f]) || 0), 0);
  $('#items-totals').innerHTML = `
    <td class="num">${fmt(sum('pieces'))}</td><td></td><td></td>
    <td class="num">${fmt(sum('kg'))}</td><td></td><td></td><td></td>
    <td class="num">${fmt(sum('vol'))}</td><td class="num">${fmt(sum('charge'))}</td>
    <td></td><td></td><td></td><td></td><td></td>`;
}
$('#items-body').addEventListener('input', e => {
  const tr = e.target.closest('tr[data-i]'); if (!tr) return;
  const it = items[+tr.dataset.i], f = e.target.dataset.f;
  it[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  // Dimensions drive volume; weight/volume drive chargeable weight (DIM factor from header)
  if (['l', 'w', 'h', 'pieces'].includes(f)) {
    it.vol = Math.round((+it.pieces || 0) * (+it.l || 0) * (+it.w || 0) * (+it.h || 0) * 1000) / 1000;
    $('[data-f="vol"]', tr).value = it.vol;
  }
  if (['l', 'w', 'h', 'pieces', 'kg', 'vol'].includes(f)) {
    const dim = parseFloat($('#f-dim').value) || 333.333;
    it.charge = Math.round(Math.max(+it.kg || 0, (+it.vol || 0) * dim));
    $('[data-out="charge"]', tr).textContent = fmt(it.charge);
  }
  renderTotals();
  dirty = true;
});
$('#items-body').addEventListener('change', e => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') $('#items-body').dispatchEvent(new Event('input', { bubbles: true })) || null; });
$('#items-body').addEventListener('click', e => {
  const b = e.target.closest('[data-del-item]'); if (!b) return;
  const i = +b.dataset.delItem, removed = items[i];
  items.splice(i, 1); renderItems(); hideTip(); dirty = true;
  snack('Item deleted', { action: 'Undo', onAction: () => { items.splice(i, 0, removed); renderItems(); } });
});
$('#add-item').addEventListener('click', () => {
  items.push({ pieces: 1, type: 'ITEM-Item', desc: '', kg: 0, l: 0, w: 0, h: 0, vol: 0, charge: 0, stack: false, un: '', dg: '', sub: '' });
  renderItems(); dirty = true;
  const rows = $$('#items-body tr'); $('[data-f="desc"]', rows[rows.length - 1]).focus();
});
renderItems();

// Toggle chips
$$('.chip.toggle').forEach(c => c.addEventListener('click', () => { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); dirty = true; }));

// Documents & references
let docs = [
  { type: 'Proof of Delivery', desc: 'POD with glass signa', at: '2 Oct 2026 3:34:55 PM', by: 'MainStreet DocumentScanner (NZ)' },
  { type: 'Proof of Delivery', desc: 'POD with glass signa', at: '2 Oct 2026 3:34:59 PM', by: 'MainStreet DocumentScanner (NZ)' },
];
let refs = [{ type: 'Sender Ref', num: '554311' }, { type: 'Receiver Ref', num: '554311' }];
function renderDocs() {
  $('#docs-body').innerHTML = docs.map((d, i) => `<tr><td>${esc(d.type)}</td><td><a class="cell-link" style="text-decoration:underline" href="#" data-notbuilt="Document viewer – ${esc(d.desc)}">${esc(d.desc)}</a></td><td>${esc(d.at)}</td><td>${esc(d.by)}</td>
    <td class="col-actions"><button class="icon-btn sm" data-del-doc="${i}" data-tip="Delete document" aria-label="Delete document"><span class="i mi">delete</span></button></td></tr>`).join('')
    || '<tr class="empty"><td colspan="5">No items</td></tr>';
}
function renderRefs() {
  $('#refs-body').innerHTML = refs.map((r, i) => `<tr><td>${esc(r.type)}</td><td class="num">${esc(r.num)}</td>
    <td class="col-actions"><button class="icon-btn sm" data-notbuilt="Edit reference – ${esc(r.type)}" data-tip="Edit reference" aria-label="Edit reference"><span class="i mi">edit</span></button><button class="icon-btn sm" data-del-ref="${i}" data-tip="Delete reference" aria-label="Delete reference"><span class="i mi">delete</span></button></td></tr>`).join('')
    || '<tr class="empty"><td colspan="3">No items</td></tr>';
}
document.addEventListener('click', e => {
  const d = e.target.closest('[data-del-doc]');
  if (d) {
    const i = +d.dataset.delDoc;
    dialog({ title: 'Delete document?', body: `“${esc(docs[i].desc)}” will be removed from this consignment.`, confirm: 'Delete document', destructive: true,
      onConfirm: () => { docs.splice(i, 1); renderDocs(); snack('Document deleted'); } });
  }
  const r = e.target.closest('[data-del-ref]');
  if (r) {
    const i = +r.dataset.delRef, removed = refs[i];
    refs.splice(i, 1); renderRefs(); hideTip(); dirty = true;
    snack(`${removed.type} deleted`, { action: 'Undo', onAction: () => { refs.splice(i, 0, removed); renderRefs(); } });
  }
});
renderDocs(); renderRefs();

// Footer actions
function saveConsignment(andClose) {
  const fields = $$('#screen-consignment .field.required');
  const bad = fields.filter(f => !validateField(f));
  const slot = $('#save-alert-slot');
  if (bad.length) {
    slot.innerHTML = `<div class="alert error" role="alert" style="margin-bottom:var(--dimension-between-cards-groups)">
      <i class="i fa-solid fa-circle-exclamation"></i>
      <div class="alert-body"><div class="alert-title">Consignment not saved</div>${bad.length} required field${bad.length > 1 ? 's need' : ' needs'} a value: ${bad.map(f => esc($('label', f).firstChild.textContent.trim())).join(', ')}.</div>
      <button class="icon-btn sm" aria-label="Close" onclick="this.closest('.alert').remove()"><i class="fa-solid fa-xmark"></i></button></div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => $('.ctl', bad[0]).focus({ preventScroll: true }), 300);
    return;
  }
  slot.innerHTML = '';
  dirty = false;
  if (andClose) { go('dispatch'); setTimeout(() => snack('Consignment FWM62085911 saved'), 50); }
  else snack('Consignment FWM62085911 saved');
}
$('#btn-save').addEventListener('click', () => saveConsignment(false));
$('#btn-delete').addEventListener('click', () => dialog({
  title: 'Delete consignment?', body: 'FWM62085911 and its 3 items will be permanently deleted. This can’t be undone.',
  confirm: 'Delete consignment', destructive: true, onConfirm: () => notBuilt('Consignment enquiry (after deleting FWM62085911)'),
}));
$('#btn-cancel').addEventListener('click', () => {
  if (!dirty) { history.length > 1 ? history.back() : go('dispatch'); return; }
  dialog({ title: 'Discard changes?', body: 'Your unsaved changes to FWM62085911 will be lost.', confirm: 'Discard', destructive: true, cancel: 'Keep editing',
    onConfirm: () => { dirty = false; go('dispatch'); } });
});

/* =====================================================================
   TRANSPORT DISPATCH
   ===================================================================== */
const ZONES = [
  ['Airport Oaks', 9, 3], ['Avondale', 3, 0], ['City', 1, 0], ['East Tamaki', 18, 1], ['Henderson', 3, 2], ['Manukau', 17, 0],
  ['Mt Roskill', 0, 1], ['Mt Wellington', 6, 0], ['Onehunga', 1, 0], ['Otahuhu', 10, 0], ['Pakuranga', 1, 0], ['Papakura', 5, 0],
  ['Penrose', 12, 0], ['Pukekohe', 0, 2], ['CDB', 19, 0], ['Hancock', 43, 0], ['Prysmian', 6, 0],
].map(([name, p, d]) => ({ name, p, d }));
let zone = 'Otahuhu';
let allocWarn = false; // set to the action name when the user tries to allocate with no jobs ticked
let zoneKind = 'p'; // which cell is selected: 'p' Pickups, 'd' Deliveries, 'all' Totals

// Deterministic pseudo-random so each zone always shows the same jobs
function rng(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const CARRIERS = ['CAROTRANS', 'MAINFREIGHT AIR', 'OWENS', 'TIL LOGISTICS', 'TNL FREIGHT', 'HALLS'];
const PICKUPS = [['2024/FAVONA', '10 Alderman Place, Favona, Auckland'], ['2022/MANGERE', '4 Ascot Road, Mangere, Auckland'], ['1061/PENROSE', '18 Hugo Johnston Drive, Penrose, Auckland'], ['2013/EAST TAMAKI', '21 Ormiston Road, East Tamaki, Auckland'], ['0610/HENDERSON', '55 Lincoln Road, Henderson, Auckland']];
const DELIVERIES = [['PACIFIC HELMETS LIMITED', '315 Heads Road, Castlecliff,', 'Whanganui 4501, New Zealand', 'WGI34'], ['HARVEY NORMAN NAPIER', '22 Prossers Road, Napier,', 'Napier 4110, New Zealand', 'NPE12'], ['BUNNINGS PALMERSTON NORTH', '330 Main Street, Palmerston North,', 'Palmerston North 4410, New Zealand', 'PMR05'], ['NOEL LEEMING HAMILTON', '10 The Base, Te Rapa,', 'Hamilton 3200, New Zealand', 'HLZ21']];

const jobsCache = {};
function jobsFor(z) {
  if (jobsCache[z]) return jobsCache[z];
  const zd = ZONES.find(x => x.name === z), n = Math.max(zd.p + zd.d, 0), r = rng(z);
  const list = [];
  for (let i = 0; i < n; i++) {
    const first = z === 'Otahuhu' && i < 3; // match Figma exactly for the first rows
    const pu = first ? PICKUPS[0] : PICKUPS[Math.floor(r() * PICKUPS.length)];
    const de = first ? DELIVERIES[0] : DELIVERIES[Math.floor(r() * DELIVERIES.length)];
    list.push({
      id: z + i, kind: i < zd.p ? 'p' : 'd',
      con: first ? 'S0006595' : 'S000' + (6500 + Math.floor(r() * 499)),
      carrier: first ? 'CAROTRANS' : CARRIERS[Math.floor(r() * CARRIERS.length)],
      pc: pu[0], addr: pu[1], service: 'LCL',
      from: '0', to: first ? '10 Jun 15:00' : `10 Jun ${String(12 + Math.floor(r() * 6)).padStart(2, '0')}:${r() > .5 ? '30' : '00'}`,
      pieces: first ? 43 : 1 + Math.floor(r() * 60), ptype: r() > .6 && !first ? 'Pallet' : 'Roll',
      kg: first ? 1106 : 50 + Math.floor(r() * 1800), m: first ? 2.2 : Math.round((0.2 + r() * 4) * 100) / 100,
      del: de, status: 'UNALL',
    });
  }
  return (jobsCache[z] = list);
}
const DRIVERS = [
  ['AKL014', 'James Wilson', 'TRK', 3, 8, 2, 1, 4, [18, 12], [64, 41], [8.4, 5.6], [960, 640]],
  ['AKL027', 'Aroha Thompson', 'VAN', 2, 6, 1, 2, 3, [14, 9], [38, 25], [4.2, 2.8], [840, 560]],
  ['AKL031', 'Ravi Patel', 'TRK', 4, 9, 1, 3, 5, [22, 15], [82, 54], [9.6, 6.4], [980, 650]],
  ['AKL042', 'Sarah Chen', 'VAN', 1, 7, 2, 1, 4, [15, 10], [46, 31], [5.1, 3.4], [860, 580]],
  ['AKL056', 'Sione Tui', 'TRK', 3, 10, 2, 2, 6, [23, 16], [91, 63], [11.2, 7.8], [990, 690]],
  ['AKL063', 'Emma Taylor', 'VAN', 2, 5, 1, 1, 3, [12, 8], [32, 21], [3.8, 2.5], [720, 480]],
  ['AKL078', 'Daniel Lee', 'TRK', 4, 8, 3, 2, 5, [22, 14], [76, 49], [9.2, 6.0], [940, 610]],
  ['AKL085', 'Mele Fale', 'TRK', 2, 9, 1, 3, 4, [19, 13], [68, 46], [8.1, 5.5], [880, 600]],
  ['AKL091', 'Tama Ngata', 'VAN', 1, 4, 0, 1, 2, [8, 5], [22, 14], [2.6, 1.7], [520, 340]],
  ['AKL096', 'Liam Brown', 'TRK', 3, 7, 2, 2, 3, [17, 11], [58, 39], [7.4, 4.9], [910, 600]],
  ['AKL102', 'Priya Singh', 'VAN', 2, 5, 1, 0, 2, [10, 7], [29, 19], [3.2, 2.1], [610, 400]],
  ['AKL110', 'Hemi Walker', 'TRK', 4, 11, 2, 3, 6, [26, 17], [97, 66], [12.1, 8.2], [1020, 700]],
  ['AKL117', 'Grace Kim', 'VAN', 1, 3, 1, 0, 1, [6, 4], [17, 11], [1.9, 1.3], [420, 280]],
].map(([no, name, type, pre, all, nacc, nob, nod, total, pieces, meters, kilo], i) => ({ no, name, type, pre, all, nacc, nob, nod, total, pieces, meters, kilo, phoneOnly: i === 6 }));

const sel = new Set();
let selDriver = null, jobsPage = 0, jobsPer = 5, drvPage = 0, drvPer = 5;

function visibleJobs() {
  const list = jobsFor(zone);
  return zoneKind === 'all' ? list : list.filter(j => j.kind === zoneKind);
}
const KIND_LABEL = { p: 'Pickups', d: 'Deliveries', all: 'Pickups and deliveries' };
function renderZones() {
  // Totals include zones scrolled off the Figma (233 / 16 / 249 at load)
  const T = ZONES.reduce((a, z) => ({ p: a.p + z.p, d: a.d + z.d }), { p: 79, d: 7 });
  // Each number is its own clickable cell: Pickups, Deliveries, or Totals (= both)
  const cell = (v, z, kind) => {
    const on = z === zone && kind === zoneKind;
    if (!v) return `<td class="zone-cell empty"></td>`;
    return `<td class="zone-cell${on ? ' cell-sel' : ''}" data-zone="${esc(z)}" data-kind="${kind}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(z)}, ${KIND_LABEL[kind].toLowerCase()}: ${v}">${v}</td>`;
  };
  $('#zone-grid').innerHTML = `
    <thead><tr><th></th><th>Total</th>${ZONES.map(z => `<th class="${z.name === zone ? 'zone-sel' : ''}" title="${esc(z.name)}">${esc(z.name.length > 11 ? z.name.slice(0, 10) + '…' : z.name)}</th>`).join('')}</tr></thead>
    <tbody>
      <tr><td>Pickups</td><td>${T.p}</td>${ZONES.map(z => cell(z.p, z.name, 'p')).join('')}</tr>
      <tr><td>Deliveries</td><td>${T.d}</td>${ZONES.map(z => cell(z.d, z.name, 'd')).join('')}</tr>
      <tr class="totals"><td>Totals</td><td>${T.p + T.d}</td>${ZONES.map(z => cell(z.p + z.d, z.name, 'all')).join('')}</tr>
    </tbody>`;
}
function selectZone(z, kind = 'all') {
  zone = z; zoneKind = kind; sel.clear(); jobsPage = 0;
  renderZones(); renderJobs(); renderDrivers();
  $('#jobs-title').textContent = `Jobs - Not Dispatched (${KIND_LABEL[kind]}) for zone ${z.toUpperCase()}`;
  $('#drivers-title').textContent = `Cartage - for zone ${z.toUpperCase()}`;
  const c = $(`#zone-grid [data-zone="${CSS.escape(z)}"][data-kind="${kind}"]`); if (c) c.focus({ preventScroll: true });
}
$('#zone-grid').addEventListener('click', e => { const c = e.target.closest('[data-zone]'); if (c) selectZone(c.dataset.zone, c.dataset.kind); });
$('#zone-grid').addEventListener('keydown', e => { const c = e.target.closest('[data-zone]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectZone(c.dataset.zone, c.dataset.kind); } });

function pager(total, page, per, kind) {
  const start = total ? page * per + 1 : 0, end = Math.min(total, (page + 1) * per);
  return `<span class="spacer"></span>
    <label>Rows per page: <select data-per="${kind}">${[5, 10, 25].map(n => `<option ${n === per ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <span>${start}–${end} of ${total}</span>
    <button class="icon-btn sm" data-page="${kind}:-1" ${page === 0 ? 'disabled' : ''} aria-label="Previous page"><span class="i mi">chevron_left</span></button>
    <button class="icon-btn sm" data-page="${kind}:1" ${end >= total ? 'disabled' : ''} aria-label="Next page"><span class="i mi">chevron_right</span></button>`;
}

function renderJobs() {
  const all = visibleJobs(), pageRows = all.slice(jobsPage * jobsPer, (jobsPage + 1) * jobsPer);
  // One <tbody> per job so PUP + DEL rows hover, select and stripe as a single row
  const table = $('#jobs-table');
  $$('tbody', table).forEach(t => t.remove());
  table.insertAdjacentHTML('beforeend', pageRows.map(j => `<tbody class="job ${sel.has(j.id) ? 'selected' : ''}" data-job="${j.id}">
    <tr class="job-pup">
      <td class="col-check" rowspan="2"><label class="check"><input type="checkbox" data-sel="${j.id}" ${sel.has(j.id) ? 'checked' : ''} aria-label="Select ${j.con}"><span class="box"></span></label></td>
      <td>PUP</td>
      <td><a class="cell-link" href="#/consignment" style="text-decoration:underline">${j.con}</a><span class="sub">${esc(j.carrier)}</span></td>
      <td>${esc(j.pc)}<span class="sub" style="max-width:150px;overflow:hidden;text-overflow:ellipsis" title="${esc(j.addr)}">${esc(j.addr)}</span></td>
      <td>${j.service}</td>
      <td>${j.from}<span class="sub">${j.to}</span></td>
      <td class="num">${j.pieces}<span class="sub">${j.ptype}</span></td>
      <td class="num">${j.kg}<span class="sub">${j.m.toFixed(2)}</span><span class="sub">${j.pieces}*(**)</span></td>
      <td></td><td></td>
      <td class="num">${j.status}<div class="status-icons"><span class="i mi" data-tip="Manifest">map</span></div></td>
    </tr>
    <tr class="job-del">
      <td>DEL</td>
      <td>Deliver To<span class="sub" style="max-width:150px;overflow:hidden;text-overflow:ellipsis" title="${esc(j.del[0])}">${esc(j.del[0])}</span></td>
      <td>${esc(j.del[1])}<span class="sub" style="max-width:150px;overflow:hidden;text-overflow:ellipsis" title="${esc(j.del[2])}">${esc(j.del[2])}</span></td>
      <td></td><td></td><td></td><td></td>
      <td style="vertical-align:bottom">${j.del[3]}</td><td></td>
      <td class="num">${j.status}<div class="status-icons"><span class="i mi" data-tip="Delivery notes">content_paste</span><span class="i mi" data-tip="Watched">visibility</span><span class="i mi" data-tip="Dimensions checked">square_foot</span></div></td>
    </tr></tbody>`).join('') || `<tbody><tr class="empty"><td colspan="11">No unallocated jobs for ${esc(zone)}</td></tr></tbody>`);
  const ids = pageRows.map(j => j.id), allBox = $('#jobs-all');
  const n = ids.filter(id => sel.has(id)).length;
  allBox.checked = n > 0 && n === ids.length; allBox.indeterminate = n > 0 && n < ids.length;
  const chosen = all.filter(j => sel.has(j.id));
  const pcs = chosen.reduce((a, j) => a + j.pieces, 0), m3 = chosen.reduce((a, j) => a + j.m, 0), kg = chosen.reduce((a, j) => a + j.kg, 0);
  $('#jobs-foot').innerHTML = `<span>Current Selection: ${pcs} Pieces - ${Math.round(m3 * 100) / 100} m3 - ${kg} kg - ${chosen.length} Selected</span>` + pager(all.length, jobsPage, jobsPer, 'jobs');
  // Bulk bar replaces the card header while rows are selected (ONE DS Bulk Actions)
  $('#jobs-bulk').hidden = !sel.size; $('#jobs-head').hidden = !!sel.size;
  $('#bulk-count').textContent = `${sel.size} selected`;
  // Sticky footer: Allocate needs at least one job and a driver
  const ready = !!(sel.size && selDriver), drv = selDriver && DRIVERS.find(d => d.no === selDriver);
  const jobsTxt = sel.size ? `<b>${sel.size} job${sel.size > 1 ? 's' : ''}</b> · ${pcs} pieces · ${Math.round(m3 * 100) / 100} m3 · ${kg.toLocaleString('en-NZ')} kg` : 'No jobs selected';
  const drvTxt = drv ? `<b>${esc(drv.name)}</b> (${drv.no})` : 'no driver selected';
  if (sel.size) allocWarn = false;
  const sum = $('#alloc-summary');
  sum.classList.toggle('warn', allocWarn);
  sum.innerHTML = allocWarn
    ? `<span class="i mi warn-icon" aria-hidden="true">warning_amber</span><b>Select at least one job to ${allocWarn}</b>`
    : `${jobsTxt} <span class="i mi" aria-hidden="true">arrow_forward</span> ${drvTxt}`;
}
function renderDrivers() {
  const rows = DRIVERS.slice(drvPage * drvPer, (drvPage + 1) * drvPer);
  $('#drivers-body').innerHTML = rows.map(d => `
    <tr class="${selDriver === d.no ? 'selected' : ''}" data-driver="${d.no}">
      <td class="col-check"><label class="check radio"><input type="radio" name="driver" value="${d.no}" ${selDriver === d.no ? 'checked' : ''} aria-label="Select ${esc(d.name)}"><span class="box"></span></label></td>
      <td style="vertical-align:middle">${d.no}</td>
      <td><a class="cell-link" href="#" style="text-decoration:underline" data-notbuilt="Driver profile – ${esc(d.name)}">${esc(d.name)}</a>
        <div class="drv-icons">${d.phoneOnly ? '' : '<span class="i mi" data-tip="Preferred driver">star</span>'}<span class="i mi" data-tip="Has app">smartphone</span>${d.no === 'AKL014' || d.no === 'AKL078' ? '<span class="pct">0%</span><span class="pct">0%</span>' : ''}</div></td>
      <td>${d.type}</td>
      ${['pre', 'all', 'nacc', 'nob', 'nod'].map(k => `<td class="num">${d[k]}</td>`).join('')}
      ${['total', 'pieces', 'meters', 'kilo'].map(k => `<td class="num">${d[k][0]}<span class="sub" style="display:block">${typeof d[k][1] === 'number' && k === 'meters' ? d[k][1].toFixed(1) : d[k][1]}</span></td>`).join('')}
    </tr>`).join('');
  $('#drivers-foot').innerHTML = pager(DRIVERS.length, drvPage, drvPer, 'drv');
}

// Clicking anywhere on a job (PUP or DEL line) toggles its selection
$('#jobs-table').addEventListener('click', e => {
  const body = e.target.closest('tbody.job');
  if (!body || e.target.closest('a, button, input, label')) return; // links/checkbox keep their own behaviour
  if (getSelection().toString()) return; // don't toggle when the user is selecting text
  const id = body.dataset.job;
  sel.has(id) ? sel.delete(id) : sel.add(id);
  renderJobs();
});
$('#jobs-table').addEventListener('change', e => {
  const id = e.target.dataset.sel; if (!id) return;
  e.target.checked ? sel.add(id) : sel.delete(id);
  renderJobs();
});
$('#jobs-all').addEventListener('change', e => {
  visibleJobs().slice(jobsPage * jobsPer, (jobsPage + 1) * jobsPer).forEach(j => e.target.checked ? sel.add(j.id) : sel.delete(j.id));
  renderJobs();
});
$('#bulk-clear').addEventListener('click', () => { sel.clear(); renderJobs(); });
$('#drivers-body').addEventListener('click', e => {
  if (e.target.closest('a')) return;
  const tr = e.target.closest('tr[data-driver]'); if (!tr) return;
  // Clicking the selected driver again unselects it
  selDriver = selDriver === tr.dataset.driver ? null : tr.dataset.driver; renderDrivers(); renderJobs();
});
document.addEventListener('change', e => {
  const per = e.target.dataset && e.target.dataset.per;
  if (per === 'jobs') { jobsPer = +e.target.value; jobsPage = 0; renderJobs(); }
  if (per === 'drv') { drvPer = +e.target.value; drvPage = 0; renderDrivers(); }
});
document.addEventListener('click', e => {
  const p = e.target.closest('[data-page]'); if (!p) return;
  const [kind, dir] = p.dataset.page.split(':');
  if (kind === 'jobs') { jobsPage += +dir; renderJobs(); } else { drvPage += +dir; renderDrivers(); }
});

// Bulk actions (Figma 4770:195664) — not built, but say how many jobs they'd act on
document.addEventListener('click', e => {
  const b = e.target.closest('[data-bulk]'); if (!b) return;
  if (PRINT_DOCS[b.dataset.bulk]) return openPrintDialog(b.dataset.bulk);
  notBuilt(`${b.dataset.bulk} – ${sel.size} selected job${sel.size > 1 ? 's' : ''}`);
});

/* ---------------------------------------------------------------------
   Print options dialogs (legacy "Print Options – …", Figma group 4800:188023)
   Bulk actions: Delivery receipt · Consignment (consignment note) · Print labels (shipment label)
   ONE DS: Dialog sm (600) · Tabs (Print / Email) · Forms (outlined fields, required bar)
   · Modal Footer Button "Extended": Ghost Cancel left; Secondary Preview + Primary right.
   Legacy → new: "Num of Copies" → Copies · "Use As Default" → "Save as my default for this document"
   · "Document Copies: Print T&C" → "Include terms and conditions" · Label Email tab (greyed out) → disabled tab with tooltip.
   --------------------------------------------------------------------- */
const PRINTERS = ['BrotherLevel3', 'Otahuhu Dispatch – HP LaserJet M507', 'Otahuhu Office – Ricoh IM C3000'];
const LABEL_PRINTERS = ["Dylan's Datamax M-4206 Label Printer", 'Otahuhu Dock 2 – Zebra ZT411', 'Otahuhu Dock 5 – Zebra ZT411'];
const PRINT_DOCS = {
  'Delivery receipt': { title: 'Delivery receipt', noun: 'delivery receipt', printers: PRINTERS, trays: ['1', '2', 'Manual feed'], dg: true, tc: false, email: true },
  'Consignment': { title: 'Consignment note', noun: 'consignment note', printers: PRINTERS, trays: ['1', '2', 'Manual feed'], dg: true, tc: true, email: true },
  'Print labels': { title: 'Shipment label', noun: 'shipment label', printers: LABEL_PRINTERS, trays: ['Default'], dg: false, tc: false, email: false },
};
const printDefaults = {}; // "Save as my default" per document type (session only)
const SENDER_EMAIL = 'dispatch.otahuhu@mainfreight.co.nz';

function openPrintDialog(key) {
  const doc = PRINT_DOCS[key], d = printDefaults[key] || {};
  const n = sel.size, jobsTxt = `${n} selected job${n > 1 ? 's' : ''}`;
  const opt = (list, v) => list.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const cb = (id, label, on) => `<label class="check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="box"></span>${label}</label>`;
  const docOptions = pre => `
    <div class="pd-checks">
      ${doc.tc ? cb(pre + '-tc', 'Include terms and conditions', d.tc ?? true) : ''}
      ${doc.dg ? cb(pre + '-dg', 'Include DG documents', d.dg ?? false) : ''}
    </div>`;
  const bd = dialog({
    title: `Print ${doc.noun}${n > 1 ? 's' : ''}`, size: 'sm', confirm: 'Print', cancel: 'Cancel',
    extra: '<button class="btn btn-outlined" data-preview>Preview</button>',
    body: `
      <p class="pd-sub">${jobsTxt}</p>
      <div class="tabs pd-tabs" role="tablist" aria-label="Send by">
        <button class="tab" role="tab" aria-selected="true" data-pd-tab="print" id="pd-tab-print" aria-controls="pd-print">Print</button>
        <button class="tab" role="tab" aria-selected="false" data-pd-tab="email" id="pd-tab-email" aria-controls="pd-email" ${doc.email ? '' : 'aria-disabled="true" data-tip="Shipment labels can only be printed"'}>Email</button>
      </div>

      <div class="pd-panel" id="pd-print" role="tabpanel" aria-labelledby="pd-tab-print">
        <div class="field select required filled"><select class="ctl" id="pd-printer">${opt(doc.printers, d.printer || doc.printers[0])}</select><label for="pd-printer">Printer<span class="req-star">*</span></label></div>
        <div class="pd-row">
          <div class="field filled"><input class="ctl num" type="number" id="pd-copies" min="1" max="99" value="${d.copies || 1}"><label for="pd-copies">Copies</label></div>
          <div class="field select filled"><select class="ctl" id="pd-tray">${opt(doc.trays, d.tray || doc.trays[0])}</select><label for="pd-tray">Printer tray</label></div>
        </div>
        ${docOptions('pd')}
        <div class="pd-checks pd-default">${cb('pd-default', 'Save as my default for this document', !!printDefaults[key])}</div>
      </div>

      <div class="pd-panel" id="pd-email" role="tabpanel" aria-labelledby="pd-tab-email" hidden>
        <div class="field filled"><input class="ctl" type="email" id="pe-from" value="${SENDER_EMAIL}"><label for="pe-from">From</label></div>
        <div class="field required"><input class="ctl" type="text" id="pe-to" autocomplete="off"><label for="pe-to">To<span class="req-star">*</span></label><div class="helper">Separate several addresses with commas</div></div>
        <div class="field filled"><input class="ctl" id="pe-subject" value="${esc(doc.title)}${n > 1 ? 's' : ''} – ${jobsTxt}"><label for="pe-subject">Subject</label></div>
        <div class="field always-float"><textarea class="ctl" id="pe-body" rows="4" placeholder="Add a note to include in the email"></textarea><label for="pe-body">Message</label></div>
        <div class="pd-checks">${cb('pe-copy', 'Send me a copy', false)}</div>
        ${docOptions('pe')}
      </div>`,
    onConfirm: bd => {
      if (mode === 'print') {
        const f = $('#pd-printer', bd).closest('.field');
        if (!validateField(f)) return false;
        const copies = Math.max(1, Math.min(99, parseInt($('#pd-copies', bd).value, 10) || 1));
        const printer = $('#pd-printer', bd).value;
        if ($('#pd-default', bd).checked) printDefaults[key] = { printer, tray: $('#pd-tray', bd).value, copies, dg: $('#pd-dg', bd)?.checked, tc: $('#pd-tc', bd)?.checked };
        else delete printDefaults[key];
        snack(`Printing ${n} ${doc.noun}${n > 1 ? 's' : ''} on ${printer}${copies > 1 ? ` (${copies} copies each)` : ''}`);
      } else {
        const f = $('#pe-to', bd).closest('.field'), to = $('#pe-to', bd).value.trim();
        if (!to) { validateField(f); $('#pe-to', bd).focus(); return false; }
        const bad = to.split(',').map(x => x.trim()).filter(Boolean).filter(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
        if (bad.length) { setFieldError(f, `Check this address: ${bad[0]}`); $('#pe-to', bd).focus(); return false; }
        const count = to.split(',').filter(x => x.trim()).length;
        snack(`${doc.title}${n > 1 ? 's' : ''} emailed to ${count > 1 ? count + ' recipients' : to}`);
      }
    },
  });

  let mode = 'print';
  const okBtn = $('[data-ok]', bd);
  const setMode = m => {
    mode = m;
    $$('[data-pd-tab]', bd).forEach(t => t.setAttribute('aria-selected', String(t.dataset.pdTab === m)));
    $('#pd-print', bd).hidden = m !== 'print';
    $('#pd-email', bd).hidden = m !== 'email';
    okBtn.textContent = m === 'print' ? 'Print' : 'Send email';
    ($(m === 'print' ? '#pd-printer' : '#pe-to', bd)).focus();
  };
  $$('[data-pd-tab]', bd).forEach(t => t.addEventListener('click', () => {
    if (t.getAttribute('aria-disabled') === 'true') return;
    setMode(t.dataset.pdTab);
  }));
  $('.pd-tabs', bd).addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('[data-pd-tab]:not([aria-disabled="true"])', bd);
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].focus();
  });
  $('#pe-to', bd).addEventListener('input', e => { const f = e.target.closest('.field'); if (f.classList.contains('error')) setFieldError(f, ''); });
  $('[data-preview]', bd).addEventListener('click', () => { bd.close(); notBuilt(`Preview – ${doc.title.toLowerCase()} (${jobsTxt})`); });
  $$('.field', bd).forEach(syncFilled);
}

// Allocate selected jobs to the chosen driver (sticky footer split button)
function allocate({ pre = false, accept = false, driverNo = selDriver } = {}) {
  if (!(sel.size && driverNo)) return;
  const driver = DRIVERS.find(d => d.no === driverNo), z = ZONES.find(x => x.name === zone);
  const list = jobsFor(zone), moved = list.filter(j => sel.has(j.id));
  const key = pre ? 'pre' : 'all';
  const snapshot = { list: list.slice(), count: driver[key], p: z.p, d: z.d };
  jobsCache[zone] = list.filter(j => !sel.has(j.id));
  driver[key] += moved.length;
  const fromP = Math.min(z.p, moved.length); z.p -= fromP; z.d = Math.max(0, z.d - (moved.length - fromP));
  sel.clear();
  if (jobsPage * jobsPer >= jobsCache[zone].length) jobsPage = Math.max(0, jobsPage - 1);
  renderZones(); renderJobs(); renderDrivers();
  const n = `${moved.length} job${moved.length > 1 ? 's' : ''}`;
  snack(pre ? `${n} pre-allocated to ${driver.name}` : accept ? `${n} allocated to and accepted for ${driver.name}` : `${n} allocated to ${driver.name}`, { action: 'Undo', onAction: () => {
    jobsCache[zone] = snapshot.list; driver[key] = snapshot.count; z.p = snapshot.p; z.d = snapshot.d;
    renderZones(); renderJobs(); renderDrivers();
  } });
}
// Segmented actions are always active; each opens a dialog (ONE DS Dialog — no Figma design yet)
const ALLOC_COPY = {
  pre: { title: 'Pre-allocate jobs', verb: 'Pre-allocate', help: 'Pre-allocated jobs show in the driver’s PRE count until you allocate them.' },
  allocate: { title: 'Allocate jobs', verb: 'Allocate', help: 'The driver will see these jobs on their run.' },
  accept: { title: 'Allocate and accept', verb: 'Accept', help: 'Jobs are allocated and marked as accepted for the driver.' },
};
$$('[data-alloc]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.alloc, c = ALLOC_COPY[a];
  if (!sel.size) {
    allocWarn = c.verb.toLowerCase();
    renderJobs();
    const all = $('#jobs-all').closest('.check');
    all.classList.remove('nudge'); void all.offsetWidth; all.classList.add('nudge');
    $('#jobs-table').closest('.card').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  const n = `${sel.size} job${sel.size > 1 ? 's' : ''}`;
  dialog({
    title: c.title, confirm: c.verb, cancel: 'Cancel',
    body: `<p style="margin:0 0 16px">${c.help}</p>
      <div class="field select required ${selDriver ? 'filled' : ''}" style="--field-surface: var(--background-paper)">
        <select class="ctl" id="dlg-driver"><option value=""></option>${DRIVERS.map(d => `<option value="${d.no}" ${d.no === selDriver ? 'selected' : ''}>${d.no} – ${esc(d.name)} (${d.type})</option>`).join('')}</select>
        <label for="dlg-driver">Driver<span class="req-star">*</span></label>
      </div>
      <p class="caption" style="margin:12px 0 0">${n} selected in zone ${esc(zone)}</p>`,
    onConfirm: bd => {
      const f = $('.field', bd), driverNo = $('#dlg-driver', bd).value;
      if (!validateField(f)) { $('#dlg-driver', bd).focus(); return false; }
      selDriver = driverNo;
      allocate({ pre: a === 'pre', accept: a === 'accept', driverNo });
    },
  });
}));

// Filters ---------------------------------------------------------------
// Hide statuses come from the legacy panel (Figma 4775:202718) and stay in sync with the bar's "Hide" field.
const HIDE_DEFAULT = { Unmanifested: true, 'Depot held': false, Completed: true, Onboard: true };
const HIDE_OPTS = Object.entries(HIDE_DEFAULT).map(([label, checked]) => ({ label, checked }));
const SCOPE_OPTS = ['REJ/UNALL jobs only', 'Local only', 'FTL jobs only', 'Pickup only', 'Priority', 'Available', 'Stocktake – action only', 'BCP'];
const ATTRS = ['Return', 'Split', 'OSD', 'Picking', 'Stocktake', 'DG', 'Timeslot', 'Exception freight', 'Has SSR', 'SMS', 'Residential', 'Must deliver'];
const blankAdv = () => ({ from: '', linehaul: '', lhTime: '', scope: {}, attrs: {} });
let adv = blankAdv();
let savedFilters = []; // filled in below
const deepCopy = o => JSON.parse(JSON.stringify(o));
const BAR = { group: '#flt-group', cgroup: '#flt-cgroup', applied: '#flt-applied', lh: '#flt-lh' };

function hideMenuItems() {
  return HIDE_OPTS.map(o => ({ label: o.label, checkbox: true, checked: o.checked, onToggle: v => { o.checked = v; syncHide(); renderActiveFilters(); } }));
}
function syncHide() {
  const b = $('#flt-hide'); b.textContent = HIDE_OPTS.filter(o => o.checked).map(o => o.label).join(', ');
  syncFilled(b.closest('.field'));
}
const fmtDate = v => v ? v.split('-').reverse().join('/') : '';

// Active filter chips (always visible while anything non-default is applied)
function activeFilterList() {
  const out = [];
  if (adv.from) out.push({ label: `From ${fmtDate(adv.from)}`, clear: () => { adv.from = ''; } });
  if (adv.linehaul) out.push({ label: `Linehaul: ${adv.linehaul}${adv.lhTime ? ' by ' + adv.lhTime : ''}`, clear: () => { adv.linehaul = ''; adv.lhTime = ''; } });
  SCOPE_OPTS.forEach(k => { if (adv.scope[k]) out.push({ label: k, clear: () => { delete adv.scope[k]; } }); });
  HIDE_OPTS.forEach(o => { if (o.checked !== HIDE_DEFAULT[o.label]) out.push({ label: `${o.checked ? 'Hide' : 'Show'} ${o.label.toLowerCase()}`, clear: () => { o.checked = HIDE_DEFAULT[o.label]; syncHide(); } }); });
  ATTRS.forEach(k => { const v = adv.attrs[k]; if (v) out.push({ label: `${v === 'only' ? 'Only' : 'Hide'}: ${k}`, clear: () => { delete adv.attrs[k]; } }); });
  return out;
}
function renderActiveFilters() {
  const list = activeFilterList(), box = $('#active-filters');
  box.hidden = !list.length;
  box.innerHTML = list.map((f, i) => `<span class="chip">${esc(f.label)}<button type="button" class="chip-x" data-chip="${i}" aria-label="Remove filter: ${esc(f.label)}"><span class="mi">cancel</span></button></span>`).join('');
  box._list = list;
  // Filters button shows a count badge + selected tint when anything is applied
  const n = list.length, c = $('#filter-count'), btn = $('#btn-filters');
  c.hidden = !n; c.textContent = n;
  btn.classList.toggle('has-filters', !!n);
  btn.setAttribute('aria-label', n ? `Filters, ${n} applied` : 'Filters');
  syncSavedField();
}
// "Saved filter" select in the bar shows which saved filter matches what's applied
function matchingSaved() {
  const cur = describeState(captureState()).join('|');
  return savedFilters.find(f => describeState(f.state).join('|') === cur) || null;
}
function syncSavedField() {
  const b = $('#flt-saved'); if (!b) return;
  const m = matchingSaved();
  b.textContent = m ? m.name : '';
  syncFilled(b.closest('.field'));
}
$('#active-filters').addEventListener('click', e => {
  const b = e.target.closest('[data-chip]'); if (!b) return;
  $('#active-filters')._list[+b.dataset.chip].clear();
  renderActiveFilters(); doRefresh();
});

// Side sheet
const sheet = $('#filter-sheet');
function buildSheet() {
  $('#sf-from').value = adv.from;
  $('#sf-to').value = $('#flt-date').value;
  $('#sf-linehaul').value = adv.linehaul;
  $('#sf-lh-time').value = adv.lhTime;
  syncLinehaul();
  const cb = (name, label, checked) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(label)}" ${checked ? 'checked' : ''}><span class="box"></span>${esc(label)}</label>`;
  $('#sf-scope').innerHTML = SCOPE_OPTS.map(k => cb('scope', k, adv.scope[k])).join('');
  $('#sf-hide').innerHTML = HIDE_OPTS.map(o => cb('hide', o.label, o.checked)).join('');
  $('#sf-attrs').innerHTML = ATTRS.map((k, i) => `<tr><td>${esc(k)}</td>${['', 'only', 'hide'].map(v => `<td class="center"><label class="check radio"><input type="radio" name="attr-${i}" value="${v}" ${(adv.attrs[k] || '') === v ? 'checked' : ''} aria-label="${esc(k)}: ${v ? (v === 'only' ? 'show only' : 'hide') : 'any'}"><span class="box"></span></label></td>`).join('')}</tr>`).join('');
  $$('.field', sheet).forEach(syncFilled);
}
function syncLinehaul() {
  const on = !!$('#sf-linehaul').value, f = $('#sf-lh-time-field');
  f.classList.toggle('disabled', !on); $('#sf-lh-time').disabled = !on;
  const h = $('.helper', f); if (h) h.hidden = on;
  if (!on) $('#sf-lh-time').value = '';
}
$('#sf-linehaul').addEventListener('change', syncLinehaul);
// Track unapplied edits so closing without Apply can offer to bring them back
let sheetDirty = false;
sheet.addEventListener('input', () => { sheetDirty = true; });
sheet.addEventListener('change', e => { if (e.target.id !== 'flt-saved') sheetDirty = true; });
function captureDraft() {
  return $$('input, select', sheet).map(el => ({ key: el.id || `${el.name}=${el.value}`, value: el.value, checked: el.checked }));
}
function restoreDraft(draft) {
  draft.forEach(d => {
    const el = d.key.includes('=') ? $$('input', sheet).find(i => `${i.name}=${i.value}` === d.key) : $('#' + CSS.escape(d.key), sheet);
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = d.checked; else el.value = d.value;
  });
  $$('.field', sheet).forEach(syncFilled); syncLinehaul();
  sheetDirty = true;
}
// Unapplied edits survive closing the sheet (like the legacy screen, where nothing applies until Refresh).
// They come back when the sheet reopens; the Filters button shows a dot while they're pending.
let pendingDraft = null;
function setPending(draft) {
  pendingDraft = draft;
  const b = $('#btn-filters');
  b.classList.toggle('has-pending', !!draft);
  b.toggleAttribute('data-tip', !!draft);
  if (draft) b.setAttribute('data-tip', 'Filter changes not applied yet');
  b.setAttribute('aria-label', (b.getAttribute('aria-label') || 'Filters').replace(/, changes not applied$/, '') + (draft ? ', changes not applied' : ''));
}
function openSheet(draft = pendingDraft) {
  buildSheet();
  sheetDirty = false;
  if (draft) restoreDraft(draft);
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  $('#btn-filters').setAttribute('aria-expanded', 'true');
  $('#sf-from').focus();
}
function closeSheet({ discard = false, focusButton = true } = {}) {
  if (!sheet.classList.contains('open')) return;
  // Closing without Apply keeps the edits as a pending draft (no dialog, nothing lost)
  if (discard && sheetDirty) setPending(captureDraft());
  sheet.classList.remove('open');
  sheetDirty = false;
  $('#btn-filters').setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 250);
  if (focusButton) $('#btn-filters').focus();
}
$('#btn-filters').addEventListener('click', () => sheet.classList.contains('open') ? closeSheet({ discard: true }) : openSheet());
sheet.addEventListener('click', e => { if (e.target.closest('[data-sheet-close]')) closeSheet({ discard: true }); });
sheet.addEventListener('keydown', e => { if (e.key === 'Escape' && !openMenuEl) closeSheet({ discard: true }); });
// Clicking outside the sheet closes it without applying.
// Ignore clicks in menus, dialogs, the snackbar, tooltips and the Filters button itself.
document.addEventListener('mousedown', e => {
  if (!sheet.classList.contains('open')) return;
  if (e.target.closest('#filter-sheet, #btn-filters, .menu, .backdrop, #snackbar, .tooltip')) return;
  closeSheet({ discard: true, focusButton: false });
});
$('#sf-clear').addEventListener('click', () => {
  adv = blankAdv(); HIDE_OPTS.forEach(o => { o.checked = HIDE_DEFAULT[o.label]; });
  $('#sf-to').value = $('#flt-date').dataset.default;
  const keepTo = $('#sf-to').value; buildSheet(); $('#sf-to').value = keepTo; syncFilled($('#sf-to').closest('.field'));
});
function applySheet({ quiet = false } = {}) {
  if (!validateField($('#sf-to').closest('.field'))) { $('#sf-to').focus(); return false; }
  const from = $('#sf-from').value, to = $('#sf-to').value;
  if (from && from > to) {
    const f = $('#sf-from').closest('.field'); f.classList.add('error');
    let h = $('.helper', f); if (!h) { h = document.createElement('div'); h.className = 'helper'; f.appendChild(h); }
    h.textContent = 'Date from must be on or before Date to'; $('#sf-from').focus(); return false;
  }
  adv.from = from;
  $('#flt-date').value = to; syncFilled($('#flt-date').closest('.field'));
  adv.linehaul = $('#sf-linehaul').value; adv.lhTime = $('#sf-lh-time').value;
  adv.scope = {}; $$('input[name="scope"]:checked', sheet).forEach(i => { adv.scope[i.value] = true; });
  HIDE_OPTS.forEach(o => { o.checked = !!$(`input[name="hide"][value="${CSS.escape(o.label)}"]`, sheet).checked; }); syncHide();
  adv.attrs = {}; ATTRS.forEach((k, i) => { const v = $(`input[name="attr-${i}"]:checked`, sheet).value; if (v) adv.attrs[k] = v; });
  sheetDirty = false; setPending(null); closeSheet(); renderActiveFilters(); doRefresh();
  const n = activeFilterList().length;
  if (!quiet) snack(n ? `${n} filter${n > 1 ? 's' : ''} applied` : 'Filters applied');
  return true;
}
$('#sf-apply').addEventListener('click', () => applySheet());
$('#sf-save').addEventListener('click', () => { if (applySheet({ quiet: true })) openSaveDialog(); });
$('#sf-from').addEventListener('input', e => { const f = e.target.closest('.field'); f.classList.remove('error'); const h = $('.helper', f); if (h) h.remove(); });

$('#flt-clear').addEventListener('click', () => {
  setPending(null);
  $$('#dp-unallocated .filter-bar [data-default]').forEach(c => { c.value = c.dataset.default; syncFilled(c.closest('.field')); });
  adv = blankAdv(); HIDE_OPTS.forEach(o => { o.checked = HIDE_DEFAULT[o.label]; }); syncHide();
  renderActiveFilters();
  if (sheet.classList.contains('open')) buildSheet();
  snack('Filters cleared');
});
syncHide(); renderActiveFilters();

/* ---------------------------------------------------------------------
   Saved filters (replaces legacy "Dispatch Filter Templates", Figma 4775:202719 / 4777:202720)
   ONE DS: Menu for quick apply · Dialog (Modal Footer Button) for save · DataGrid in a Dialog for manage
   Legacy → new: Name → Name · Default → "Use as my default" · Branch Template → "Share with my branch"
   · Branch Default → "Branch default" · Preview → filter summary column · Edit → inline rename
   · Delete → Undo snackbar (reversible, so no confirmation) · Confirm → Apply
   --------------------------------------------------------------------- */
function captureState() {
  const st = { adv: deepCopy(adv), hide: Object.fromEntries(HIDE_OPTS.map(o => [o.label, o.checked])) };
  Object.entries(BAR).forEach(([k, sel]) => { st[k] = $(sel).value; });
  return st;
}
function applyState(st) {
  setPending(null);
  Object.entries(BAR).forEach(([k, sel]) => { $(sel).value = st[k] ?? $(sel).dataset.default; syncFilled($(sel).closest('.field')); });
  HIDE_OPTS.forEach(o => { o.checked = st.hide && o.label in st.hide ? st.hide[o.label] : HIDE_DEFAULT[o.label]; }); syncHide();
  adv = Object.assign(blankAdv(), deepCopy(st.adv || {}));
  renderActiveFilters(); doRefresh();
  if (sheet.classList.contains('open')) { buildSheet(); sheetDirty = false; }
}
// Human-readable summary (the legacy "Preview")
function describeState(st) {
  const out = [];
  if (st.group && st.group !== 'ALL') out.push(`Group: ${st.group}`);
  if (st.cgroup && st.cgroup !== '(All Jobs)') out.push(`Customers: ${st.cgroup}`);
  if (st.applied && st.applied !== 'Sender') out.push(`Applied to ${st.applied.toLowerCase()}`);
  if (st.lh) out.push(`LH jobs: ${st.lh}`);
  const a = Object.assign(blankAdv(), st.adv || {});
  if (a.from) out.push(`From ${fmtDate(a.from)}`);
  if (a.linehaul) out.push(`Linehaul: ${a.linehaul}`);
  SCOPE_OPTS.forEach(k => { if (a.scope[k]) out.push(k); });
  Object.entries(st.hide || {}).forEach(([k, v]) => { if (v !== HIDE_DEFAULT[k]) out.push(`${v ? 'Hide' : 'Show'} ${k.toLowerCase()}`); });
  ATTRS.forEach(k => { const v = a.attrs[k]; if (v) out.push(`${v === 'only' ? 'Only' : 'Hide'}: ${k}`); });
  return out;
}

savedFilters = [
  { id: 1, name: 'Morning pickups', shared: false, isDefault: false, branchDefault: false, state: { group: 'Pickups', cgroup: '(All Jobs)', applied: 'Sender', lh: '', hide: { ...HIDE_DEFAULT }, adv: { from: '', linehaul: '', lhTime: '', scope: { 'Pickup only': true }, attrs: {} } } },
  { id: 2, name: 'DG and priority', shared: true, isDefault: false, branchDefault: false, state: { group: 'ALL', cgroup: '(All Jobs)', applied: 'Sender', lh: '', hide: { ...HIDE_DEFAULT }, adv: { from: '', linehaul: '', lhTime: '', scope: { Priority: true }, attrs: { DG: 'only' } } } },
];
let nextSavedId = 3;
setTimeout(syncSavedField);
function applySaved(f) {
  applyState(f.state); snack(`Saved filter applied: ${f.name}`);
  if (sheet.classList.contains('open')) $('#flt-saved').focus();
}

MENUS['saved-filters'] = () => [
  ...(savedFilters.length ? savedFilters.map(f => ({ label: f.name, selected: matchingSaved() === f, sub: [f.shared ? 'Branch' : 'My filter', f.isDefault ? 'My default' : '', f.branchDefault ? 'Branch default' : ''].filter(Boolean).join(' · '), action: () => applySaved(f) }))
    : [{ label: 'No saved filters yet', disabled: true }]),
  { divider: true },
  { label: 'Save current filters…', icon: 'save', action: () => openSaveDialog() },
  { label: 'Manage saved filters…', icon: 'tune', action: () => openManageDialog() },
];

function openSaveDialog() {
  const summary = describeState(captureState());
  const bd = dialog({
    title: 'Save filter', confirm: 'Save', cancel: 'Cancel',
    body: `
      <div class="field required" style="margin-top:6px"><input class="ctl" id="sv-name" maxlength="40" autocomplete="off"><label for="sv-name">Name<span class="req-star">*</span></label></div>
      <div class="save-summary">
        <div class="caption muted">Filters to save</div>
        ${summary.length ? `<div class="chip-row">${summary.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : '<div class="caption">Default filters only</div>'}
        <div class="caption muted" style="margin-top:6px">Dates aren't saved, so the filter always uses the date you're viewing.</div>
      </div>
      <div class="save-options">
        <label class="check"><input type="checkbox" id="sv-default"><span class="box"></span>Use as my default</label>
        <label class="check"><input type="checkbox" id="sv-shared"><span class="box"></span>Share with my branch</label>
        <label class="check" style="margin-left:30px"><input type="checkbox" id="sv-branch-default" disabled><span class="box"></span><span>Branch default<span class="sub caption muted">Used by everyone in your branch who has no default of their own</span></span></label>
      </div>`,
    onConfirm: bd => {
      const f = $('.field', bd), name = $('#sv-name', bd).value.trim();
      if (!validateField(f)) { $('#sv-name', bd).focus(); return false; }
      const clash = savedFilters.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (clash) { setFieldError(f, 'A saved filter already has this name'); $('#sv-name', bd).focus(); return false; }
      const isDefault = $('#sv-default', bd).checked, shared = $('#sv-shared', bd).checked, branchDefault = shared && $('#sv-branch-default', bd).checked;
      if (isDefault) savedFilters.forEach(x => { x.isDefault = false; });
      if (branchDefault) savedFilters.forEach(x => { x.branchDefault = false; });
      savedFilters.push({ id: nextSavedId++, name, shared, isDefault, branchDefault, state: captureState() });
      syncSavedField(); snack(`Filter saved: ${name}`);
    },
  });
  $('#sv-shared', bd).addEventListener('change', e => { const b = $('#sv-branch-default', bd); b.disabled = !e.target.checked; if (!e.target.checked) b.checked = false; });
  $('#sv-name', bd).addEventListener('input', e => { const f = e.target.closest('.field'); if (f.classList.contains('error')) setFieldError(f, ''); });
  $('#sv-name', bd).addEventListener('keydown', e => { if (e.key === 'Enter') $('[data-ok]', bd).click(); });
}
function setFieldError(f, msg) {
  f.classList.toggle('error', !!msg);
  let h = $('.helper', f);
  if (msg && !h) { h = document.createElement('div'); h.className = 'helper'; f.appendChild(h); }
  if (h) { if (msg) h.textContent = msg; else h.remove(); }
}

function openManageDialog() {
  let chosen = null, editing = null;
  const bd = dialog({
    title: 'Saved filters', size: 'md', confirm: 'Apply', cancel: null,
    body: `<div class="grid-wrap manage-wrap"><table class="grid manage-grid">
      <thead><tr><th class="col-check"><span class="sr-only">Choose</span></th><th style="width:200px">Name</th><th>Filters</th><th style="width:110px">Shared</th><th style="width:130px">Default</th><th class="col-actions" style="width:76px"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody></tbody></table></div>`,
    onConfirm: () => {
      const f = savedFilters.find(x => x.id === chosen);
      if (!f) { snack('Choose a saved filter to apply'); return false; }
      applySaved(f);
    },
  });
  const tbody = $('tbody', bd);
  const render = () => {
    syncSavedField();
    tbody.innerHTML = savedFilters.map(f => {
      const sum = describeState(f.state).join(' · ') || 'Default filters only';
      const nameCell = editing === f.id
        ? `<td class="td-edit"><div style="display:flex;gap:2px;align-items:center"><input class="cell-input" data-rename value="${esc(f.name)}" maxlength="40" aria-label="Filter name"><button class="icon-btn sm" data-rename-ok aria-label="Save name" data-tip="Save name"><span class="i mi">check</span></button><button class="icon-btn sm" data-rename-cancel aria-label="Cancel rename" data-tip="Cancel"><span class="i mi">close</span></button></div></td>`
        : `<td class="trunc" title="${esc(f.name)}" style="max-width:200px">${esc(f.name)}</td>`;
      return `<tr data-id="${f.id}" class="${chosen === f.id ? 'selected' : ''}">
        <td class="col-check"><label class="check radio"><input type="radio" name="saved-pick" ${chosen === f.id ? 'checked' : ''} aria-label="Choose ${esc(f.name)}"><span class="box"></span></label></td>
        ${nameCell}
        <td class="trunc" title="${esc(sum)}">${esc(sum)}</td>
        <td>${f.shared ? 'Branch' : 'Only me'}</td>
        <td>${f.isDefault ? '<span class="chip info">My default</span>' : ''}${f.branchDefault ? '<span class="chip">Branch default</span>' : ''}</td>
        <td class="col-actions"><button class="icon-btn sm" data-edit aria-label="Rename ${esc(f.name)}" data-tip="Rename filter"><span class="i mi">edit</span></button><button class="icon-btn sm" data-more aria-label="More actions for ${esc(f.name)}" data-tip="More actions"><span class="i mi">more_vert</span></button></td>
      </tr>`;
    }).join('') || `<tr class="empty"><td colspan="6">No saved filters yet. Use “Save filter” in the Filters panel.</td></tr>`;
    const inp = $('[data-rename]', tbody); if (inp) { inp.focus(); inp.select(); }
  };
  const finishRename = ok => {
    const f = savedFilters.find(x => x.id === editing), inp = $('[data-rename]', tbody);
    if (ok) {
      const v = inp.value.trim();
      if (!v || savedFilters.some(x => x.id !== f.id && x.name.toLowerCase() === v.toLowerCase())) {
        inp.style.borderColor = 'var(--error-main)'; inp.setAttribute('aria-invalid', 'true');
        inp.title = v ? 'A saved filter already has this name' : 'Enter a name'; return;
      }
      f.name = v;
    }
    editing = null; render();
  };
  tbody.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const id = +tr.dataset.id, f = savedFilters.find(x => x.id === id);
    if (e.target.closest('[data-rename-ok]')) return finishRename(true);
    if (e.target.closest('[data-rename-cancel]')) return finishRename(false);
    if (e.target.closest('[data-rename]')) return;
    if (e.target.closest('[data-edit]')) { editing = id; hideTip(); return render(); }
    if (e.target.closest('[data-more]')) {
      const btn = e.target.closest('[data-more]');
      return openMenu(btn, [
        { label: f.isDefault ? 'Remove as my default' : 'Use as my default', action: () => { const v = !f.isDefault; savedFilters.forEach(x => { x.isDefault = false; }); f.isDefault = v; render(); snack(v ? `${f.name} is now your default` : 'Default removed'); } },
        { label: f.shared ? 'Stop sharing with branch' : 'Share with my branch', action: () => { f.shared = !f.shared; if (!f.shared) f.branchDefault = false; render(); } },
        ...(f.shared ? [{ label: f.branchDefault ? 'Remove as branch default' : 'Make branch default', action: () => { const v = !f.branchDefault; savedFilters.forEach(x => { x.branchDefault = false; }); f.branchDefault = v; render(); } }] : []),
        { label: 'Update with current filters', action: () => { f.state = captureState(); render(); snack(`${f.name} updated`); } },
        { divider: true },
        { label: 'Delete', action: () => {
          const i = savedFilters.indexOf(f); savedFilters.splice(i, 1); if (chosen === id) chosen = null; render();
          snack(`${f.name} deleted`, { action: 'Undo', onAction: () => { savedFilters.splice(i, 0, f); render(); } });
        } },
      ]);
    }
    chosen = chosen === id ? null : id; render(); // click again to unselect
  });
  tbody.addEventListener('dblclick', e => { const tr = e.target.closest('tr[data-id]'); if (tr && !e.target.closest('button, input')) { chosen = +tr.dataset.id; $('[data-ok]', bd).click(); } });
  tbody.addEventListener('keydown', e => { if (e.target.matches('[data-rename]')) { if (e.key === 'Enter') { e.preventDefault(); finishRename(true); } if (e.key === 'Escape') { e.stopPropagation(); finishRename(false); } } });
  render();
}

// Refresh + auto-refresh interval split button
let refreshMins = 3, refreshTimer = null;
function doRefresh() {
  const p = $('#progress'); p.hidden = false;
  setTimeout(() => {
    p.hidden = true;
    $('#last-refresh').textContent = new Date().toLocaleTimeString('en-NZ', { hour12: false });
  }, 700);
}
function setRefresh(mins) {
  refreshMins = mins; clearInterval(refreshTimer);
  $('#refresh-interval-label').textContent = mins ? `${mins} MIN` : 'OFF';
  if (mins) refreshTimer = setInterval(() => { if (!$('#screen-dispatch').hidden) doRefresh(); }, mins * 60000);
}
function refreshMenuItems() {
  return [{ header: 'Auto-refresh' }, ...[0, 1, 3, 5, 10].map(m => ({ label: m ? `Every ${m} min` : 'Off', selected: m === refreshMins, action: () => { setRefresh(m); snack(m ? `Auto-refresh every ${m} min` : 'Auto-refresh off'); } }))];
}
// Manual Refresh also applies pending filter edits (legacy habit: change filters, close, press Refresh).
// Auto-refresh never does — it only reloads with the filters already applied.
$('#btn-refresh').addEventListener('click', () => {
  if (!pendingDraft) return doRefresh();
  buildSheet(); restoreDraft(pendingDraft);
  if (applySheet({ quiet: true })) { snack('Filter changes applied'); return; }
  // Something in the pending edits needs fixing (e.g. dates): open the sheet so the error shows
  openSheet(); setTimeout(() => applySheet(), 60);
});
setRefresh(3);

renderZones(); renderJobs(); renderDrivers();

/* =====================================================================
   App bar: hide when scrolling down, reveal when scrolling up
   ===================================================================== */
(() => {
  const bar = $('.appbar');
  let lastY = scrollY, ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY, delta = y - lastY;
      if (y <= bar.offsetHeight) bar.classList.remove('nav-hidden');
      else if (delta > 4) { bar.classList.add('nav-hidden'); closeMenu(); }
      else if (delta < -4) bar.classList.remove('nav-hidden');
      lastY = y; ticking = false;
    });
  }, { passive: true });
  bar.addEventListener('focusin', () => bar.classList.remove('nav-hidden'));
})();

/* =====================================================================
   Journey tracker legs: drawn as SVG so the arrow can have a 1px divider stroke
   and 4px rounded corners (CSS clip-path can do neither). Redrawn on resize.
   ===================================================================== */
(() => {
  const TIP = 24, HEADER = 33, R = 4, NS = 'http://www.w3.org/2000/svg';
  // Path through the points with each corner rounded by r (quadratic curve at each vertex)
  const rounded = (pts, r) => {
    const n = pts.length; let d = '';
    for (let i = 0; i < n; i++) {
      const [px, py] = pts[(i - 1 + n) % n], [x, y] = pts[i], [nx, ny] = pts[(i + 1) % n];
      const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
      const a = Math.min(r, l1 / 2), b = Math.min(r, l2 / 2);
      const sx = x - (x - px) / l1 * a, sy = y - (y - py) / l1 * a, ex = x + (nx - x) / l2 * b, ey = y + (ny - y) / l2 * b;
      d += `${i ? 'L' : 'M'}${sx.toFixed(2)},${sy.toFixed(2)} Q${x},${y} ${ex.toFixed(2)},${ey.toFixed(2)} `;
    }
    return d + 'Z';
  };
  let uid = 0;
  function draw(leg) {
    const w = leg.offsetWidth, h = leg.offsetHeight; if (!w || !h) return;
    const first = leg === leg.parentElement.firstElementChild, o = 0.5; // half-pixel inset keeps the 1px stroke crisp
    const pts = [[o, o], [w - TIP, o], [w - o, h / 2], [w - TIP, h - o], [o, h - o]];
    if (!first) pts.push([TIP, h / 2]);
    const cs = getComputedStyle(leg), tint = cs.getPropertyValue('--tint').trim(), body = cs.getPropertyValue('--body').trim();
    const id = leg.dataset.clip || (leg.dataset.clip = 'leg-clip-' + (++uid)), d = rounded(pts, R);
    let svg = leg.querySelector(':scope > svg.leg-bg');
    if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'leg-bg'); svg.setAttribute('aria-hidden', 'true'); leg.prepend(svg); }
    svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>
      <path d="${d}" fill="${body}"/>
      <rect x="0" y="0" width="${w}" height="${HEADER}" fill="${tint}" clip-path="url(#${id})"/>
      <path d="${d}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`;
  }
  const legs = $$('.legs .leg');
  const ro = new ResizeObserver(entries => entries.forEach(e => draw(e.target)));
  legs.forEach(l => ro.observe(l));
})();

/* ===================================================================== */
route();
})();
